"use client";

import { useActionState } from "react";
import { submitKyc, type ActionResult } from "../actions";
import { Button, Input, Label } from "@/components/ui";
import { Loader2 } from "lucide-react";

export function KycForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitKyc, null);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="panNumber">PAN number</Label>
          <Input id="panNumber" name="panNumber" required placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
        </div>
        <div>
          <Label htmlFor="aadhaarLast4">Aadhaar (last 4 digits)</Label>
          <Input id="aadhaarLast4" name="aadhaarLast4" required inputMode="numeric" maxLength={4} placeholder="1234" />
        </div>
      </div>
      <div>
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
      </div>
      <div>
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" required placeholder="Flat / street / locality" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required placeholder="Chennai" />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" required placeholder="Tamil Nadu" />
        </div>
        <div>
          <Label htmlFor="pincode">PIN code</Label>
          <Input id="pincode" name="pincode" required inputMode="numeric" maxLength={6} placeholder="600001" />
        </div>
      </div>
      {state && !state.ok && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{state.error}</p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit for verification
      </Button>
      <p className="text-center text-xs text-slate-500">
        Sandbox note: documents are not uploaded; verification is approved from the admin panel.
      </p>
    </form>
  );
}
