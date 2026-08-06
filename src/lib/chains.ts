/**
 * Live blockchain integrations.
 *
 * Networks listed in LIVE_NETWORKS (env) are watched on the REAL chain:
 *  - EVM chains (BEP20/ERC20): JSON-RPC eth_getLogs for USDT Transfer events
 *    to the gateway wallet, with real block confirmations.
 *  - Tron (TRC20): TronGrid public API, only_confirmed incoming TRC-20 transfers.
 * Everything else stays in sandbox simulation.
 */

export type EvmChainConfig = {
  kind: "evm";
  rpc: string;
  token: string; // USDT contract
  decimals: number;
  lookbackBlocks: number;
  maxRange: number;
};

export type TronChainConfig = {
  kind: "tron";
  api: string;
  token: string; // USDT TRC-20 contract
  decimals: number;
};

export type ChainConfig = EvmChainConfig | TronChainConfig;

export const LIVE_CONFIG: Record<string, ChainConfig> = {
  BEP20: {
    kind: "evm",
    rpc: process.env.BSC_RPC_URL ?? "https://bsc-rpc.publicnode.com",
    token: "0x55d398326f99059fF775485246999027B3197955", // Binance-Peg BSC-USD
    decimals: 18,
    lookbackBlocks: 200,
    maxRange: 1000,
  },
  ERC20: {
    kind: "evm",
    rpc: process.env.ETH_RPC_URL ?? "https://cloudflare-eth.com",
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT (Ethereum)
    decimals: 6,
    lookbackBlocks: 60,
    maxRange: 800,
  },
  TRC20: {
    kind: "tron",
    api: process.env.TRONGRID_URL ?? "https://api.trongrid.io",
    token: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT (Tron)
    decimals: 6,
  },
};

export function liveNetworkCodes(): string[] {
  return (process.env.LIVE_NETWORKS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && s in LIVE_CONFIG);
}

export function isLiveNetwork(code?: string | null): boolean {
  return !!code && liveNetworkCodes().includes(code.toUpperCase());
}

/** "100.0079" + 6 decimals -> 100007900n, without float rounding. */
export function toBaseUnits(amountDec: string, decimals: number): bigint {
  const [whole, frac = ""] = amountDec.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole || "0") + fracPadded);
}

/** 100007900n + 6 decimals -> "100.0079". */
export function fromBaseUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export type FoundTransfer = {
  txHash: string;
  amountUnits: bigint;
  blockNumber?: number; // EVM
  confirmed?: boolean; // Tron only_confirmed
};

// ---------- EVM (BSC / Ethereum) ----------

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function evmLatestBlock(cfg: EvmChainConfig): Promise<number> {
  return parseInt((await rpcCall(cfg.rpc, "eth_blockNumber", [])) as string, 16);
}

export async function evmIncomingTransfers(
  cfg: EvmChainConfig,
  wallet: string,
  fromBlock: number,
  toBlock: number
): Promise<FoundTransfer[]> {
  const topicTo = "0x" + wallet.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const logs = (await rpcCall(cfg.rpc, "eth_getLogs", [
    {
      address: cfg.token,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: [TRANSFER_TOPIC, null, topicTo],
    },
  ])) as { transactionHash: string; data: string; blockNumber: string }[];
  return logs.map((l) => ({
    txHash: l.transactionHash,
    amountUnits: BigInt(l.data === "0x" ? 0 : l.data),
    blockNumber: parseInt(l.blockNumber, 16),
  }));
}

// ---------- Tron ----------

export async function tronIncomingTransfers(
  cfg: TronChainConfig,
  wallet: string,
  minTimestampMs: number
): Promise<FoundTransfer[]> {
  const url =
    `${cfg.api}/v1/accounts/${wallet}/transactions/trc20` +
    `?only_confirmed=true&only_to=true&limit=50&contract_address=${cfg.token}&min_timestamp=${minTimestampMs}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`trongrid ${res.status}`);
  const json = (await res.json()) as {
    data?: { transaction_id: string; to: string; value: string; type: string }[];
  };
  return (json.data ?? [])
    .filter((t) => t.type === "Transfer" && t.to === wallet)
    .map((t) => ({ txHash: t.transaction_id, amountUnits: BigInt(t.value), confirmed: true }));
}
