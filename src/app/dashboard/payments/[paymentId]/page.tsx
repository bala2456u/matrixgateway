import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advancePayment } from "@/lib/payments";
import { formatInr } from "@/lib/fees";
import { Card, CardHeader } from "@/components/ui";
import { PaymentStatusBadge, usdt } from "@/components/payment-status";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentDetail(props: PageProps<"/dashboard/payments/[paymentId]">) {
  const user = await requireUser();
  const { paymentId } = await props.params;

  const owned = await prisma.payment.findFirst({
    where: { paymentId, merchantId: user.id },
    select: { id: true },
  });
  if (!owned) notFound();

  const p = await advancePayment(owned.id);
  if (!p) notFound();

  const deliveries = await prisma.ipnDelivery.findMany({
    where: { paymentId: p.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/payments" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> All payments
      </Link>

      <Card>
        <CardHeader
          title={`Payment ${p.paymentId}`}
          subtitle={p.orderDescription ?? undefined}
          action={<PaymentStatusBadge status={p.status} />}
        />
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 px-6 py-5 text-sm">
          <Item label="Price" value={p.priceCurrency === "INR" ? formatInr(Number(p.priceAmount)) : `${p.priceAmount} ${p.priceCurrency}`} />
          <Item label="Locked rate" value={`₹${p.lockedRateInr} / USDT`} />
          <Item label="Expected" value={usdt(p.payAmount)} mono />
          <Item label="Actually paid" value={Number(p.actuallyPaid) > 0 ? usdt(p.actuallyPaid) : "—"} mono />
          <Item label="Service fee" value={usdt(p.serviceFee)} mono />
          <Item label="Net to you" value={usdt(p.outcomeAmount)} mono />
          <Item label="Network" value={p.network.name} />
          <Item label="Confirmations" value={`${p.confirmations} / ${p.network.confirmationsRequired}`} />
          <Item label="Order ID" value={p.orderId ?? "—"} />
          <Item label="Purchase ID" value={p.purchaseId ?? "—"} />
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Pay address</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-300">{p.payAddress}</dd>
          </div>
          {p.txHash && (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Transaction</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-300">{p.txHash}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Timeline" />
        <ol className="space-y-3 border-l border-slate-800 px-6 py-5 pl-9">
          {p.events.map((e) => (
            <li key={e.id} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                  ["FAILED", "EXPIRED", "PARTIALLY_PAID"].includes(e.status) ? "bg-red-500" : "bg-emerald-500"
                }`}
              />
              <p className="text-sm text-slate-300">{e.message}</p>
              <p className="text-xs text-slate-500">{e.createdAt.toLocaleString("en-IN")}</p>
            </li>
          ))}
        </ol>
      </Card>

      {deliveries.length > 0 && (
        <Card>
          <CardHeader title="IPN deliveries" subtitle="Callbacks sent to your endpoint" />
          <ul className="divide-y divide-slate-800/70">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-6 py-3 text-xs">
                <span className="font-mono text-slate-400">{d.eventType}</span>
                <span className="text-slate-500">{d.attempts} attempt(s)</span>
                <span className={d.success ? "text-emerald-400" : "text-red-400"}>
                  {d.statusCode ?? "network error"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
