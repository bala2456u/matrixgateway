import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader, Button } from "@/components/ui";
import { PaymentStatusBadge, usdt } from "@/components/payment-status";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsPage(props: PageProps<"/dashboard/payments">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status.toUpperCase() : undefined;

  const where = { merchantId: user.id, ...(status ? { status: status as never } : {}) };
  const payments = await prisma.payment.findMany({
    where,
    include: { network: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const filters = ["ALL", "WAITING", "CONFIRMING", "FINISHED", "EXPIRED", "PARTIALLY_PAID"];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Payments</h1>
          <p className="mt-1 text-sm text-slate-400">Every USDT payment your customers have made.</p>
        </div>
        <Link href="/dashboard/links">
          <Button>
            <Plus className="h-4 w-4" /> New payment link
          </Button>
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f === "ALL" ? !status : status === f;
          return (
            <Link
              key={f}
              href={f === "ALL" ? "/dashboard/payments" : `/dashboard/payments?status=${f}`}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
              }`}
            >
              {f.replace("_", " ").toLowerCase()}
            </Link>
          );
        })}
      </div>

      <Card className="mt-5">
        <CardHeader title="Transactions" subtitle={`${payments.length} shown`} />
        {payments.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-medium">Payment ID</th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Expected</th>
                  <th className="px-3 py-3 font-medium">Received</th>
                  <th className="px-3 py-3 font-medium">Net</th>
                  <th className="px-3 py-3 font-medium">Network</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60">
                    <td className="px-6 py-3 font-mono text-xs">
                      <Link href={`/dashboard/payments/${p.paymentId}`} className="text-slate-300 hover:text-emerald-300">
                        {p.paymentId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{p.orderId ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {p.priceCurrency === "INR" ? formatInr(Number(p.priceAmount)) : `${p.priceAmount} ${p.priceCurrency}`}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-300">{usdt(p.payAmount)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">
                      {Number(p.actuallyPaid) > 0 ? usdt(p.actuallyPaid) : "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-emerald-300">
                      {p.status === "FINISHED" ? usdt(p.outcomeAmount) : "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{p.network.code}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{p.createdAt.toLocaleString("en-IN")}</td>
                    <td className="px-6 py-3 text-right">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
