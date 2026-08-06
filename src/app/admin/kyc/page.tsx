import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, KycStatusBadge } from "@/components/ui";
import { KycReviewButtons } from "./review-buttons";

export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  await requireAdmin();
  const profiles = await prisma.kycProfile.findMany({
    include: { user: { select: { email: true, fullName: true, phone: true } } },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    take: 100,
  });
  const pending = profiles.filter((p) => p.status === "PENDING");
  const reviewed = profiles.filter((p) => p.status !== "PENDING");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">KYC queue</h1>

      <Card>
        <CardHeader title="Pending review" subtitle={`${pending.length} application(s) awaiting a decision`} />
        {pending.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Queue is clear.</p>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {pending.map((p) => (
              <li key={p.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-medium text-slate-200">{p.user.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {p.user.email}
                      {p.user.phone ? ` · ${p.user.phone}` : ""}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <dt className="text-slate-500">PAN:</dt>
                        <dd className="font-mono text-slate-300">{p.panNumber}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-slate-500">Aadhaar:</dt>
                        <dd className="font-mono text-slate-300">XXXX {p.aadhaarLast4}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-slate-500">DOB:</dt>
                        <dd className="text-slate-300">{p.dateOfBirth.toLocaleDateString("en-IN")}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-slate-500">Address:</dt>
                        <dd className="text-slate-300">
                          {p.addressLine}, {p.city}, {p.state} {p.pincode}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <KycReviewButtons profileId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Recently reviewed" />
        {reviewed.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Nothing reviewed yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {reviewed.slice(0, 20).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-3.5">
                <div>
                  <p className="text-sm text-slate-300">{p.user.fullName}</p>
                  <p className="text-xs text-slate-500">{p.user.email}</p>
                </div>
                <KycStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
