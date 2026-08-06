"use client";

import { useActionState } from "react";
import { savePlatformSettings } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Loader2, CircleCheck } from "lucide-react";

const FIELDS = [
  {
    key: "service_fee_bps",
    label: "Service fee (basis points)",
    hint: "50 = 0.5% taken from each settled payment",
  },
  {
    key: "payment_window_minutes",
    label: "Payment window (minutes)",
    hint: "How long a customer has to get their transfer on-chain before it expires",
  },
  {
    key: "min_payment_usdt",
    label: "Minimum payment (USDT)",
    hint: "Payments below this are rejected at creation",
  },
  {
    key: "underpayment_tolerance_bps",
    label: "Underpayment tolerance (basis points)",
    hint: "100 = accept anything within 1% of the expected amount as fully paid",
  },
] as const;

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action, pending] = useActionState<{ ok: boolean; error?: string } | null, FormData>(
    savePlatformSettings,
    null
  );

  return (
    <form action={action} className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input id={f.key} name={f.key} defaultValue={settings[f.key]} inputMode="decimal" />
          <p className="mt-1 text-xs text-slate-500">{f.hint}</p>
        </div>
      ))}

      {state && !state.ok && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400">
          <CircleCheck className="h-4 w-4" /> Settings saved
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save settings
      </Button>
    </form>
  );
}
