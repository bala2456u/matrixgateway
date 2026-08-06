import { prisma } from "./db";
import { computeQuote } from "./fees";
import { LIVE_CONFIG, isLiveNetwork, fromBaseUnits, type EvmChainConfig } from "./chains";
import { markLiveDeposit } from "./orders";
import { audit } from "./audit";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export class ReconcileError extends Error {}

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new ReconcileError(`Chain RPC returned ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new ReconcileError(json.error.message);
  return json.result;
}

/**
 * Support tool: attach a real on-chain transfer to a waiting order when the
 * customer sent a different amount than quoted. The transfer is VERIFIED on
 * the actual chain — tx must be a token transfer to the gateway wallet — and
 * the order is re-priced at its locked rate for the amount actually received.
 */
export async function reconcileOrderWithTx(adminUserId: string, reference: string, txHash: string) {
  const order = await prisma.sellOrder.findUnique({
    where: { reference },
    include: { asset: true, network: true },
  });
  if (!order) throw new ReconcileError("Order not found");
  if (order.status !== "AWAITING_DEPOSIT") throw new ReconcileError("Order is not awaiting a deposit");
  if (!order.network || !isLiveNetwork(order.network.code))
    throw new ReconcileError("Manual matching is only available on live networks");
  const wallet = order.network.depositAddress;
  if (!wallet) throw new ReconcileError("No gateway wallet configured for this network");

  const cfg = LIVE_CONFIG[order.network.code];
  if (cfg.kind !== "evm")
    throw new ReconcileError("Manual matching currently supports EVM networks (BEP20/ERC20) only");

  const hash = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new ReconcileError("That doesn't look like a valid transaction hash");

  const used = await prisma.sellOrder.findFirst({ where: { depositTxHash: hash }, select: { reference: true } });
  if (used) throw new ReconcileError(`This transaction is already credited to order ${used.reference}`);

  const receipt = (await rpcCall(cfg.rpc, "eth_getTransactionReceipt", [hash])) as {
    status?: string;
    blockNumber?: string;
    logs?: { address: string; topics: string[]; data: string }[];
  } | null;
  if (!receipt) throw new ReconcileError("Transaction not found on-chain (is it on the right network?)");
  if (receipt.status !== "0x1") throw new ReconcileError("Transaction failed on-chain");

  const walletTopic = "0x" + wallet.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const transfer = (receipt.logs ?? []).find(
    (l) =>
      l.address.toLowerCase() === (cfg as EvmChainConfig).token.toLowerCase() &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.topics[2]?.toLowerCase() === walletTopic
  );
  if (!transfer)
    throw new ReconcileError(
      `This transaction contains no ${order.asset.symbol} transfer to the gateway wallet`
    );

  const units = BigInt(transfer.data === "0x" ? 0 : transfer.data);
  if (units <= BigInt(0)) throw new ReconcileError("Transfer value is zero");
  const amountStr = fromBaseUnits(units, cfg.decimals);
  const amount = Number(amountStr);
  const rate = Number(order.lockedRateInr);
  const q = computeQuote(amount, rate);
  const blockNumber = receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : undefined;

  await prisma.sellOrder.update({
    where: { id: order.id },
    data: {
      cryptoAmount: amountStr,
      grossInr: q.grossInr.toString(),
      platformFeeInr: q.platformFeeInr.toString(),
      tdsInr: q.tdsInr.toString(),
      netInr: q.netInr.toString(),
      quoteExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      events: {
        create: {
          status: "AWAITING_DEPOSIT",
          message: `Support matched tx ${hash.slice(0, 18)}… to this order. Amount corrected to ${amountStr} ${order.asset.symbol} (received on-chain), re-priced at the locked rate.`,
        },
      },
    },
  });
  await markLiveDeposit(order.id, hash, blockNumber);
  await audit("order.reconcile", {
    userId: adminUserId,
    detail: `${reference} ← ${hash} (${amountStr} ${order.asset.symbol})`,
  });
  return { amount: amountStr, blockNumber };
}
