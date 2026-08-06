import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, OrderStatusBadge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.sellOrder.findMany({
    where: { userId: user.id },
    include: { asset: true, network: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Orders</h1>
        <Link href="/dashboard/sell">
          <Button>New sell order</Button>
        </Link>
      </div>
      <Card className="mt-6">
        <CardHeader title="All orders" subtitle={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />
        {orders.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-3 py-3 font-medium">Asset</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Net INR</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60">
                  <td className="px-6 py-3.5 font-mono text-xs">
                    <Link href={`/dashboard/orders/${o.id}`} className="text-slate-300 hover:text-emerald-300">
                      {o.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-slate-300">
                    {o.asset.symbol}
                    {o.network && <span className="ml-1.5 text-xs text-slate-500">{o.network.code}</span>}
                  </td>
                  <td className="px-3 py-3.5 text-slate-300">{String(o.cryptoAmount)}</td>
                  <td className="px-3 py-3.5 text-slate-200">{formatInr(Number(o.netInr))}</td>
                  <td className="px-3 py-3.5 text-slate-500">{o.createdAt.toLocaleString("en-IN")}</td>
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
