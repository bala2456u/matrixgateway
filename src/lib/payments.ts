import { randomBytes, randomInt } from "crypto";
import { prisma } from "./db";
import { getRates } from "./rates";
import { getSettings } from "./settings";
import { sandboxDepositAddress, sandboxTxHash } from "./ids";
import { isLiveNetwork } from "./chains";
import { sendIpn } from "./ipn";
import type { PaymentStatus } from "@/generated/prisma/enums";

export class PaymentError extends Error {}

const SANDBOX_PAY_SECONDS = Number(process.env.SANDBOX_AUTO_PAY_SECONDS ?? 18);
const SECONDS_PER_CONFIRMATION = 8;
const CREDIT_SECONDS = 4;

const PAYMENT_INCLUDE = {
  network: true,
  events: { orderBy: { createdAt: "asc" as const } },
};

/** Public, gateway-style numeric payment id. */
function newPaymentId() {
  let s = "";
  for (let i = 0; i < 10; i++) s += randomInt(0, 10).toString();
  return s;
}

export function newInvoiceToken() {
  return randomBytes(12).toString("base64url");
}

/**
 * Create a payment: the customer must send `payAmount` USDT to `payAddress`.
 * The amount carries a unique cent code so transfers to the shared gateway
 * wallet can be matched back to this payment.
 */
