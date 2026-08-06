import { randomInt } from "crypto";
import { prisma } from "./db";
import { computeQuote } from "./fees";
import { getRates } from "./rates";
import { orderReference, sandboxDepositAddress, sandboxTxHash, sandboxUtr } from "./ids";
import { dispatchWebhooks } from "./webhooks";
import { isLiveNetwork } from "./chains";

export const QUOTE_TTL_MS = 10 * 60 * 1000; // rate lock window
// Payment window: how long the customer has to get their transfer on-chain
// before the order is marked FAILED.
export const DEPOSIT_WINDOW_MS = Number(process.env.DEPOSIT_WINDOW_MINUTES ?? 15) * 60 * 1000;
const SECONDS_PER_CONFIRMATION = 8; // sandbox chain speed
const PAYOUT_SETTLE_SECONDS = 6; // sandbox IMPS settlement time
// Sandbox watcher: seconds until the simulated customer payment arrives ("off" disables)
const AUTO_PAY = process.env.SANDBOX_AUTO_PAY_SECONDS ?? "18";
const DEFAULT_CONFIRMATIONS = 2; // legacy orders with no network row

export class OrderError extends Error {}

const ORDER_INCLUDE = {
  asset: true,
  network: true,
  events: { orderBy: { createdAt: "asc" as const } },
  payout: true,
};

