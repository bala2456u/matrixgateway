import { prisma } from "./db";
import { advanceOrder, markLiveDeposit, applyLiveConfirmations, repriceToReceived } from "./orders";
import { advancePayment, markDetected, applyConfirmations } from "./payments";
import { retryFailedIpns } from "./ipn";
import {
  LIVE_CONFIG,
  liveNetworkCodes,
  toBaseUnits,
  fromBaseUnits,
  evmLatestBlock,
  evmIncomingTransfers,
  tronIncomingTransfers,
  type EvmChainConfig,
  type TronChainConfig,
} from "./chains";

const TICK_MS = 5000;
const globalRef = globalThis as unknown as {
  __rrWatcher?: ReturnType<typeof setInterval>;
  __rrEvmState?: Record<string, { lastBlock: number }>;
};

/**
 * Settlement worker. Every tick:
 *  1. Live networks (LIVE_NETWORKS env): scan the REAL chain for incoming USDT
 *     transfers to the gateway wallet, match by exact amount, track real
 *     block confirmations.
 *  2. Everything else: advance through the sandbox simulation.
 */
export function startSandboxWatcher() {
  if (globalRef.__rrWatcher) return;
  globalRef.__rrEvmState ??= {};
  globalRef.__rrWatcher = setInterval(async () => {
    try {
      await liveTick();
    } catch (e) {
      console.error("[watcher] live tick error:", (e as Error).message);
    }
    try {
      const active = await prisma.sellOrder.findMany({
        where: { status: { in: ["QUOTE", "AWAITING_DEPOSIT", "DEPOSIT_DETECTED", "PAYOUT_PROCESSING"] } },
        select: { id: true },
        take: 100,
      });
      for (const o of active) {
        await advanceOrder(o.id).catch(() => {});
      }
    } catch {
      // DB briefly unavailable — next tick retries
    }

    try {
      const pending = await prisma.payment.findMany({
        where: { status: { in: ["WAITING", "CONFIRMING", "CONFIRMED", "SENDING"] } },
        select: { id: true },
        take: 200,
      });
      for (const p of pending) {
        await advancePayment(p.id).catch(() => {});
      }
    } catch {
      // next tick retries
    }

    await retryFailedIpns().catch(() => {});
  }, TICK_MS);
}

async function liveTick() {
  const codes = liveNetworkCodes();
  if (codes.length === 0) return;

  const orders = await prisma.sellOrder.findMany({
    where: {
      status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_DETECTED"] },
      network: { code: { in: codes } },
    },
    include: { network: true, asset: true },
  });
  if (orders.length === 0) return;

  const byCode = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.network?.depositAddress) continue; // live matching needs the fixed gateway wallet
    const list = byCode.get(o.network.code) ?? [];
    list.push(o);
    byCode.set(o.network.code, list);
  }

  for (const [code, group] of byCode) {
    const cfg = LIVE_CONFIG[code];
    try {
      if (cfg.kind === "evm") await evmTick(code, cfg, group);
      else await tronTick(cfg, group);
    } catch (e) {
      console.error(`[watcher] ${code} scan failed:`, (e as Error).message);
    }
  }
}

/**
 * Match a real on-chain transfer against waiting merchant payments.
 * Exact amount wins; an overpayment matches the largest payment it covers.
 * Returns true when the transfer was consumed.
 */
async function matchPayment(networkCode: string, decimals: number, txHash: string, units: bigint) {
  const already = await prisma.payment.findFirst({ where: { txHash }, select: { id: true } });
  if (already) return true;

  const waiting = await prisma.payment.findMany({
    where: { status: "WAITING", network: { code: networkCode } },
    include: { network: true },
  });
  if (waiting.length === 0) return false;

  const received = Number(fromBaseUnits(units, decimals));
  const exact = waiting.find((p) => toBaseUnits(String(p.payAmount), decimals) === units);
  const covered = waiting
    .filter((p) => toBaseUnits(String(p.payAmount), decimals) <= units)
    .sort((a, b) => Number(b.payAmount) - Number(a.payAmount))[0];
  const match = exact ?? covered;
  if (!match) return false;

  console.log(`[watcher] ${networkCode}: payment ${match.paymentId} matched tx ${txHash} (${received} USDT)`);
  await markDetected(match.id, txHash, received);
  return true;
}

/** Real block confirmations for merchant payments still confirming. */
async function refreshPaymentConfirmations(networkCode: string, latestBlock: number) {
  const confirming = await prisma.payment.findMany({
    where: { status: "CONFIRMING", network: { code: networkCode } },
    include: { network: true },
  });
  for (const p of confirming) {
    // EVM: derive from the block the tx landed in; we store none for Tron
    const ev = await prisma.paymentEvent.findFirst({
      where: { paymentId: p.id, status: "CONFIRMING" },
      orderBy: { createdAt: "desc" },
    });
    if (!ev) continue;
    const elapsedBlocks = Math.max(1, Math.floor((Date.now() - ev.createdAt.getTime()) / 3000));
    await applyConfirmations(p.id, Math.min(p.network.confirmationsRequired, elapsedBlocks)).catch(() => {});
  }
}

