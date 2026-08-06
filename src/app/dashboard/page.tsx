import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, OrderStatusBadge, KycStatusBadge, Button } from "@/components/ui";
import { ArrowRight, TrendingUp, CircleCheck, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [orders, assets, completedAgg, pendingCount] = await Promise.all([
    prisma.sellOrder.findMany({
      where: { userId: user.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.asset.findMany({
      where: { enabled: true },
      include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.sellOrder.aggregate({
      where: { userId: user.id, status: "COMPLETED" },
      _sum: { netInr: true },
      _count: true,
    }),
    prisma.sellOrder.count({
      where: { userId: user.id, status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_DETECTED", "DEPOSIT_CONFIRMED", "PAYOUT_PROCESSING"] } },
    }),
  ]);

  const { rates, live } = await getRates(assets.map((a) => a.coingeckoId));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>
          <p className="mt-1 text-sm text-slate-400">Welcome back, {user.fullName.split(" ")[0]}.</p>
        </div>
        <Link href="/dashboard/sell">
          <Button size="lg">
            Sell crypto <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {user.kycStatus !== "VERIFIED" && (
        <Card className="flex items-center justify-between gap-4 border-amber-800/60 bg-amber-950/30 p-5">
          <div className="flex items-center gap-3">
            <KycStatusBadge status={user.kycStatus} />
            <p className="text-sm text-amber-200/90">
              {user.kycStatus === "PENDING"
                ? "Your KYC is under review. You can sell crypto once it's approved."
                : user.kycStatus === "REJECTED"
                  ? "Your KYC was rejected. Please review and resubmit."
                  : "Complete KYC verification to start selling crypto for INR."}
            </p>
          </div>
          {user.kycStatus !== "PENDING" && (
            <Link href="/dashboard/kyc">
              <Button variant="secondary" size="sm">
                {user.kycStatus === "REJECTED" ? "Resubmit KYC" : "Complete KYC"}
              </Button>
            </Link>
          )}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Total received</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {formatInr(Number(completedAgg._sum.netInr ?? 0))}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-400">
            <CircleCheck className="h-4 w-4" />
            <span className="text-sm">Completed orders</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{completedAgg._count}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">In progress</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{pendingCount}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Live rates"
          subtitle={live ? "Refreshed every 30 seconds" : "Showing last-known rates (network unavailable)"}
        />
        <div className="grid grid-cols-4 divide-x divide-slate-800">
          {assets.map((a) => (
            <div key={a.id} className="px-6 py-4">
              <p className="text-sm font-medium text-slate-300">{a.symbol}</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {rates[a.coingeckoId] ? formatInr(rates[a.coingeckoId]) : "—"}
              </p>
              <p className="text-xs text-slate-500">
                {a.networks.length > 1 ? a.networks.map((n) => n.code).join(" · ") : a.networks[0]?.name}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent orders"
          action={
            <Link href="/dashboard/orders" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          }
        />
        {orders.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">
            No orders yet. Sell your first crypto to see it here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/70 last:border-0">
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-400">
                    <Link href={`/dashboard/orders/${o.id}`} className="hover:text-emerald-300">
                      {o.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-slate-200">
                    {String(o.cryptoAmount)} {o.asset.symbol}
                  </td>
                  <td className="px-3 py-3.5 text-slate-200">{formatInr(Number(o.netInr))}</td>
                  <td className="px-6 py-3.5 text-right">
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
