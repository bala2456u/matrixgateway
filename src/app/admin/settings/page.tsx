import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Platform settings</h1>
      <p className="mt-1 text-sm text-slate-400">
        Applies to every new payment. Payments already created keep the values they were made with.
      </p>

      <Card className="mt-6">
        <CardHeader title="Commercial &amp; risk parameters" />
        <div className="px-6 py-5">
          <SettingsForm settings={settings} />
        </div>
      </Card>
    </div>
  );
}
