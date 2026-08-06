import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { baseUrl } from "@/lib/urls";
import { Card, CardHeader, Badge } from "@/components/ui";
import { CreateKeyForm, RevokeKeyButton, AddWebhookForm, DeleteWebhookButton } from "./developer-forms";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const user = await requireUser();
  const [keys, webhooks, deliveries] = await Promise.all([
    prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEndpoint.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.ipnDelivery.findMany({
      where: { payment: { merchantId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const origin = baseUrl();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Developers</h1>
        <p className="mt-1 text-sm text-slate-400">
          Accept USDT from your own backend.{" "}
          <Link href="/docs" className="text-emerald-400 hover:underline">
            Full API reference →
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader title="API keys" subtitle="Authenticate with Authorization: Bearer <key>" />
        <div className="px-6 py-5">
          <CreateKeyForm />
          {keys.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-800/70 rounded-xl border border-slate-800">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {k.label}{" "}
                      {k.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="emerald">Active</Badge>}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {k.prefix}… ·{" "}
                      {k.lastUsedAt ? `last used ${k.lastUsedAt.toLocaleString("en-IN")}` : "never used"}
                    </p>
                  </div>
                  {!k.revokedAt && <RevokeKeyButton id={k.id} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Quick start" subtitle="Create a payment and take USDT from a customer" />
        <pre className="overflow-x-auto px-6 py-5 font-mono text-[11px] leading-relaxed text-slate-300">
{`# 1. What we accept
curl ${origin}/api/v1/currencies

# 2. What 2500 INR is worth in USDT right now
curl "${origin}/api/v1/estimate?amount=2500&currency_from=inr"

# 3. Create a payment
curl -X POST ${origin}/api/v1/payment \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "price_amount": 2500,
    "price_currency": "INR",
    "network": "TRC20",
    "order_id": "ORD-1042",
    "ipn_callback_url": "https://yourapp.com/webhooks/matrixgateway"
  }'

# → show the customer pay_address and pay_amount (exact!), then either
#   wait for the IPN callback or poll:
curl ${origin}/api/v1/payment/4823910576 \\
  -H "Authorization: Bearer mg_live_..."

# No backend? Create a hosted checkout link instead:
curl -X POST ${origin}/api/v1/invoice \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"price_amount": 999, "price_currency": "INR"}'
# → { "invoice_url": "${origin}/pay/..." }`}
        </pre>
      </Card>

      <Card>
        <CardHeader
          title="IPN callbacks"
          subtitle="Signed with your IPN secret on every status change"
        />
        <div className="px-6 py-5">
          <p className="text-sm text-slate-400">
            Set <code className="font-mono text-xs text-emerald-300">ipn_callback_url</code> per payment.
            Generate the signing secret in{" "}
            <Link href="/dashboard/settings" className="text-emerald-400 hover:underline">
              Settings
            </Link>
            . Failed deliveries retry up to five times.
          </p>
          {deliveries.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-300">Recent deliveries</h3>
              <ul className="mt-2 space-y-1.5">
                {deliveries.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-slate-400">{d.eventType}</span>
                    <span className="text-slate-500">{d.attempts} attempt(s)</span>
                    <span className={d.success ? "text-emerald-400" : "text-red-400"}>
                      {d.statusCode ?? "network error"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Legacy off-ramp webhooks"
          subtitle="Order events for the sell-crypto product (separate from payment IPNs)"
        />
        <div className="px-6 py-5">
          <AddWebhookForm />
          {webhooks.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-800/70 rounded-xl border border-slate-800">
              {webhooks.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <p className="break-all font-mono text-xs text-slate-300">{w.url}</p>
                  <DeleteWebhookButton id={w.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
