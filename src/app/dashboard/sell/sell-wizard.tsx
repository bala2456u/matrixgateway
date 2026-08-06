"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Card, Button, Input, Label, Select, OrderStatusBadge, Badge } from "@/components/ui";
import {
  Copy,
  Check,
  CircleCheck,
  CircleX,
  Loader2,
  Landmark,
  TriangleAlert,
  Clock3,
  BadgeCheck,
  ScanLine,
  Wallet,
  ShieldCheck,
  IndianRupee,
  Info,
} from "lucide-react";

type NetworkInfo = {
  code: string;
  name: string;
  confirmationsRequired: number;
  avgSettleMinutes: number;
  feeNote: string | null;
  recommended: boolean;
};

type AssetInfo = {
  symbol: string;
  name: string;
  featured: boolean;
  minSellAmount: number;
  rateInr: number;
  networks: NetworkInfo[];
};

type BankInfo = { id: string; bankName: string; accountNumber: string; isDefault: boolean };

type OrderView = {
  id: string;
  reference: string;
  status: string;
  asset?: string | null;
  network?: { code: string; name: string; live?: boolean } | null;
  crypto_amount: string;
  locked_rate_inr: string;
  gross_inr: string;
  platform_fee_inr: string;
  tds_inr: string;
  net_inr: string;
  deposit_address: string | null;
  deposit_tx_hash: string | null;
  confirmations: number;
  confirmations_required: number | null;
  quote_expires_at: string;
  payout: { utr: string | null; status: string; mode: string } | null;
  events: { status: string; message: string; at: string }[];
};

const inr = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n));

const ASSET_ICON: Record<string, { glyph: string; classes: string }> = {
  USDT: { glyph: "₮", classes: "bg-emerald-500/15 text-emerald-300 border-emerald-700/50" },
  BTC: { glyph: "₿", classes: "bg-orange-500/15 text-orange-300 border-orange-700/50" },
  ETH: { glyph: "Ξ", classes: "bg-indigo-500/15 text-indigo-300 border-indigo-700/50" },
  SOL: { glyph: "◎", classes: "bg-violet-500/15 text-violet-300 border-violet-700/50" },
};

