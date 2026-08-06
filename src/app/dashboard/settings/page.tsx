import { requireUser } from "@/lib/auth";
import { Card, CardHeader, Badge } from "@/components/ui";
import { ProfileForm, IpnSecretPanel } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Your brand on the checkout page, and IPN security.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-100">Business profile</h2>
        <p className="mt-1 text-sm text-slate-400">
          Shown to customers on your hosted checkout pages.
        </p>
        <div className="mt-4">
          <ProfileForm
            businessName={user.businessName ?? ""}
            brandColor={user.brandColor ?? "#10b981"}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="IPN secret"
          subtitle="Signs every callback so you can verify it really came from us"
          action={user.ipnSecret ? <Badge tone="emerald">Configured</Badge> : <Badge tone="amber">Not set</Badge>}
        />
        <div className="px-6 py-5">
          <IpnSecretPanel configured={!!user.ipnSecret} />
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-medium text-slate-300">Verifying a callback (Node.js)</p>
            <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-400">
{`const crypto = require("crypto");

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.keys(v).sort().reduce((a, k) => (a[k] = sortKeys(v[k]), a), {});
  return v;
}

app.post("/webhooks/matrixgateway", (req, res) => {
  const expected = crypto
    .createHmac("sha512", process.env.MG_IPN_SECRET)
    .update(JSON.stringify(sortKeys(req.body)))
    .digest("hex");

  const got = req.get("x-matrixgateway-sig");
  if (got !== expected) return res.status(401).end();

  if (req.body.payment_status === "finished") {
    // fulfil the order — req.body.order_id is yours
  }
  res.json({ ok: true });
});`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