export async function createQuote(opts: {
  userId: string;
  assetSymbol: string;
  networkCode?: string;
  cryptoAmount: number;
  viaApiKeyId?: string;
}) {
  const asset = await prisma.asset.findUnique({
    where: { symbol: opts.assetSymbol },
    include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!asset || !asset.enabled) throw new OrderError("Unsupported asset");
  if (asset.networks.length === 0) throw new OrderError("No networks available for this asset");

  const wantedCode = opts.networkCode?.toUpperCase();
  const network = wantedCode
    ? asset.networks.find((n) => n.code === wantedCode)
    : asset.networks.find((n) => n.recommended) ?? asset.networks[0];
  if (!network)
    throw new OrderError(
      `Unsupported network for ${asset.symbol}. Available: ${asset.networks.map((n) => n.code).join(", ")}`
    );

  if (!(opts.cryptoAmount > 0)) throw new OrderError("Amount must be positive");
  if (opts.cryptoAmount < Number(asset.minSellAmount))
    throw new OrderError(`Minimum sell amount is ${asset.minSellAmount} ${asset.symbol}`);

  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  if (!user) throw new OrderError("User not found");
  if (user.kycStatus !== "VERIFIED")
    throw new OrderError("KYC verification is required before selling crypto");

  const { rates } = await getRates([asset.coingeckoId]);
  const rate = rates[asset.coingeckoId];
  if (!rate) throw new OrderError("Rate unavailable, try again");

  // Shared gateway wallet: nudge the amount by a few random cents so every
  // active order on this network has a unique amount — that's how the watcher
  // matches an incoming transfer to the right order.
  let amount = opts.cryptoAmount;
  if (network.depositAddress) {
    amount = await uniquePaymentAmount(opts.cryptoAmount, asset.symbol, network.id);
  }

  const q = computeQuote(amount, rate);

  const order = await prisma.sellOrder.create({
    data: {
      reference: orderReference(),
      userId: opts.userId,
      assetId: asset.id,
      networkId: network.id,
      cryptoAmount: amount.toString(),
      lockedRateInr: rate.toString(),
      grossInr: q.grossInr.toString(),
      platformFeeInr: q.platformFeeInr.toString(),
      tdsInr: q.tdsInr.toString(),
      netInr: q.netInr.toString(),
      status: "QUOTE",
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      createdViaApiKeyId: opts.viaApiKeyId,
      events: {
        create: {
          status: "QUOTE",
          message: `Quote created on ${network.name}: rate locked at ₹${rate.toLocaleString("en-IN")} per ${asset.symbol} for 10 minutes`,
        },
      },
    },
    include: { asset: true, network: true },
  });
  return order;
}

/**
 * Pick a payment amount that is unique among active orders on this network by
 * adding a small random "cent" component (e.g. 100 → 100.0042 USDT).
 */
async function uniquePaymentAmount(base: number, assetSymbol: string, networkId: string) {
  const d = assetSymbol === "USDT" ? 4 : 6; // decimal position of the uniqueness cents
  const scale = 10 ** d;
  for (let attempt = 0; attempt < 8; attempt++) {
    const delta = randomInt(11, 100) / scale;
    const candidate = Math.round((base + delta) * scale) / scale;
    const clash = await prisma.sellOrder.findFirst({
      where: {
        networkId,
        cryptoAmount: candidate.toString(),
        status: { in: ["QUOTE", "AWAITING_DEPOSIT", "DEPOSIT_DETECTED"] },
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  // 8 collisions in a row is practically impossible; widen the range as a last resort
  return Math.round((base + randomInt(101, 999) / scale) * scale) / scale;
}

export async function confirmOrder(orderId: string, userId: string, bankAccountId: string) {
  const order = await prisma.sellOrder.findFirst({
    where: { id: orderId, userId },
    include: { asset: true, network: true },
  });
  if (!order) throw new OrderError("Order not found");
  if (order.status !== "QUOTE") throw new OrderError("Order is not in quote state");
  if (!order.network) throw new OrderError("Order has no network assigned");
  if (order.quoteExpiresAt < new Date()) {
    await transition(order.id, "EXPIRED", "Quote expired before confirmation");
    throw new OrderError("Quote expired — please create a new one");
  }
  const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
  if (!bank) throw new OrderError("Bank account not found");

  // Gateway model: pay to the admin-fixed wallet for this network; orders are
  // matched by exact amount. Falls back to a per-order sandbox address if the
  // admin hasn't configured one.
  const address = order.network.depositAddress ?? sandboxDepositAddress(order.network.addressFamily);
  const updated = await prisma.sellOrder.update({
    where: { id: order.id },
    data: {
      status: "AWAITING_DEPOSIT",
      depositAddress: address,
      bankAccountId: bank.id,
      quoteExpiresAt: new Date(Date.now() + DEPOSIT_WINDOW_MS),
      events: {
        create: {
          status: "AWAITING_DEPOSIT",
          message: `Payment window open on ${order.network.name}. Send exactly ${order.cryptoAmount} ${order.asset.symbol} to the gateway wallet.`,
        },
      },
    },
    include: { asset: true, network: true },
  });
  await dispatchWebhooks(userId, "order.awaiting_deposit", publicOrder(updated));
  return updated;
}

/** Sandbox: pretend the customer's crypto arrived on-chain. */
export async function simulateDeposit(orderId: string, userId: string) {
  if (process.env.GATEWAY_MODE !== "sandbox") throw new OrderError("Not in sandbox mode");
  const order = await prisma.sellOrder.findFirst({
    where: { id: orderId, userId },
    include: { asset: true, network: true },
  });
  if (!order) throw new OrderError("Order not found");
  if (order.status !== "AWAITING_DEPOSIT") throw new OrderError("Order is not awaiting deposit");
  if (isLiveNetwork(order.network?.code))
    throw new OrderError(`${order.network?.code} uses live blockchain detection — send the real payment instead`);

  const confirmationsRequired = order.network?.confirmationsRequired ?? DEFAULT_CONFIRMATIONS;
  const txHash = sandboxTxHash(order.network?.addressFamily ?? "EVM");
  const updated = await prisma.sellOrder.update({
    where: { id: order.id },
    data: {
      status: "DEPOSIT_DETECTED",
      depositTxHash: txHash,
      confirmations: 0,
      events: {
        create: {
          status: "DEPOSIT_DETECTED",
          message: `Deposit detected in mempool (tx ${txHash.slice(0, 18)}…). Waiting for ${confirmationsRequired} confirmation(s).`,
        },
      },
    },
    include: { asset: true, network: true },
  });
  await dispatchWebhooks(userId, "order.deposit_detected", publicOrder(updated));
  return updated;
}

/**
 * Lazily advance an order through the sandbox settlement pipeline based on
 * elapsed time. Called whenever the order is read (status polls, pages).
 * In production this work is done by a blockchain watcher + payout worker.
 */
export async function advanceOrder(orderId: string) {
  const order = await prisma.sellOrder.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order) return null;

  const now = Date.now();

  // Unconfirmed quote lapses quietly; an unfunded payment window is a FAILURE —
  // the blockchain never confirmed a transfer, so the order is dead.
  if (order.status === "QUOTE" && order.quoteExpiresAt.getTime() < now) {
    await transition(order.id, "EXPIRED", "Quote expired");
    return reload(orderId);
  }
  if (order.status === "AWAITING_DEPOSIT" && order.quoteExpiresAt.getTime() < now) {
    await transition(
      order.id,
      "FAILED",
      `Payment failed — no ${order.asset.symbol} transfer was confirmed on ${order.network?.name ?? "the network"} within the payment window.`
    );
    const failed = await reload(orderId);
    if (failed) await dispatchWebhooks(order.userId, "order.failed", publicOrder(failed));
    return failed;
  }

  // Live networks are driven by the real chain watcher (src/lib/watcher.ts) —
  // no simulation of payment arrival or confirmations.
  if (
    (order.status === "AWAITING_DEPOSIT" || order.status === "DEPOSIT_DETECTED") &&
    isLiveNetwork(order.network?.code)
  ) {
    return order;
  }

  // Sandbox watcher: auto-detect the customer's payment to the gateway wallet.
  // In production a chain watcher matches incoming transfers by amount instead.
  if (order.status === "AWAITING_DEPOSIT" && process.env.GATEWAY_MODE === "sandbox" && AUTO_PAY !== "off") {
    const openedAt = order.events.filter((e) => e.status === "AWAITING_DEPOSIT").at(-1)?.createdAt ?? order.updatedAt;
    if (now - openedAt.getTime() >= Number(AUTO_PAY) * 1000) {
      const confirmationsRequired = order.network?.confirmationsRequired ?? DEFAULT_CONFIRMATIONS;
      const txHash = sandboxTxHash(order.network?.addressFamily ?? "EVM");
      await prisma.sellOrder.update({
        where: { id: order.id },
        data: {
          status: "DEPOSIT_DETECTED",
          depositTxHash: txHash,
          confirmations: 0,
          events: {
            create: {
              status: "DEPOSIT_DETECTED",
              message: `Incoming transfer of ${order.cryptoAmount} ${order.asset.symbol} detected (tx ${txHash.slice(0, 18)}…). Waiting for ${confirmationsRequired} confirmation(s).`,
            },
          },
        },
      });
      const detected = await reload(orderId);
      if (detected) await dispatchWebhooks(order.userId, "order.deposit_detected", publicOrder(detected));
      return advanceOrder(orderId);
    }
    return order;
  }

  if (order.status === "DEPOSIT_DETECTED") {
    const required = order.network?.confirmationsRequired ?? DEFAULT_CONFIRMATIONS;
    const detectedAt = order.events.filter((e) => e.status === "DEPOSIT_DETECTED").at(-1)?.createdAt ?? order.updatedAt;
    const confirmations = Math.min(
      required,
      Math.floor((now - detectedAt.getTime()) / (SECONDS_PER_CONFIRMATION * 1000))
    );
    if (confirmations >= required) {
      await confirmAndStartPayout(order.id, confirmations, required);
      return advanceOrder(orderId);
    } else if (confirmations !== order.confirmations) {
      await prisma.sellOrder.update({ where: { id: order.id }, data: { confirmations } });
    }
    return reload(orderId);
  }

  if (order.status === "PAYOUT_PROCESSING") {
    const startedAt = order.events.filter((e) => e.status === "PAYOUT_PROCESSING").at(-1)?.createdAt ?? order.updatedAt;
    if (now - startedAt.getTime() >= PAYOUT_SETTLE_SECONDS * 1000 && order.payout) {
      const utr = sandboxUtr();
      await prisma.payout.update({
        where: { id: order.payout.id },
        data: { status: "SUCCESS", utr, settledAt: new Date() },
      });
      await prisma.sellOrder.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          events: {
            create: {
              status: "COMPLETED",
              message: `Payout settled via IMPS. UTR ${utr}. Order complete.`,
            },
          },
        },
      });
      const fresh = await reload(orderId);
      if (fresh) await dispatchWebhooks(order.userId, "order.completed", publicOrder(fresh));
      return fresh;
    }
    return order;
  }

  return order;
}

/** DEPOSIT_DETECTED → DEPOSIT_CONFIRMED → PAYOUT_PROCESSING (payout stays simulated). */
async function confirmAndStartPayout(orderId: string, confirmations: number, required: number) {
  const order = await prisma.sellOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "DEPOSIT_DETECTED") return;
  await prisma.sellOrder.update({
    where: { id: orderId },
    data: {
      status: "DEPOSIT_CONFIRMED",
      confirmations,
      events: {
        create: {
          status: "DEPOSIT_CONFIRMED",
          message: `Deposit confirmed on-chain (${confirmations}/${required} confirmations).`,
        },
      },
    },
  });
  const confirmed = await reload(orderId);
  if (confirmed) await dispatchWebhooks(order.userId, "order.deposit_confirmed", publicOrder(confirmed));
  await prisma.sellOrder.update({
    where: { id: orderId },
    data: {
      status: "PAYOUT_PROCESSING",
      payout: {
        create: {
          bankAccountId: order.bankAccountId!,
          amountInr: order.netInr,
          mode: "IMPS",
          status: "PROCESSING",
        },
      },
      events: {
        create: {
          status: "PAYOUT_PROCESSING",
          message: `IMPS payout of ₹${Number(order.netInr).toLocaleString("en-IN")} initiated to your bank account.`,
        },
      },
    },
  });
}

