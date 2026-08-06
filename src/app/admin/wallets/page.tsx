import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui";
import { WalletForm } from "./wallet-form";

export const dynamic = "force-dynamic";

export default async function AdminWalletsPage() {
  await requireAdmin();
  const networks = await prisma.assetNetwork.findMany({
    include: { asset: true },
    orderBy: [{ asset: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-100">Gateway wallets</h1>
      <p className="mt-1 text-sm text-slate-400">
        Fixed deposit addresses per network. Every customer&apos;s payment QR points to these wallets;
        incoming transfers are matched to orders by exact amount. Leave blank to fall back to
        per-order sandbox addresses.
      </p>
      <Card className="mt-6">
        <CardHeader
          title="Deposit addresses"
          subtitle="Use cold/warm wallet addresses you control. Changing an address only affects new orders."
        />
        <ul className="divide-y divide-slate-800/70">
          {networks.map((n) => (
            <li key={n.id} className="px-6 py-5">
              <WalletForm
                networkId={n.id}
                label={`${n.asset.symbol} · ${n.name}`}
                addressFamily={n.addressFamily}
                current={n.depositAddress}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
