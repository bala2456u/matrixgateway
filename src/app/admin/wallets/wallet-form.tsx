"use client";

import { useState, useTransition } from "react";
import { setGatewayWallet } from "../actions";
import { Button, Input, Badge } from "@/components/ui";
import { Loader2, Check } from "lucide-react";

const PLACEHOLDERS: Record<string, string> = {
  TRON: "T…  (34 characters)",
  EVM: "0x…  (42 characters)",
  SOLANA: "Base58 address",
  BITCOIN: "bc1… / 1… / 3…",
};

export function WalletForm({
  networkId,
  label,
  addressFamily,
  current,
}: {
  networkId: string;
  label: string;
  addressFamily: string;
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = value.trim() !== (current ?? "");

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {current ? <Badge tone="emerald">Configured</Badge> : <Badge tone="amber">Sandbox fallback</Badge>}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder={PLACEHOLDERS[addressFamily] ?? "Wallet address"}
          className="flex-1 font-mono text-xs"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await setGatewayWallet(networkId, value);
              if (!res.ok) setError(res.error ?? "Could not save");
              else setSaved(true);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !dirty ? <Check className="h-4 w-4 text-emerald-400" /> : "Save"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}
