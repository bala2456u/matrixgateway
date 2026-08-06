import { Badge } from "./ui";

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: string }> = {
  WAITING: { label: "Waiting", tone: "amber" },
  CONFIRMING: { label: "Confirming", tone: "blue" },
  CONFIRMED: { label: "Confirmed", tone: "violet" },
  SENDING: { label: "Crediting", tone: "violet" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "amber" },
  FINISHED: { label: "Finished", tone: "emerald" },
  FAILED: { label: "Failed", tone: "red" },
  REFUNDED: { label: "Refunded", tone: "slate" },
  EXPIRED: { label: "Expired", tone: "slate" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const meta = PAYMENT_STATUS_META[status] ?? { label: status, tone: "slate" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Accepts numbers, strings and Prisma Decimals (which stringify cleanly). */
export const usdt = (n: { toString(): string }) =>
  `${Number(n.toString()).toFixed(4).replace(/\.?0+$/, "")} USDT`;
