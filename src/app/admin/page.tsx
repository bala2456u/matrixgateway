import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, OrderStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireAdmin();

  const [userCount, kycPending, volumeAgg, feeAgg, tdsAgg, active, recent] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.kycProfile.count({ where: { status: "PENDING" } }),
    prisma.sellOrder.aggregate({ where: { status: "COMPLETED" }, _sum: { grossInr: true }, _count: true }),
    prisma.sellOrder.aggregate({ where: { status: "COMPLETED" }, _sum: { platformFeeInr: true } }),
    prisma.sellOrder.aggregate({ where: { status: "COMPLETED" }, _sum: { tdsInr: true } }),
    prisma.sellOrder.count({
      where: { status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED", "PAYOUT_PROCESSING"] } },
    }),
    prisma.sellOrder.findMany({
      include: { asset: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Customers", value: String(userCount) },
    { label: "KYC pending", value: String(kycPending), href: "/admin/kyc" },
    { label: "Completed volume", value: formatInr(Number(volumeAgg._sum.grossInr ?? 0)) },
    { label: "Fee revenue", value: formatInr(Number(feeAgg._sum.platformFeeInr ?? 0)) },
    { label: "TDS withheld", value: formatInr(Number(tdsAgg._sum.tdsInr ?? 0)) },
    { label: "Active orders", value: String(active) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Platform overview</h1>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-slate-400">
              {s.href ? (
                <Link href={s.href} className="hover:text-emerald-300">
                  {s.label} →
                </Link>
              ) : (
                s.label
              )}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Recent orders" />
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/70 last:border-0">
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">{o.reference}</td>
                  <td className="px-3 py-3 text-slate-400">{o.user.email}</td>
                  <td className="px-3 py-3 text-slate-200">
                    {String(o.cryptoAmount)} {o.asset.symbol}
                  </td>
                  <td className="px-3 py-3 text-slate-200">{formatInr(Number(o.netInr))}</td>
                  <td className="px-6 py-3 text-right">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
