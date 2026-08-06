"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addBank, deleteBank, type ActionResult } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Loader2, Trash2, CircleCheck } from "lucide-react";

export function BankForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addBank, null);
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  // Auto-fetch bank + branch as soon as a complete IFSC is typed
  useEffect(() => {
    const code = ifsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setBranch(null);
      return;
    }
    let cancelled = false;
    setLooking(true);
    fetch(`/api/ifsc/${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.bank) setBankName(data.bank);
        setBranch(data.branch ? `${data.branch}${data.city ? ", " + data.city : ""}` : null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLooking(false));
    return () => {
      cancelled = true;
    };
  }, [ifsc]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="accountHolder">Account holder name</Label>
          <Input id="accountHolder" name="accountHolder" required placeholder="As per bank records" />
        </div>
        <div>
          <Label htmlFor="accountNumber">Account number</Label>
          <Input id="accountNumber" name="accountNumber" required inputMode="numeric" placeholder="XXXXXXXXXXXX" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ifsc">IFSC code</Label>
          <div className="relative">
            <Input
              id="ifsc"
              name="ifsc"
              required
              placeholder="HDFC0001234"
              maxLength={11}
              className="uppercase"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            />
            {looking && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-500" />}
          </div>
          {branch && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-400">
              <CircleCheck className="h-3.5 w-3.5" /> {branch}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="bankName">Bank name <span className="font-normal text-slate-500">— auto-filled from IFSC</span></Label>
          <Input
            id="bankName"
            name="bankName"
            required
            placeholder="Auto-detected"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="upiId">UPI ID (optional)</Label>
        <Input id="upiId" name="upiId" placeholder="name@okhdfcbank" />
      </div>
      {state && !state.ok && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Add account
      </Button>
    </form>
  );
}

export function DeleteBankButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      title="Remove account"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteBank(id)))}
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
