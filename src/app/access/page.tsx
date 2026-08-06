"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Card, Button, Input, Label } from "@/components/ui";
import { LockKeyhole } from "lucide-react";

function AccessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const code = new FormData(e.currentTarget).get("code");
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Incorrect access code");
      setBusy(false);
      return;
    }
    router.push(params.get("next") ?? "/");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <LockKeyhole className="h-7 w-7 text-emerald-400" />
      <h1 className="mt-4 text-xl font-semibold text-slate-100">Private preview</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        MatrixGateway is in closed testing. Enter your access code to continue.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="code">Access code</Label>
          <Input id="code" name="code" type="password" required autoFocus placeholder="••••••••" />
        </div>
        {error && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Checking…" : "Enter"}
        </Button>
      </form>
    </Card>
  );
}

export default function AccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <AccessForm />
        </Suspense>
      </div>
    </div>
  );
}
