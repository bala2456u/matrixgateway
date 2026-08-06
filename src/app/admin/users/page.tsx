import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, KycStatusBadge, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-100">Users</h1>
      <Card className="mt-6">
        <CardHeader title="All users" subtitle={`${users.length} shown`} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Orders</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-6 py-3 text-right font-medium">KYC</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/70 last:border-0">
                <td className="px-6 py-3 text-slate-200">{u.fullName}</td>
                <td className="px-3 py-3 text-slate-400">{u.email}</td>
                <td className="px-3 py-3">{u.role === "ADMIN" ? <Badge tone="violet">Admin</Badge> : <Badge>Customer</Badge>}</td>
                <td className="px-3 py-3 text-slate-300">{u._count.orders}</td>
                <td className="px-3 py-3 text-slate-500">{u.createdAt.toLocaleDateString("en-IN")}</td>
                <td className="px-6 py-3 text-right">
                  <KycStatusBadge status={u.kycStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
