"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMerchantProfile, rotateIpnSecret, type ActionResult } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Loader2, Copy, Check, CircleCheck, RefreshCw } from "lucide-react";

export function ProfileForm({ businessName, brandColor }: { businessName: string; brandColor: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveMerchantProfile, null);
  const [color, setColor] = useState(brandColor);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" name="businessName" defaultValue={businessName} placeholder="Acme Pvt Ltd" />
      </div>
      <div>
        <Label htmlFor="brandColor">Brand colour</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-slate-700 bg-slate-900"
            aria-label="Pick brand colour"
          />
          <Input
            id="brandColor"
            name="brandColor"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>
      {state && !state.ok && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400">
          <CircleCheck className="h-4 w-4" /> Saved
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save profile
      </Button>
    </form>
  );
}

export function IpnSecretPanel({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="text-sm text-slate-400">
        {configured
          ? "A secret is set. Generating a new one immediately invalidates the old one."
          : "Generate a secret to start receiving signed IPN callbacks."}
      </p>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await rotateIpnSecret();
            if (res.ok && res.secret) setSecret(res.secret);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {configured ? "Generate new secret" : "Generate secret"}
      </Button>

      {secret && (
        <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4">
          <p className="text-xs font-medium text-emerald-300">Shown once — store it now:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
              {secret}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
