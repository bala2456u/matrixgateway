import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui";
import { CreateKeyForm, RevokeKeyButton, AddWebhookForm, DeleteWebhookButton } from "./developer-forms";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const user = await requireUser();
  const [keys, webhooks, deliveries] = await Promise.all([
    prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEndpoint.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.webhookDelivery.findMany({
      where: { endpoint: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { endpoint: { select: { url: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Developer</h1>
        <p className="mt-1 text-sm text-slate-400">
          Integrate MatrixGateway into your product with the REST API and webhooks.
        </p>
      </div>

      <Card>
        <CardHeader title="API keys" subtitle="Authenticate API calls with Authorization: Bearer <key>" />
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
                      {k.prefix}…{" · "}
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
        <CardHeader
          title="Webhook endpoints"
          subtitle="We POST order events, signed with X-MatrixGateway-Signature (HMAC-SHA256)"
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
          {deliveries.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-medium text-slate-300">Recent deliveries</h3>
              <ul className="mt-2 space-y-1.5">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-xs">
                    <span className="font-mono text-slate-400">{d.eventType}</span>
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
        <CardHeader title="Quick start" subtitle="Create a sell order from your backend" />
        <pre className="overflow-x-auto px-6 py-5 font-mono text-xs leading-relaxed text-slate-300">
{`# 1. Get live rates
curl https://matrixgateway.co.in/api/v1/rates

# 2. Create a sell order (uses your default bank account)
#    network is optional — defaults to the recommended one (TRC20 for USDT)
curl -X POST https://matrixgateway.co.in/api/v1/orders \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"asset": "USDT", "network": "TRC20", "amount": 100}'

# 3. Poll order status
curl https://matrixgateway.co.in/api/v1/orders/MG-20260806-XXXXXX \\
  -H "Authorization: Bearer mg_live_..."

# Webhook signature verification (Node.js):
#   const [t, v1] = sig.split(",").map(p => p.split("=")[1]);
#   const expected = crypto.createHmac("sha256", secret)
#     .update(t + "." + rawBody).digest("hex");
#   crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))`}
        </pre>
      </Card>
    </div>
  );
}