/**
 * Live watcher / support: the customer sent MORE than quoted — credit the full
 * received amount, re-priced at the order's locked rate.
 */
export async function repriceToReceived(orderId: string, receivedAmount: string) {
  const order = await prisma.sellOrder.findUnique({
    where: { id: orderId },
    include: { asset: true },
  });
  if (!order || order.status !== "AWAITING_DEPOSIT") return;
  const q = computeQuote(Number(receivedAmount), Number(order.lockedRateInr));
  await prisma.sellOrder.update({
    where: { id: orderId },
    data: {
      cryptoAmount: receivedAmount,
      grossInr: q.grossInr.toString(),
      platformFeeInr: q.platformFeeInr.toString(),
      tdsInr: q.tdsInr.toString(),
      netInr: q.netInr.toString(),
      events: {
        create: {
          status: "AWAITING_DEPOSIT",
          message: `Received ${receivedAmount} ${order.asset.symbol} — more than quoted. Full amount credited at the locked rate (payout updated to ₹${q.netInr.toLocaleString("en-IN")}).`,
        },
      },
    },
  });
}

/** Live watcher: a real on-chain transfer matching this order was found. */
export async function markLiveDeposit(orderId: string, txHash: string, blockNumber?: number) {
  const order = await prisma.sellOrder.findUnique({
    where: { id: orderId },
    include: { asset: true, network: true },
  });
  if (!order || order.status !== "AWAITING_DEPOSIT") return;
  const required = order.network?.confirmationsRequired ?? DEFAULT_CONFIRMATIONS;
  await prisma.sellOrder.update({
    where: { id: orderId },
    data: {
      status: "DEPOSIT_DETECTED",
      depositTxHash: txHash,
      depositBlockNumber: blockNumber ?? null,
      confirmations: 0,
      events: {
        create: {
          status: "DEPOSIT_DETECTED",
          message: `Incoming ${order.asset.symbol} transfer found on ${order.network?.name} (tx ${txHash.slice(0, 18)}…). Waiting for ${required} block confirmation(s).`,
        },
      },
    },
  });
  const detected = await reload(orderId);
  if (detected) await dispatchWebhooks(order.userId, "order.deposit_detected", publicOrder(detected));
}

