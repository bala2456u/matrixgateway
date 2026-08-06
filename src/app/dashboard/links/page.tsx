import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/fees";
import { baseUrl } from "@/lib/urls";
import { Card, CardHeader } from "@/components/ui";
import { LinkForm, CopyLink, DeleteLinkButton } from "./link-form";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const user = await requireUser();
  const invoices = await prisma.invoice.findMany({
    where: { merchantId: user.id },
    include: { _count: { select: { payments: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const origin = baseUrl();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Payment links</h1>
        <p className="mt-1 text-sm text-slate-400">
          Share a link, your customer pays in USDT on a hosted checkout page. No integration needed.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-100">Create a link</h2>
        <div className="mt-4">
          <LinkForm />
        </div>
      </Card>

      <Card>
        <CardHeader title="Your links" subtitle={`${invoices.length} link(s)`} />
        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No payment links yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">
                    {inv.priceCurrency === "INR"
                      ? formatInr(Number(inv.priceAmount))
                      : `${inv.priceAmount} ${inv.priceCurrency}`}
                    {inv.orderDescription ? <span className="text-slate-400"> · {inv.orderDescription}</span> : null}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{origin}/pay/{inv.token}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{inv._count.payments} payment(s)</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyLink url={`${origin}/pay/${inv.token}`} />
                  {inv._count.payments === 0 && <DeleteLinkButton id={inv.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
