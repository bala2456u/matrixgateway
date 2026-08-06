import { randomBytes, createHash, randomInt } from "crypto";

export function orderReference(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `MG-${ymd}-${suffix}`;
}

/** Sandbox deposit address per address family. Clearly fake but realistic-looking. */
export function sandboxDepositAddress(addressFamily: string): string {
  const hex = (n: number) => randomBytes(n).toString("hex");
  switch (addressFamily) {
    case "BITCOIN":
      return `bc1q${hex(16)}`;
    case "TRON":
      return `T${base58(33)}`;
    case "SOLANA":
      return base58(43);
    default: // EVM
      return `0x${hex(20)}`;
  }
}

/** Sandbox transaction hash for the given address family. */
export function sandboxTxHash(addressFamily: string): string {
  const hex = randomBytes(32).toString("hex");
  switch (addressFamily) {
    case "BITCOIN":
    case "TRON":
      return hex;
    case "SOLANA":
      return base58(87);
    default: // EVM
      return `0x${hex}`;
  }
}

export function sandboxUtr() {
  // IMPS UTR format: 12-digit numeric
  let s = "";
  for (let i = 0; i < 12; i++) s += randomInt(0, 10).toString();
  return s;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += B58[randomInt(0, B58.length)];
  return s;
}

export function generateApiKey() {
  const raw = `mg_live_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 15);
  const keyHash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, keyHash };
}

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}
