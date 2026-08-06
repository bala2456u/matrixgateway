import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
      <div>
        <h2 className="font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400",
    secondary:
      "border border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
    danger: "border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40",
    ghost: "text-slate-300 hover:bg-slate-800/70",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-300">
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-500 ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    emerald: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
    amber: "bg-amber-950/60 text-amber-300 border-amber-800/60",
    blue: "bg-blue-950/60 text-blue-300 border-blue-800/60",
    violet: "bg-violet-950/60 text-violet-300 border-violet-800/60",
    red: "bg-red-950/60 text-red-300 border-red-800/60",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export const ORDER_STATUS_META: Record<string, { label: string; tone: string }> = {
  QUOTE: { label: "Quote", tone: "slate" },
  AWAITING_DEPOSIT: { label: "Awaiting deposit", tone: "amber" },
  DEPOSIT_DETECTED: { label: "Deposit detected", tone: "blue" },
  DEPOSIT_CONFIRMED: { label: "Deposit confirmed", tone: "violet" },
  PAYOUT_PROCESSING: { label: "Payout processing", tone: "violet" },
  COMPLETED: { label: "Completed", tone: "emerald" },
  EXPIRED: { label: "Expired", tone: "slate" },
  FAILED: { label: "Failed", tone: "red" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: "slate" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export const KYC_STATUS_META: Record<string, { label: string; tone: string }> = {
  NOT_SUBMITTED: { label: "Not submitted", tone: "slate" },
  PENDING: { label: "Under review", tone: "amber" },
  VERIFIED: { label: "Verified", tone: "emerald" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export function KycStatusBadge({ status }: { status: string }) {
  const meta = KYC_STATUS_META[status] ?? { label: status, tone: "slate" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