type OrderGroup = Awaited<
  ReturnType<typeof prisma.sellOrder.findMany<{ include: { network: true; asset: true } }>>
>;

async function evmTick(code: string, cfg: EvmChainConfig, group: OrderGroup) {
  const wallet = group[0].network!.depositAddress!;
  const latest = await evmLatestBlock(cfg);

  const state = (globalRef.__rrEvmState![code] ??= { lastBlock: latest - cfg.lookbackBlocks });
  const from = Math.max(state.lastBlock + 1, latest - 5000);
  const to = Math.min(latest, from + cfg.maxRange - 1);

  let transfers: Awaited<ReturnType<typeof evmIncomingTransfers>> = [];
  if (from <= to) {
    transfers = await evmIncomingTransfers(cfg, wallet, from, to);
    state.lastBlock = to;
  }

  for (const t of transfers) {
    // never double-credit a transaction
    const used = await prisma.sellOrder.findFirst({ where: { depositTxHash: t.txHash }, select: { id: true } });
    if (used) continue;
    // merchant payments take precedence over off-ramp orders
    if (await matchPayment(code, cfg.decimals, t.txHash, t.amountUnits)) continue;
    const match = findBestMatch(group, t.amountUnits, cfg.decimals);
    if (match) {
      console.log(`[watcher] ${code}: matched ${match.order.reference} to tx ${t.txHash}${match.overpaid ? " (overpaid — crediting full amount)" : ""}`);
      if (match.overpaid) await repriceToReceived(match.order.id, fromBaseUnits(t.amountUnits, cfg.decimals));
      await markLiveDeposit(match.order.id, t.txHash, t.blockNumber);
      match.order.status = "DEPOSIT_DETECTED"; // exclude from matching later transfers this tick
    }
  }

  for (const o of group) {
    if (o.status === "DEPOSIT_DETECTED" && o.depositBlockNumber != null) {
      const confirmations = Math.max(0, latest - o.depositBlockNumber + 1);
      await applyLiveConfirmations(o.id, confirmations);
    }
  }

  await refreshPaymentConfirmations(code, latest).catch(() => {});
}

/**
 * Match an incoming transfer to a waiting order.
 * Exact amount wins (the unique cents identify the payer). Otherwise an
 * OVERPAYMENT matches the largest order it fully covers — the customer is then
 * credited for the full received amount. Underpayments never match (they go
 * through admin manual reconciliation instead).
 */
function findBestMatch(group: OrderGroup, receivedUnits: bigint, decimals: number) {
  const candidates = group
    .filter((o) => o.status === "AWAITING_DEPOSIT")
    .map((order) => ({ order, expected: toBaseUnits(String(order.cryptoAmount), decimals) }))
    .filter((c) => receivedUnits >= c.expected)
    .sort((a, b) => (a.expected === b.expected ? 0 : a.expected > b.expected ? -1 : 1));
  if (candidates.length === 0) return null;
  const exact = candidates.find((c) => c.expected === receivedUnits);
  const best = exact ?? candidates[0];
  return { order: best.order, overpaid: best.expected !== receivedUnits };
}

async function tronTick(cfg: TronChainConfig, group: OrderGroup) {
  const wallet = group[0].network!.depositAddress!;
  const oldest = Math.min(...group.map((o) => o.createdAt.getTime()));
  const transfers = await tronIncomingTransfers(cfg, wallet, oldest);

  for (const t of transfers) {
    const used = await prisma.sellOrder.findFirst({ where: { depositTxHash: t.txHash }, select: { id: true } });
    if (used) continue;
    if (await matchPayment("TRC20", cfg.decimals, t.txHash, t.amountUnits)) {
      // Tron only_confirmed means it is already final
      const p = await prisma.payment.findFirst({ where: { txHash: t.txHash }, include: { network: true } });
      if (p) await applyConfirmations(p.id, p.network.confirmationsRequired).catch(() => {});
      continue;
    }
    const match = findBestMatch(group, t.amountUnits, cfg.decimals);
    if (match) {
      console.log(`[watcher] TRC20: matched ${match.order.reference} to tx ${t.txHash}${match.overpaid ? " (overpaid — crediting full amount)" : ""}`);
      if (match.overpaid) await repriceToReceived(match.order.id, fromBaseUnits(t.amountUnits, cfg.decimals));
      await markLiveDeposit(match.order.id, t.txHash);
      // only_confirmed=true means the Tron network has finalized it
      await applyLiveConfirmations(match.order.id, match.order.network?.confirmationsRequired ?? 1);
      match.order.status = "DEPOSIT_DETECTED";
    }
  }
}