export function SellWizard(props: {
  assets: AssetInfo[];
  banks: BankInfo[];
  platformFeeBps: number;
  tdsBps: number;
}) {
  const [step, setStep] = useState<"amount" | "confirm" | "track">("amount");
  const [assetSymbol, setAssetSymbol] = useState(props.assets[0]?.symbol ?? "USDT");
  const asset = props.assets.find((a) => a.symbol === assetSymbol)!;

  const defaultNetwork = (a: AssetInfo) => (a.networks.find((n) => n.recommended) ?? a.networks[0])?.code ?? "";
  const [networkCode, setNetworkCode] = useState(() => defaultNetwork(asset));
  const network = asset.networks.find((n) => n.code === networkCode) ?? asset.networks[0];

  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState(props.banks[0]?.id ?? "");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;

  const preview = useMemo(() => {
    const gross = Math.round(amt * asset.rateInr * 100) / 100;
    const fee = Math.round(((gross * props.platformFeeBps) / 10_000) * 100) / 100;
    const tds = Math.round((((gross - fee) * props.tdsBps) / 10_000) * 100) / 100;
    return { gross, fee, tds, net: Math.round((gross - fee - tds) * 100) / 100 };
  }, [amt, asset.rateInr, props.platformFeeBps, props.tdsBps]);

  function pickAsset(a: AssetInfo) {
    setAssetSymbol(a.symbol);
    setNetworkCode(defaultNetwork(a));
    setError(null);
  }

  async function refreshOrder(id: string): Promise<OrderView | null> {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as OrderView;
    setOrder(data);
    return data;
  }

  async function createQuote() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetSymbol, networkCode, cryptoAmount: amt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create quote");
      setBusy(false);
      return;
    }
    await refreshOrder(data.id);
    setStep("confirm");
    setBusy(false);
  }

  async function confirmOrder() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId: bankId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not confirm order");
      setBusy(false);
      return;
    }
    await refreshOrder(order.id);
    setStep("track");
    setBusy(false);
  }

  if (step === "amount") {
    return (
      <Card className="p-6">
        {/* Asset selector */}
        <Label>Asset</Label>
        <div className="grid grid-cols-4 gap-2.5">
          {props.assets.map((a) => {
            const icon = ASSET_ICON[a.symbol] ?? { glyph: a.symbol[0], classes: "bg-slate-800 text-slate-300 border-slate-700" };
            const active = a.symbol === assetSymbol;
            return (
              <button
                key={a.symbol}
                type="button"
                onClick={() => pickAsset(a)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                }`}
              >
                {a.featured && (
                  <span className="absolute -top-2 rounded-full border border-emerald-700/60 bg-emerald-950 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Popular
                  </span>
                )}
                <span className={`grid h-9 w-9 place-items-center rounded-full border text-lg font-bold ${icon.classes}`}>
                  {icon.glyph}
                </span>
                <span className={`text-sm font-semibold ${active ? "text-emerald-300" : "text-slate-200"}`}>{a.symbol}</span>
                <span className="text-[11px] text-slate-500">{a.rateInr > 0 ? inr(a.rateInr) : "—"}</span>
              </button>
            );
          })}
        </div>

        {/* Network selector — compact chips */}
        {asset.networks.length > 1 && network && (
          <div className="mt-5">
            <Label>Network</Label>
            <div className="flex flex-wrap gap-2">
              {asset.networks.map((n) => {
                const active = n.code === network.code;
                return (
                  <button
                    key={n.code}
                    type="button"
                    onClick={() => setNetworkCode(n.code)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                      active
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {n.code}
                    {n.recommended && <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock3 className="h-3 w-3" />
              {network.name} · ~{network.avgSettleMinutes} min settlement
              {network.feeNote ? ` · ${network.feeNote}` : ""}
            </p>
          </div>
        )}

        {/* Amount */}
        <div className="mt-5">
          <Label htmlFor="amount">Amount ({asset.symbol})</Label>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder={`Min ${asset.minSellAmount}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Live rate: {inr(asset.rateInr)} / {asset.symbol}
            {asset.networks.length > 1 && network ? ` · via ${network.name}` : ""}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <Row label="You send" value={amt > 0 ? `${amt} ${asset.symbol}` : "—"} />
          <Row label="Gross value" value={amt > 0 ? inr(preview.gross) : "—"} />
          <Row label={`Platform fee (${props.platformFeeBps / 100}%)`} value={amt > 0 ? `− ${inr(preview.fee)}` : "—"} />
          <Row label={`TDS u/s 194S (${props.tdsBps / 100}%)`} value={amt > 0 ? `− ${inr(preview.tds)}` : "—"} />
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-800 pt-3">
            <span className="text-sm font-medium text-slate-300">You receive</span>
            <span className="text-2xl font-semibold text-emerald-400">{amt > 0 ? inr(preview.net) : "—"}</span>
          </div>
        </div>

        {props.banks.length === 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
            <Landmark className="h-4 w-4 shrink-0" />
            <span>
              Add a bank account first so we know where to send your INR.{" "}
              <Link href="/dashboard/banks" className="font-medium underline underline-offset-2">
                Add bank account
              </Link>
            </span>
          </p>
        )}
        {error && <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={busy || amt < asset.minSellAmount || props.banks.length === 0 || asset.rateInr <= 0}
          onClick={createQuote}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {amt > 0 && amt < asset.minSellAmount ? `Minimum ${asset.minSellAmount} ${asset.symbol}` : "Lock rate for 10 minutes"}
        </Button>
      </Card>
    );
  }

  if (step === "confirm" && order) {
    const adjusted = amt > 0 && Number(order.crypto_amount) !== amt;
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Confirm your order</h2>
          <Countdown until={order.quote_expires_at} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <Row label="Order" value={order.reference} mono />
          <Row label="You send" value={`${order.crypto_amount} ${order.asset}`} />
          <Row label="Network" value={order.network?.name ?? "—"} />
          <Row label="Locked rate" value={`${inr(order.locked_rate_inr)} / ${order.asset}`} />
          <Row label="Platform fee" value={`− ${inr(order.platform_fee_inr)}`} />
          <Row label="TDS u/s 194S" value={`− ${inr(order.tds_inr)}`} />
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-800 pt-3">
            <span className="text-sm font-medium text-slate-300">You receive</span>
            <span className="text-2xl font-semibold text-emerald-400">{inr(order.net_inr)}</span>
          </div>
        </div>

        {adjusted && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            The amount includes a unique cent code ({order.crypto_amount}) that identifies your payment on the gateway
            wallet — you are paid for the full amount you send.
          </p>
        )}

        <div className="mt-5">
          <Label htmlFor="bank">Payout bank account</Label>
          <Select id="bank" value={bankId} onChange={(e) => setBankId(e.target.value)}>
            {props.banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} ····{b.accountNumber.slice(-4)} {b.isDefault ? "(default)" : ""}
              </option>
            ))}
          </Select>
        </div>

        {error && <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setStep("amount")} disabled={busy}>
            Back
          </Button>
          <Button className="flex-1" size="md" disabled={busy || !bankId} onClick={confirmOrder}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm &amp; show payment QR
          </Button>
        </div>
      </Card>
    );
  }

  if (step === "track" && order) {
    return <OrderTracker order={order} />;
  }

  return null;
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function Countdown({ until, label }: { until: string; label?: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(until).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [until]);
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm ${
        left < 120_000 ? "border-red-800/60 bg-red-950/40 text-red-300" : "border-slate-700 bg-slate-900 text-slate-300"
      }`}
    >
      <Clock3 className="h-3.5 w-3.5" />
      {label ? `${label} ` : ""}
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}

function CopyChip({ text, children, big = false }: { text: string; children: React.ReactNode; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-slate-200 transition-colors hover:border-emerald-600 ${
        big ? "px-4 py-2.5 text-lg font-semibold" : "px-3 py-2 text-[11px]"
      }`}
      title="Click to copy"
    >
      <span className="min-w-0 break-all text-left">{children}</span>
      {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <Copy className="h-4 w-4 shrink-0 text-slate-500" />}
    </button>
  );
}

