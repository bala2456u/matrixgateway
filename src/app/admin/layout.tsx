import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { NavLink } from "@/components/nav-link";
import { Badge } from "@/components/ui";
import { LayoutDashboard, ShieldCheck, ReceiptText, Users, ScrollText, Wallet } from "lucide-react";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-800 bg-slate-950/80 px-4 py-6">
        <div className="px-2">
          <Logo href="/admin" />
        </div>
        <div className="mt-2 px-2">
          <Badge tone="violet">Admin</Badge>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          <NavLink href="/admin" exact>
            <LayoutDashboard className="h-4 w-4" /> Overview
          </NavLink>
          <NavLink href="/admin/kyc">
            <ShieldCheck className="h-4 w-4" /> KYC queue
          </NavLink>
          <NavLink href="/admin/orders">
            <ReceiptText className="h-4 w-4" /> Orders
          </NavLink>
          <NavLink href="/admin/wallets">
            <Wallet className="h-4 w-4" /> Wallets
          </NavLink>
          <NavLink href="/admin/users">
            <Users className="h-4 w-4" /> Users
          </NavLink>
          <NavLink href="/admin/audit">
            <ScrollText className="h-4 w-4" /> Audit log
          </NavLink>
        </nav>
        <div className="border-t border-slate-800 pt-4">
          <p className="truncate px-3 text-sm font-medium text-slate-300">{user.fullName}</p>
          <p className="truncate px-3 text-xs text-slate-500">{user.email}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="ml-64 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
