import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader } from "@/components/ui";
import { PaymentStatusBadge, usdt } from "@/components/payment-status";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage(props: PageProps<"/admin/payments">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status.toUpperCase() : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const payments = await prisma.payment.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { paymentId: { contains: q } },
              { orderId: { contains: q, mode: "insensitive" as const } },
              { txHash: { contains: q } },
              { merchant: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: { network: true, merchant: { select: { email: true, businessName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const filters = ["ALL", "WAITING", "CONFIRMING", "FINISHED", "PARTIALLY_PAID", "EXPIRED", "FAILED"];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-100">Payments</h1>

      <form className="mt-5 flex gap-3" action="/admin/payments">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search payment ID, order ID, tx hash or merchant email"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
        />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f === "ALL" ? !status : status === f;
          const href = f === "ALL" ? "/admin/payments" : `/admin/payments?status=${f}`;
          return (
            <Link
              key={f}
              href={href}
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
        <CardHeader title="All payments" subtitle={`${payments.length} shown`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Payment ID</th>
                <th className="px-3 py-3 font-medium">Merchant</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Expected</th>
                <th className="px-3 py-3 font-medium">Paid</th>
                <th className="px-3 py-3 font-medium">Fee</th>
                <th className="px-3 py-3 font-medium">Net</th>
                <th className="px-3 py-3 font-medium">Network</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/60">
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">{p.paymentId}</td>
                  <td className="px-3 py-3 text-xs text-slate-400">{p.merchant.businessName ?? p.merchant.email}</td>
                  <td className="px-3 py-3 text-slate-300">
                    {p.priceCurrency === "INR" ? formatInr(Number(p.priceAmount)) : `${p.priceAmount} ${p.priceCurrency}`}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-300">{usdt(p.payAmount)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">
                    {Number(p.actuallyPaid) > 0 ? usdt(p.actuallyPaid) : "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-amber-300">{usdt(p.serviceFee)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-emerald-300">{usdt(p.outcomeAmount)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{p.network.code}</td>
                  <td className="px-6 py-3 text-right">
                    <PaymentStatusBadge status={p.status} />
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
