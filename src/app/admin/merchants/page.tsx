import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, KycStatusBadge } from "@/components/ui";
import { usdt } from "@/components/payment-status";
import { MerchantToggle } from "./merchant-toggle";

export const dynamic = "force-dynamic";

export default async function AdminMerchantsPage() {
  await requireAdmin();

  const merchants = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    include: {
      _count: { select: { payments: true, invoices: true, apiKeys: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Settled volume per merchant
  const volumes = await prisma.payment.groupBy({
    by: ["merchantId"],
    where: { status: "FINISHED" },
    _sum: { payAmount: true, serviceFee: true },
  });
  const volMap = new Map(volumes.map((v) => [v.merchantId, v]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-100">Merchants</h1>
      <p className="mt-1 text-sm text-slate-400">Everyone accepting payments through the gateway.</p>

      <Card className="mt-6">
        <CardHeader title="All merchants" subtitle={`${merchants.length} account(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Business</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Payments</th>
                <th className="px-3 py-3 font-medium">Volume</th>
                <th className="px-3 py-3 font-medium">Fees earned</th>
                <th className="px-3 py-3 font-medium">Keys</th>
                <th className="px-3 py-3 font-medium">Joined</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => {
                const v = volMap.get(m.id);
                return (
                  <tr key={m.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60">
                    <td className="px-6 py-3 text-slate-200">{m.businessName ?? m.fullName}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{m.email}</td>
                    <td className="px-3 py-3 text-slate-300">{m._count.payments}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-300">
                      {usdt(Number(v?._sum.payAmount ?? 0))}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-emerald-300">
                      {usdt(Number(v?._sum.serviceFee ?? 0))}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{m._count.apiKeys}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{m.createdAt.toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-3">
                      <KycStatusBadge status={m.kycStatus} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <MerchantToggle id={m.id} enabled={m.kycStatus !== "REJECTED"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
