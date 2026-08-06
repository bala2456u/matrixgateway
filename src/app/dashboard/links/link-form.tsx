"use client";

import { useActionState, useState, useTransition } from "react";
import { createPaymentLink, deletePaymentLink, type ActionResult } from "../actions";
import { Button, Input, Label, Select } from "@/components/ui";
import { Loader2, Copy, Check, Trash2, ExternalLink } from "lucide-react";

export function LinkForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPaymentLink, null);

  return (
    <div>
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <div>
            <Label htmlFor="priceAmount">Amount</Label>
            <Input id="priceAmount" name="priceAmount" inputMode="decimal" required placeholder="1500" />
          </div>
          <div>
            <Label htmlFor="priceCurrency">Currency</Label>
            <Select id="priceCurrency" name="priceCurrency" defaultValue="INR">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="orderDescription">Description (shown to the customer)</Label>
          <Input id="orderDescription" name="orderDescription" placeholder="Order #1234 — Premium plan" />
        </div>
        <div>
          <Label htmlFor="orderId">Your order ID (optional)</Label>
          <Input id="orderId" name="orderId" placeholder="1234" />
        </div>
        {state && !state.ok && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create link
        </Button>
      </form>

      {state?.ok && state.url && (
        <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4">
          <p className="text-xs font-medium text-emerald-300">Payment link ready — share this with your customer:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
              {state.url}
            </code>
            <CopyLink url={state.url} />
            <a href={state.url} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export function DeleteLinkButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      title="Delete link"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deletePaymentLink(id)))}
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
