import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader } from "@/components/ui";
import { PaymentStatusBadge, usdt } from "@/components/payment-status";
import { Users, CreditCard, Coins, Clock, TrendingUp, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireAdmin();

  const since = new Date(Date.now() - 13 * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [merchants, finished, pending, failed, feeAgg, recent, daily, asset] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.payment.aggregate({ where: { status: "FINISHED" }, _sum: { payAmount: true }, _count: true }),
    prisma.payment.count({ where: { status: { in: ["WAITING", "CONFIRMING", "CONFIRMED", "SENDING"] } } }),
    prisma.payment.count({ where: { status: { in: ["EXPIRED", "FAILED", "PARTIALLY_PAID"] } } }),
    prisma.payment.aggregate({ where: { status: "FINISHED" }, _sum: { serviceFee: true } }),
    prisma.payment.findMany({
      include: { network: true, merchant: { select: { email: true, businessName: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.payment.findMany({
      where: { status: "FINISHED", paidAt: { gte: since } },
      select: { paidAt: true, payAmount: true },
    }),
    prisma.asset.findUnique({ where: { symbol: "USDT" } }),
  ]);

  const { rates } = await getRates(asset ? [asset.coingeckoId] : []);
  const usdtInr = asset ? rates[asset.coingeckoId] : undefined;

  // 14-day volume series
  const buckets: { day: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    buckets.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, total: 0 });
  }
  for (const p of daily) {
    if (!p.paidAt) continue;
    const idx = 13 - Math.floor((Date.now() - p.paidAt.getTime()) / 86_400_000);
    if (idx >= 0 && idx < 14) buckets[idx].total += Number(p.payAmount);
  }
  const peak = Math.max(1, ...buckets.map((b) => b.total));

  const volume = Number(finished._sum.payAmount ?? 0);
  const revenue = Number(feeAgg._sum.serviceFee ?? 0);

  const stats = [
    { icon: Users, label: "Merchants", value: String(merchants), href: "/admin/merchants" },
    { icon: CreditCard, label: "Payments settled", value: String(finished._count), href: "/admin/payments" },
    { icon: Coins, label: "Volume processed", value: usdt(volume), sub: usdtInr ? formatInr(volume * usdtInr) : undefined },
    { icon: TrendingUp, label: "Fee revenue", value: usdt(revenue), sub: usdtInr ? formatInr(revenue * usdtInr) : undefined },
    { icon: Clock, label: "In progress", value: String(pending) },
    { icon: AlertTriangle, label: "Failed / expired", value: String(failed) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Platform overview</h1>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value, sub, href }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Icon className="h-4 w-4" />
              {href ? (
                <Link href={href} className="text-sm hover:text-emerald-300">
                  {label} →
                </Link>
              ) : (
                <span className="text-sm">{label}</span>
              )}
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
            {sub && <p className="text-xs text-slate-500">≈ {sub}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Settled volume" subtitle="Last 14 days, USDT" />
        <div className="px-6 py-6">
          <div className="flex h-40 items-end gap-1.5">
            {buckets.map((b) => (
              <div key={b.day} className="group relative flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t bg-emerald-500/70 transition-colors group-hover:bg-emerald-400"
                  style={{ height: `${Math.max(2, (b.total / peak) * 100)}%` }}
                  title={`${b.day}: ${b.total.toFixed(2)} USDT`}
                />
                <span className="text-[9px] text-slate-600">{b.day}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Peak day: {peak.toFixed(2)} USDT</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent payments"
          action={
            <Link href="/admin/payments" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          }
        />
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No payments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/70 last:border-0">
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">{p.paymentId}</td>
                  <td className="px-3 py-3 text-slate-400">
                    {p.merchant.businessName ?? p.merchant.email}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-300">{usdt(p.payAmount)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{p.network.code}</td>
                  <td className="px-6 py-3 text-right">
                    <PaymentStatusBadge status={p.status} />
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
