"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Check,
  CircleCheck,
  CircleX,
  Loader2,
  Clock3,
  TriangleAlert,
  ShieldCheck,
} from "lucide-react";

type PaymentView = {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  network: string | null;
  network_name: string | null;
  confirmations: number;
  confirmations_required: number | null;
  tx_hash: string | null;
  order_description: string | null;
  expiration_estimate_date: string;
  events: { status: string; message: string; at: string }[];
};

type NetworkOpt = { code: string; name: string; avgSettleMinutes: number; recommended: boolean };

const STEPS = ["waiting", "confirming", "confirmed", "finished"] as const;
const STEP_LABEL: Record<string, string> = {
  waiting: "Payment",
  confirming: "Confirming",
  confirmed: "Confirmed",
  finished: "Done",
};

function stepIndex(status: string) {
  switch (status) {
    case "waiting":
      return 0;
    case "confirming":
      return 1;
    case "confirmed":
    case "sending":
      return 2;
    case "finished":
      return 3;
    default:
      return 0;
  }
}

const money = (n: number, cur: string) =>
  cur.toUpperCase() === "INR"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
    : `${n} ${cur.toUpperCase()}`;

export function Checkout({
  merchantName,
  brandColor,
  token,
  networks,
  initial,
}: {
  merchantName: string;
  brandColor: string;
  token: string;
  networks: NetworkOpt[];
  initial: PaymentView;
}) {
  const [p, setP] = useState(initial);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const terminal = ["finished", "expired", "failed", "refunded", "partially_paid"].includes(p.payment_status);

  useEffect(() => {
    if (terminal) return;
    timer.current = setInterval(async () => {
      const res = await fetch(`/api/pay/${token}`);
      if (res.ok) setP(await res.json());
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [token, terminal]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-5 text-center">
        <div
          className="mx-auto grid h-11 w-11 place-items-center rounded-xl text-lg font-bold text-slate-950"
          style={{ background: brandColor }}
        >
          {merchantName.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-3 text-lg font-semibold text-slate-100">{merchantName}</h1>
        {p.order_description && <p className="mt-0.5 text-sm text-slate-400">{p.order_description}</p>}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-400">Amount due</span>
          <span className="text-2xl font-semibold text-slate-100">
            {money(p.price_amount, p.price_currency)}
          </span>
        </div>

        <div className="mt-5">
          <Stepper status={p.payment_status} brandColor={brandColor} />
        </div>

        {p.payment_status === "waiting" && (
          <div className="mt-6">
            <div className="flex flex-col items-center">
              <Qr text={p.pay_address} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                <Countdown until={p.expiration_estimate_date} />
                left to pay
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <Field label="Send exactly">
                <button
                  onClick={() => copy(String(p.pay_amount), "amt")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-left font-mono text-base font-semibold text-slate-100 hover:border-slate-500"
                >
                  <span>
                    {p.pay_amount} <span style={{ color: brandColor }}>USDT</span>
                  </span>
                  {copied === "amt" ? (
                    <Check className="h-4 w-4" style={{ color: brandColor }} />
                  ) : (
                    <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                </button>
              </Field>

              <Field label={`To this address · ${p.network_name ?? ""}`}>
                <button
                  onClick={() => copy(p.pay_address, "addr")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-left font-mono text-[11px] text-slate-200 hover:border-slate-500"
                >
                  <span className="min-w-0 break-all">{p.pay_address}</span>
                  {copied === "addr" ? (
                    <Check className="h-4 w-4 shrink-0" style={{ color: brandColor }} />
                  ) : (
                    <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                </button>
              </Field>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Send only USDT on {p.network_name}. Sending a different asset or using another network means the
              funds cannot be credited.
            </p>

            {networks.length > 1 && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Also accepted: {networks.map((n) => n.code).join(" · ")}
              </p>
            )}
          </div>
        )}

        {(p.payment_status === "confirming" || p.payment_status === "confirmed" || p.payment_status === "sending") && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: brandColor }} />
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {p.payment_status === "confirming"
                    ? "Confirming on the blockchain"
                    : p.payment_status === "confirmed"
                      ? "Confirmed — finalising"
                      : "Crediting the merchant"}
                </p>
                {p.confirmations_required != null && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {p.confirmations} of {p.confirmations_required} confirmations
                  </p>
                )}
              </div>
            </div>
            {p.confirmations_required != null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (p.confirmations / Math.max(1, p.confirmations_required)) * 100)}%`,
                    background: brandColor,
                  }}
                />
              </div>
            )}
            {p.tx_hash && <p className="mt-3 break-all font-mono text-[11px] text-slate-500">tx: {p.tx_hash}</p>}
          </div>
        )}

        {p.payment_status === "finished" && (
          <div className="mt-6 rounded-xl border p-6 text-center" style={{ borderColor: brandColor + "66", background: brandColor + "14" }}>
            <CircleCheck className="mx-auto h-10 w-10" style={{ color: brandColor }} />
            <p className="mt-3 text-lg font-semibold text-slate-100">Payment received</p>
            <p className="mt-1 text-sm text-slate-400">
              {p.pay_amount} USDT confirmed. You can close this page.
            </p>
          </div>
        )}

        {p.payment_status === "partially_paid" && (
          <div className="mt-6 rounded-xl border border-amber-800/60 bg-amber-950/30 p-6 text-center">
            <TriangleAlert className="mx-auto h-9 w-9 text-amber-400" />
            <p className="mt-3 font-semibold text-amber-200">Underpaid</p>
            <p className="mt-1 text-sm text-slate-400">
              We received {p.actually_paid} of {p.pay_amount} USDT. Contact {merchantName} to resolve it.
            </p>
          </div>
        )}

        {(p.payment_status === "expired" || p.payment_status === "failed") && (
          <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-center">
            <CircleX className="mx-auto h-9 w-9 text-red-400" />
            <p className="mt-3 font-semibold text-red-300">
              {p.payment_status === "expired" ? "Payment window closed" : "Payment failed"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              No transfer was confirmed in time. Refresh this page to start a new payment.
            </p>
          </div>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secured by MatrixGateway · Payment {p.payment_id}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function Stepper({ status, brandColor }: { status: string; brandColor: string }) {
  const failed = ["expired", "failed", "partially_paid"].includes(status);
  const active = stepIndex(status);
  const done = status === "finished";
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => {
        const complete = done || i < active;
        const current = !done && i === active;
        return (
          <li key={s} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 && (
              <span
                className="mx-1.5 h-px flex-1"
                style={{ background: complete ? brandColor : "#1e293b" }}
              />
            )}
            <span className="flex flex-col items-center gap-1">
              <span
                className="grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold"
                style={
                  failed && current
                    ? { borderColor: "#7f1d1d", background: "#450a0a", color: "#fca5a5" }
                    : complete || current
                      ? { borderColor: brandColor, background: brandColor + "26", color: brandColor }
                      : { borderColor: "#334155", background: "#0f172a", color: "#64748b" }
                }
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-[10px] ${complete || current ? "text-slate-300" : "text-slate-600"}`}>
                {STEP_LABEL[s]}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(text, { width: 200, margin: 1, color: { dark: "#0f172a", light: "#f8fafc" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [text]);
  return (
    <div className="grid h-[200px] w-[200px] place-items-center overflow-hidden rounded-xl border-4 border-slate-50 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="Payment QR code" width={200} height={200} /> : <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
    </div>
  );
}

function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(until).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [until]);
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <span className={`font-mono ${left < 120_000 ? "text-red-400" : "text-slate-300"}`}>
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}
