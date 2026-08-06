import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-100">Audit log</h1>
      <Card className="mt-6">
        <CardHeader title="Recent activity" subtitle="Security-relevant events across the platform" />
        <table className="w-full text-sm">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-800/70 last:border-0">
                <td className="px-6 py-3 font-mono text-xs text-emerald-400/80">{l.action}</td>
                <td className="px-3 py-3 text-slate-400">{l.user?.email ?? "—"}</td>
                <td className="px-3 py-3 max-w-64 truncate text-xs text-slate-500">{l.detail ?? ""}</td>
                <td className="px-6 py-3 text-right text-xs text-slate-500">{l.createdAt.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