export async function createPayment(opts: {
  merchantId: string;
  priceAmount: number;
  priceCurrency?: string;
  networkCode?: string;
  orderId?: string | null;
  orderDescription?: string | null;
  purchaseId?: string | null;
  ipnCallbackUrl?: string | null;
  successUrl?: string | null;
  cancelUrl?: string | null;
  invoiceId?: string | null;
  viaApiKeyId?: string | null;
}) {
  const settings = await getSettings();
  const priceCurrency = (opts.priceCurrency ?? "INR").toUpperCase();
  if (!["INR", "USD", "USDT"].includes(priceCurrency))
    throw new PaymentError("price_currency must be INR, USD or USDT");
  if (!(opts.priceAmount > 0)) throw new PaymentError("price_amount must be positive");

  const asset = await prisma.asset.findUnique({
    where: { symbol: "USDT" },
    include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!asset || asset.networks.length === 0) throw new PaymentError("USDT is not available");

  const network = opts.networkCode
    ? asset.networks.find((n) => n.code === opts.networkCode!.toUpperCase())
    : (asset.networks.find((n) => n.recommended) ?? asset.networks[0]);
  if (!network)
    throw new PaymentError(
      `Unsupported network. Available: ${asset.networks.map((n) => n.code).join(", ")}`
    );

  // Convert the merchant's price into USDT
  const { rates } = await getRates([asset.coingeckoId]);
  const usdtInr = rates[asset.coingeckoId];
  if (!usdtInr) throw new PaymentError("Rate unavailable, try again");
  const rateForCurrency =
    priceCurrency === "INR" ? usdtInr : priceCurrency === "USD" ? usdtInr / 88 : 1;
  const baseAmount = priceCurrency === "USDT" ? opts.priceAmount : opts.priceAmount / rateForCurrency;

  const minAmount = Number(settings.min_payment_usdt);
  if (baseAmount < minAmount)
    throw new PaymentError(`Amount is below the ${minAmount} USDT minimum`);

  const payAmount = await uniqueAmount(baseAmount, network.id);
  const feeBps = Number(settings.service_fee_bps);
  const serviceFee = round(payAmount * (feeBps / 10_000), 6);
  const outcome = round(payAmount - serviceFee, 6);

  const address = network.depositAddress ?? sandboxDepositAddress(network.addressFamily);
  const windowMin = Number(settings.payment_window_minutes);

  const payment = await prisma.payment.create({
    data: {
      paymentId: newPaymentId(),
      merchantId: opts.merchantId,
      invoiceId: opts.invoiceId ?? null,
      priceAmount: opts.priceAmount.toString(),
      priceCurrency,
      payCurrency: "USDT",
      payAmount: payAmount.toString(),
      lockedRateInr: usdtInr.toString(),
      networkId: network.id,
      payAddress: address,
      serviceFee: serviceFee.toString(),
      outcomeAmount: outcome.toString(),
      orderId: opts.orderId ?? null,
      orderDescription: opts.orderDescription ?? null,
      purchaseId: opts.purchaseId ?? null,
      ipnCallbackUrl: opts.ipnCallbackUrl ?? null,
      successUrl: opts.successUrl ?? null,
      cancelUrl: opts.cancelUrl ?? null,
      createdViaApiKeyId: opts.viaApiKeyId ?? null,
      expiresAt: new Date(Date.now() + windowMin * 60_000),
      events: {
        create: {
          status: "WAITING",
          message: `Payment created. Send ${payAmount} USDT on ${network.name}.`,
        },
      },
    },
    include: PAYMENT_INCLUDE,
  });
  return payment;
}

/** Nudge the amount so concurrent payments on a shared wallet stay distinguishable. */
async function uniqueAmount(base: number, networkId: string) {
  for (let i = 0; i < 8; i++) {
    const candidate = round(base + randomInt(11, 100) / 10_000, 4);
    const clash = await prisma.payment.findFirst({
      where: {
        networkId,
        payAmount: candidate.toString(),
        status: { in: ["WAITING", "CONFIRMING", "CONFIRMED"] },
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return round(base + randomInt(101, 999) / 10_000, 4);
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Advance a payment. Live networks are driven by the chain watcher; sandbox
 * networks simulate the customer's transfer and confirmations on a timer.
 */
export async function advancePayment(id: string) {
  const p = await prisma.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
  if (!p) return null;
  const now = Date.now();

  if (p.status === "WAITING" && p.expiresAt.getTime() < now) {
    return transition(p.id, "EXPIRED", "Payment window elapsed with no transfer received.");
  }

  const live = isLiveNetwork(p.network.code);

  if (p.status === "WAITING" && !live && SANDBOX_PAY_SECONDS > 0) {
    const since = p.events.filter((e) => e.status === "WAITING").at(-1)?.createdAt ?? p.createdAt;
    if (now - since.getTime() >= SANDBOX_PAY_SECONDS * 1000) {
      return markDetected(p.id, sandboxTxHash(p.network.addressFamily), Number(p.payAmount));
    }
    return p;
  }

  if (p.status === "CONFIRMING") {
    const required = p.network.confirmationsRequired;
    if (live) return p; // real confirmations come from the watcher
    const since = p.events.filter((e) => e.status === "CONFIRMING").at(-1)?.createdAt ?? p.updatedAt;
    const confs = Math.min(required, Math.floor((now - since.getTime()) / (SECONDS_PER_CONFIRMATION * 1000)));
    if (confs >= required) return applyConfirmations(p.id, confs);
    if (confs !== p.confirmations) {
      await prisma.payment.update({ where: { id: p.id }, data: { confirmations: confs } });
      return reload(p.id);
    }
    return p;
  }

  if (p.status === "SENDING") {
    const since = p.events.filter((e) => e.status === "SENDING").at(-1)?.createdAt ?? p.updatedAt;
    if (now - since.getTime() >= CREDIT_SECONDS * 1000) return finishPayment(p.id);
    return p;
  }

  return p;
}

/** A transfer was seen (sandbox timer or real chain watcher). */
export async function markDetected(id: string, txHash: string, receivedAmount: number) {
  const p = await prisma.payment.findUnique({ where: { id }, include: { network: true } });
  if (!p || p.status !== "WAITING") return reload(id);

  const settings = await getSettings();
  const expected = Number(p.payAmount);
  const tolerance = expected * (Number(settings.underpayment_tolerance_bps) / 10_000);
  const short = receivedAmount < expected - tolerance;

  await prisma.payment.update({
    where: { id },
    data: {
      status: "CONFIRMING",
      txHash,
      actuallyPaid: receivedAmount.toString(),
      confirmations: 0,
      events: {
        create: {
          status: "CONFIRMING",
          message: short
            ? `Underpayment detected: received ${receivedAmount} of ${expected} USDT (tx ${txHash.slice(0, 18)}…).`
            : `Transfer detected: ${receivedAmount} USDT (tx ${txHash.slice(0, 18)}…). Awaiting ${p.network.confirmationsRequired} confirmation(s).`,
        },
      },
    },
  });
  const fresh = await reload(id);
  if (fresh) await sendIpn(fresh);
  return fresh;
}

/** Confirmation count changed; settle once the threshold is met. */
export async function applyConfirmations(id: string, confirmations: number) {
  const p = await prisma.payment.findUnique({ where: { id }, include: { network: true } });
  if (!p || p.status !== "CONFIRMING") return reload(id);
  const required = p.network.confirmationsRequired;

  if (confirmations < required) {
    if (confirmations !== p.confirmations) {
      await prisma.payment.update({ where: { id }, data: { confirmations } });
    }
    return reload(id);
  }

  const settings = await getSettings();
  const expected = Number(p.payAmount);
  const paid = Number(p.actuallyPaid);
  const tolerance = expected * (Number(settings.underpayment_tolerance_bps) / 10_000);

  if (paid < expected - tolerance) {
    await prisma.payment.update({
      where: { id },
      data: {
        status: "PARTIALLY_PAID",
        confirmations,
        paidAt: new Date(),
        events: {
          create: {
            status: "PARTIALLY_PAID",
            message: `Confirmed, but only ${paid} of ${expected} USDT was received.`,
          },
        },
      },
    });
    const partial = await reload(id);
    if (partial) await sendIpn(partial);
    return partial;
  }

  await prisma.payment.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmations,
      events: {
        create: { status: "CONFIRMED", message: `Confirmed on-chain (${confirmations}/${required}).` },
      },
    },
  });
  const confirmed = await reload(id);
  if (confirmed) await sendIpn(confirmed);

  await prisma.payment.update({
    where: { id },
    data: {
      status: "SENDING",
      events: { create: { status: "SENDING", message: "Crediting your merchant balance." } },
    },
  });
  return reload(id);
}

/** Credit the merchant and close the payment. */
export async function finishPayment(id: string) {
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p || p.status !== "SENDING") return reload(id);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id },
      data: {
        status: "FINISHED",
        paidAt: new Date(),
        events: {
          create: {
            status: "FINISHED",
            message: `Payment complete. ${p.outcomeAmount} USDT credited (fee ${p.serviceFee} USDT).`,
          },
        },
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        merchantId: p.merchantId,
        paymentId: p.id,
        type: "PAYMENT_CREDIT",
        amount: p.outcomeAmount,
        note: `Payment ${p.paymentId}`,
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        merchantId: p.merchantId,
        paymentId: p.id,
        type: "SERVICE_FEE",
        amount: `-${p.serviceFee}`,
        note: `Service fee for ${p.paymentId}`,
      },
    }),
  ]);
  const done = await reload(id);
  if (done) await sendIpn(done);
  return done;
}