/** Live watcher: update real confirmation count; settle when the chain says so. */
export async function applyLiveConfirmations(orderId: string, confirmations: number) {
  const order = await prisma.sellOrder.findUnique({ where: { id: orderId }, include: { network: true } });
  if (!order || order.status !== "DEPOSIT_DETECTED") return;
  const required = order.network?.confirmationsRequired ?? DEFAULT_CONFIRMATIONS;
  if (confirmations >= required) {
    await confirmAndStartPayout(orderId, confirmations, required);
    await advanceOrder(orderId);
  } else if (confirmations !== order.confirmations) {
    await prisma.sellOrder.update({ where: { id: orderId }, data: { confirmations } });
  }
}

async function transition(orderId: string, status: "EXPIRED" | "FAILED", message: string) {
  await prisma.sellOrder.update({
    where: { id: orderId },
    data: { status, events: { create: { status, message } } },
  });
}

function reload(orderId: string) {
  return prisma.sellOrder.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
}

/** Shape returned by the public API and sent in webhooks. */
export function publicOrder(o: {
  reference: string;
  status: string;
  cryptoAmount: unknown;
  lockedRateInr: unknown;
  grossInr: unknown;
  platformFeeInr: unknown;
  tdsInr: unknown;
  netInr: unknown;
  depositAddress: string | null;
  depositTxHash: string | null;
  confirmations: number;
  quoteExpiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
  asset?: { symbol: string } | null;
  network?: { code: string; name: string; confirmationsRequired: number } | null;
  payout?: { utr: string | null; status: string; mode: string } | null;
}) {
  return {
    reference: o.reference,
    status: o.status,
    asset: o.asset?.symbol,
    network: o.network
      ? { code: o.network.code, name: o.network.name, live: isLiveNetwork(o.network.code) }
      : null,
    crypto_amount: String(o.cryptoAmount),
    locked_rate_inr: String(o.lockedRateInr),
    gross_inr: String(o.grossInr),
    platform_fee_inr: String(o.platformFeeInr),
    tds_inr: String(o.tdsInr),
    net_inr: String(o.netInr),
    deposit_address: o.depositAddress,
    deposit_tx_hash: o.depositTxHash,
    confirmations: o.confirmations,
    confirmations_required: o.network?.confirmationsRequired ?? null,
    quote_expires_at: o.quoteExpiresAt.toISOString(),
    created_at: o.createdAt.toISOString(),
    completed_at: o.completedAt?.toISOString() ?? null,
    payout: o.payout ? { utr: o.payout.utr, status: o.payout.status, mode: o.payout.mode } : null,
  };
}
