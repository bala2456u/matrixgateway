"use client";

import { useState, useTransition } from "react";
import { reconcileOrder } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Loader2, CircleCheck, Link2 } from "lucide-react";

export function ReconcileForm() {
  const [reference, setReference] = useState("");
  const [txHash, setTxHash] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string; amount?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
        <div>
          <Label htmlFor="rec-ref">Order reference</Label>
          <Input
            id="rec-ref"
            placeholder="MG-20260806-XXXXXX"
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label htmlFor="rec-tx">Transaction hash</Label>
          <Input
            id="rec-tx"
            placeholder="0x…"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value.trim())}
            className="font-mono text-xs"
          />
        </div>
        <Button
          disabled={pending || !reference || !txHash}
          onClick={() =>
            startTransition(async () => {
              setResult(null);
              setResult(await reconcileOrder(reference, txHash));
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Verify &amp; match
        </Button>
      </div>
      {result && !result.ok && (
        <p className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <CircleCheck className="h-4 w-4" />
          Verified on-chain: {result.amount} received. Order corrected and settling with real confirmations.
        </p>
      )}
    </div>
  );
}