/** Dynamic per-order QR encoding the gateway wallet address. */
function PaymentQr({ address, size = 168 }: { address: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(address, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#f8fafc" },
    })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [address, size]);
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-slate-50 bg-slate-50 shadow-lg shadow-emerald-950/40"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="Payment QR code" width={size} height={size} /> : <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
    </div>
  );
}

const STEPS = [
  { key: "payment", label: "Payment", icon: Wallet },
  { key: "confirm", label: "Blockchain", icon: ShieldCheck },
  { key: "payout", label: "INR payout", icon: IndianRupee },
  { key: "done", label: "Done", icon: CircleCheck },
] as const;

function stepIndex(status: string): number {
  switch (status) {
    case "AWAITING_DEPOSIT":
      return 0;
    case "DEPOSIT_DETECTED":
      return 1;
    case "DEPOSIT_CONFIRMED":
    case "PAYOUT_PROCESSING":
      return 2;
    case "COMPLETED":
      return 3;
    default:
      return 0;
  }
}

function PaymentStepper({ status }: { status: string }) {
  const failed = status === "FAILED" || status === "EXPIRED";
  const active = stepIndex(status);
  const completedAll = status === "COMPLETED";
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => {
        const done = completedAll || i < active;
        const current = !completedAll && i === active;
        const Icon = s.icon;
        return (
          <li key={s.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 && (
              <span
                className={`mx-2 h-px flex-1 ${done ? "bg-emerald-500" : failed && i <= active ? "bg-red-800" : "bg-slate-800"}`}
              />
            )}
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
                  failed && current
                    ? "border-red-700 bg-red-950/60 text-red-300"
                    : done
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : current
                        ? "animate-pulse-ring border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {failed && current ? <CircleX className="h-4.5 w-4.5" /> : done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  failed && current ? "text-red-300" : done || current ? "text-slate-200" : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTracker({ order: initial }: { order: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [simBusy, setSimBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const terminal = ["COMPLETED", "EXPIRED", "FAILED"].includes(order.status);

  useEffect(() => {
    if (terminal) return;
    timer.current = setInterval(async () => {
      const res = await fetch(`/api/orders/${order.id}`);
      if (res.ok) setOrder(await res.json());
    }, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [order.id, terminal]);

  async function simulate() {
    setSimBusy(true);
    await fetch(`/api/orders/${order.id}/simulate-deposit`, { method: "POST" });
    const res = await fetch(`/api/orders/${order.id}`);
    if (res.ok) setOrder(await res.json());
    setSimBusy(false);
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">{order.reference}</p>
          <h2 className="mt-1 font-semibold text-slate-100">
            Sell {order.crypto_amount} {order.asset} → {inr(order.net_inr)}
          </h2>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-6">
        <PaymentStepper status={order.status} />
      </div>

      {order.status === "AWAITING_DEPOSIT" && order.deposit_address && (
        <div className="mt-6 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <ScanLine className="h-5 w-5 text-emerald-400" />
              Waiting for {order.asset} payment
            </h3>
            <Countdown until={order.quote_expires_at} />
          </div>

          <div className="mt-5 flex items-start gap-6">
            <PaymentQr address={order.deposit_address} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Send exactly</p>
                <div className="mt-1">
                  <CopyChip text={order.crypto_amount} big>
                    {order.crypto_amount} <span className="text-emerald-400">{order.asset}</span>
                  </CopyChip>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  To this address · <span className="text-emerald-400">{order.network?.name}</span>
                </p>
                <div className="mt-1">
                  <CopyChip text={order.deposit_address}>{order.deposit_address}</CopyChip>
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs text-amber-300/90">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Send at least the exact amount on {order.network?.name}. If you send more, the full received amount
                is credited at your locked rate. Sending less cannot be matched to your order.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-emerald-900/40 pt-4">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              {order.network?.live ? (
                <span>
                  <span className="font-semibold text-emerald-300">LIVE</span> — watching the real{" "}
                  {order.network.code} blockchain. Your payment confirms automatically once it lands on-chain.
                </span>
              ) : (
                <span>Watching {order.network?.code} — confirms automatically once the blockchain sees your transfer.</span>
              )}
            </p>
            {!order.network?.live && (
              <Button variant="ghost" size="sm" onClick={simulate} disabled={simBusy}>
                {simBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                I&apos;ve sent it
              </Button>
            )}
          </div>
        </div>
      )}

      {order.status === "DEPOSIT_DETECTED" && (
        <div className="mt-6 rounded-xl border border-blue-800/50 bg-blue-950/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
              <div>
                <p className="text-sm font-medium text-slate-100">Transfer detected — confirming on-chain</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {order.confirmations} of {order.confirmations_required ?? "?"} confirmations
                </p>
              </div>
            </div>
            <span className="font-mono text-lg font-semibold text-blue-300">
              {order.confirmations}/{order.confirmations_required ?? "?"}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-400 transition-all duration-700"
              style={{
                width: `${Math.min(100, (order.confirmations / Math.max(1, order.confirmations_required ?? 1)) * 100)}%`,
              }}
            />
          </div>
          {order.deposit_tx_hash && (
            <p className="mt-3 break-all font-mono text-[11px] text-slate-500">tx: {order.deposit_tx_hash}</p>
          )}
        </div>
      )}

      {(order.status === "DEPOSIT_CONFIRMED" || order.status === "PAYOUT_PROCESSING") && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-violet-800/50 bg-violet-950/20 p-5">
          <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
          <p className="text-sm text-slate-200">
            Blockchain confirmed your payment. IMPS payout of {inr(order.net_inr)} is on its way to your bank.
          </p>
        </div>
      )}

      {order.status === "COMPLETED" && (
        <div className="mt-6 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-6 text-center">
          <CircleCheck className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 text-lg font-semibold text-slate-100">{inr(order.net_inr)} credited</p>
          <p className="mt-1 text-sm text-slate-400">
            IMPS UTR: <span className="font-mono text-slate-300">{order.payout?.utr}</span>
          </p>
          <Link href="/dashboard/sell" className="mt-5 inline-block">
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Sell more
            </Button>
          </Link>
        </div>
      )}

      {(order.status === "EXPIRED" || order.status === "FAILED") && (
        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-center">
          <CircleX className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-lg font-semibold text-red-300">
            {order.status === "FAILED" ? "Payment failed" : "Quote expired"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
            {order.status === "FAILED"
              ? `No ${order.asset} transfer was confirmed by the blockchain within the payment window. If you already sent it, contact support with your transaction hash — your funds are safe on-chain.`
              : "The rate lock ran out before the order was confirmed."}
          </p>
          <Link href="/dashboard/sell" className="mt-5 inline-block">
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Start a new order
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-300">Timeline</h3>
        <ol className="mt-3 space-y-3 border-l border-slate-800 pl-4">
          {order.events.map((e, i) => (
            <li key={i} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                  e.status === "FAILED" || e.status === "EXPIRED" ? "bg-red-500" : "bg-emerald-500"
                }`}
              />
              <p className="text-sm text-slate-300">{e.message}</p>
              <p className="text-xs text-slate-500">{new Date(e.at).toLocaleString("en-IN")}</p>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
