import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, OrderStatusBadge } from "@/components/ui";
import { ReconcileForm } from "./reconcile-form";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await prisma.sellOrder.findMany({
    include: { asset: true, user: { select: { email: true } }, payout: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-100">Orders</h1>

      <Card className="mt-6">
        <CardHeader
          title="Manual reconciliation"
          subtitle="Customer sent a different amount? Paste the order reference and the real transaction hash — the transfer is verified on-chain and the order is re-priced to the amount actually received."
        />
        <div className="px-6 py-5">
          <ReconcileForm />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="All orders" subtitle={`${orders.length} shown (latest first)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Sold</th>
                <th className="px-3 py-3 font-medium">Gross</th>
                <th className="px-3 py-3 font-medium">Fee</th>
                <th className="px-3 py-3 font-medium">TDS</th>
                <th className="px-3 py-3 font-medium">Net paid</th>
                <th className="px-3 py-3 font-medium">UTR</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60">
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">{o.reference}</td>
                  <td className="px-3 py-3 text-slate-400">{o.user.email}</td>
                  <td className="px-3 py-3 text-slate-200">
                    {String(o.cryptoAmount)} {o.asset.symbol}
                  </td>
                  <td className="px-3 py-3 text-slate-300">{formatInr(Number(o.grossInr))}</td>
                  <td className="px-3 py-3 text-slate-400">{formatInr(Number(o.platformFeeInr))}</td>
                  <td className="px-3 py-3 text-slate-400">{formatInr(Number(o.tdsInr))}</td>
                  <td className="px-3 py-3 text-slate-200">{formatInr(Number(o.netInr))}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{o.payout?.utr ?? "—"}</td>
                  <td className="px-6 py-3 text-right">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
