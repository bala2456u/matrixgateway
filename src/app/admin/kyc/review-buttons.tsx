"use client";

import { useState, useTransition } from "react";
import { approveKyc, rejectKyc } from "../actions";
import { Button, Input } from "@/components/ui";
import { Loader2 } from "lucide-react";

export function KycReviewButtons({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (rejecting) {
    return (
      <div className="flex w-72 flex-col gap-2">
        <Input
          placeholder="Reason for rejection"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => startTransition(() => rejectKyc(profileId, reason))}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm reject"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="danger" size="sm" onClick={() => setRejecting(true)} disabled={pending}>
        Reject
      </Button>
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => approveKyc(profileId))}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
      </Button>
    </div>
  );
}
