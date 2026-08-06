"use client";

import { useTransition } from "react";
import { setMerchantEnabled } from "../actions";
import { Button } from "@/components/ui";
import { Loader2 } from "lucide-react";

export function MerchantToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={enabled ? "danger" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await setMerchantEnabled(id, !enabled)))}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? "Suspend" : "Reinstate"}
    </Button>
  );
}
