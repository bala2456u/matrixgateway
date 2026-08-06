import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { getSettings } from "@/lib/settings";
import { merchantBalance } from "@/lib/payments";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, Button } from "@/components/ui";
import { PaymentStatusBadge, usdt } from "@/components/payment-status";
import { ArrowRight, Wallet, CircleCheck, Clock, TrendingUp, LinkIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [payments, finishedAgg, pendingCount, balance, settings, asset] = await Promise.all([
    prisma.payment.findMany({
      where: { merchantId: user.id },
      include: { network: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.payment.aggregate({
      where: { merchantId: user.id, status: "FINISHED" },
      _sum: { outcomeAmount: true, serviceFee: true },
      _count: true,
    }),
    prisma.payment.count({
      where: { merchantId: user.id, status: { in: ["WAITING", "CONFIRMING", "CONFIRMED", "SENDING"] } },
    }),
    merchantBalance(user.id),
    getSettings(),
    prisma.asset.findUnique({ where: { symbol: "USDT" } }),
  ]);

  const { rates, live } = await getRates(asset ? [asset.coingeckoId] : []);
  const usdtInr = asset ? rates[asset.coingeckoId] : undefined;

  const stats = [
    { icon: Wallet, label: "Balance", value: usdt(balance), sub: usdtInr ? formatInr(balance * usdtInr) : undefined },
    { icon: CircleCheck, label: "Payments received", value: String(finishedAgg._count) },
    { icon: TrendingUp, label: "Volume settled", value: usdt(Number(finishedAgg._sum.outcomeAmount ?? 0)) },
    { icon: Clock, label: "In progress", value: String(pendingCount) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            Welcome back, {(user.businessName ?? user.fullName).split(" ")[0]}.
          </p>
        </div>
        <Link href="/dashboard/links">
          <Button size="lg">
            <LinkIcon className="h-4 w-4" /> New payment link
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
            {sub && <p className="text-xs text-slate-500">≈ {sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <p className="text-sm text-slate-400">USDT rate</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {usdtInr ? formatInr(usdtInr) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {live ? "Live market rate, refreshed every 30 seconds" : "Last known rate (network unavailable)"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-400">Your commission</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {Number(settings.service_fee_bps) / 100}%
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fees paid: {usdt(Number(finishedAgg._sum.serviceFee ?? 0))}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent payments"
          action={
            <Link href="/dashboard/payments" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          }
        />
        {payments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No payments yet.</p>
            <Link href="/dashboard/links" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                Create your first payment link <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/70 last:border-0">
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">
                    <Link href={`/dashboard/payments/${p.paymentId}`} className="hover:text-emerald-300">
                      {p.paymentId}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {p.priceCurrency === "INR" ? formatInr(Number(p.priceAmount)) : `${p.priceAmount} ${p.priceCurrency}`}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{usdt(p.payAmount)}</td>
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
