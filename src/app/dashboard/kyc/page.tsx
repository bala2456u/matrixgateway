import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, KycStatusBadge } from "@/components/ui";
import { KycForm } from "./kyc-form";

export const dynamic = "force-dynamic";

export default async function KycPage() {
  const user = await requireUser();
  const profile = await prisma.kycProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">KYC verification</h1>
        <KycStatusBadge status={user.kycStatus} />
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Required under the Prevention of Money Laundering Act (PMLA) for all VDA transactions.
      </p>

      {user.kycStatus === "VERIFIED" && profile ? (
        <Card className="mt-6">
          <CardHeader title="Verified identity" subtitle="Your identity has been verified. You can sell crypto." />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 text-sm">
            <Item label="PAN" value={profile.panNumber} />
            <Item label="Aadhaar" value={`XXXX XXXX ${profile.aadhaarLast4}`} />
            <Item label="Date of birth" value={profile.dateOfBirth.toLocaleDateString("en-IN")} />
            <Item label="City" value={`${profile.city}, ${profile.state} ${profile.pincode}`} />
          </dl>
        </Card>
      ) : user.kycStatus === "PENDING" ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-300">
            Your documents are under review. This usually takes a few minutes in sandbox — an admin approves it from the
            admin panel.
          </p>
        </Card>
      ) : (
        <>
          {user.kycStatus === "REJECTED" && profile?.rejectReason && (
            <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              Rejected: {profile.rejectReason}. Please correct and resubmit.
            </p>
          )}
          <Card className="mt-6 p-6">
            <KycForm />
          </Card>
        </>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}
