"use client";

import { useActionState, useTransition, useState } from "react";
import { createApiKey, revokeApiKey, addWebhook, deleteWebhook, type ActionResult } from "../actions";
import { Button, Input } from "@/components/ui";
import { Loader2, Trash2, Copy, Check } from "lucide-react";

function SecretReveal({ secret, label }: { secret: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4">
      <p className="text-xs font-medium text-emerald-300">{label} — shown only once, store it safely:</p>
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
  );
}

export function CreateKeyForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createApiKey, null);
  return (
    <div>
      <form action={action} className="flex gap-3">
        <Input name="label" placeholder="Key label (e.g. Production server)" className="flex-1" />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create key
        </Button>
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
      {state?.ok && state.secret && <SecretReveal secret={state.secret} label="API key" />}
    </div>
  );
}

export function RevokeKeyButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="danger" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await revokeApiKey(id)))}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
    </Button>
  );
}

export function AddWebhookForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addWebhook, null);
  return (
    <div>
      <form action={action} className="flex gap-3">
        <Input name="url" type="url" placeholder="https://yourapp.com/webhooks/matrixgateway" className="flex-1" />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add endpoint
        </Button>
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
      {state?.ok && state.secret && <SecretReveal secret={state.secret} label="Webhook signing secret" />}
    </div>
  );
}

export function DeleteWebhookButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      title="Delete endpoint"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteWebhook(id)))}
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