async function transition(id: string, status: PaymentStatus, message: string) {
  await prisma.payment.update({
    where: { id },
    data: { status, events: { create: { status, message } } },
  });
  const fresh = await reload(id);
  if (fresh) await sendIpn(fresh);
  return fresh;
}

function reload(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
}

export async function merchantBalance(merchantId: string) {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["merchantId"],
    where: { merchantId },
    _sum: { amount: true },
  });
  return Number(rows[0]?._sum.amount ?? 0);
}

/** Shape used by the public API and IPN payloads. */
export function publicPayment(p: {
  paymentId: string;
  status: string;
  payAddress: string;
  priceAmount: unknown;
  priceCurrency: string;
  payAmount: unknown;
  actuallyPaid: unknown;
  payCurrency: string;
  outcomeAmount: unknown;
  serviceFee: unknown;
  orderId: string | null;
  orderDescription: string | null;
  purchaseId: string | null;
  invoiceId: string | null;
  txHash: string | null;
  confirmations: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  network?: { code: string; name: string; confirmationsRequired: number } | null;
}) {
  return {
    payment_id: p.paymentId,
    payment_status: p.status.toLowerCase(),
    pay_address: p.payAddress,
    price_amount: Number(p.priceAmount),
    price_currency: p.priceCurrency.toLowerCase(),
    pay_amount: Number(p.payAmount),
    actually_paid: Number(p.actuallyPaid),
    pay_currency: p.payCurrency.toLowerCase(),
    outcome_amount: Number(p.outcomeAmount),
    service_fee: Number(p.serviceFee),
    network: p.network?.code ?? null,
    network_name: p.network?.name ?? null,
    confirmations: p.confirmations,
    confirmations_required: p.network?.confirmationsRequired ?? null,
    tx_hash: p.txHash,
    order_id: p.orderId,
    order_description: p.orderDescription,
    purchase_id: p.purchaseId,
    invoice_id: p.invoiceId,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    expiration_estimate_date: p.expiresAt.toISOString(),
  };
}
