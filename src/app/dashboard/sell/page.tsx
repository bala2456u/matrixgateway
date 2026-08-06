import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { Card, Button } from "@/components/ui";
import { SellWizard } from "./sell-wizard";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const user = await requireUser();

  if (user.kycStatus !== "VERIFIED") {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold text-slate-100">KYC required</h1>
          <p className="mt-2 text-sm text-slate-400">
            {user.kycStatus === "PENDING"
              ? "Your KYC is under review. Selling unlocks as soon as our team approves it."
              : "Indian regulations require identity verification before selling crypto for INR."}
          </p>
          {user.kycStatus !== "PENDING" && (
            <Link href="/dashboard/kyc" className="mt-6 inline-block">
              <Button size="lg">Complete KYC</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  const [assets, banks] = await Promise.all([
    prisma.asset.findMany({
      where: { enabled: true },
      include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.bankAccount.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
  ]);
  const { rates } = await getRates(assets.map((a) => a.coingeckoId));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Sell crypto</h1>
      <p className="mt-1 text-sm text-slate-400">
        Lock a live rate, send your crypto, receive INR by IMPS — usually within minutes.
      </p>
      <div className="mt-6">
        <SellWizard
          assets={assets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            featured: a.featured,
            minSellAmount: Number(a.minSellAmount),
            rateInr: rates[a.coingeckoId] ?? 0,
            networks: a.networks.map((n) => ({
              code: n.code,
              name: n.name,
              confirmationsRequired: n.confirmationsRequired,
              avgSettleMinutes: n.avgSettleMinutes,
              feeNote: n.feeNote,
              recommended: n.recommended,
            })),
          }))}
          banks={banks.map((b) => ({
            id: b.id,
            bankName: b.bankName,
            accountNumber: b.accountNumber,
            isDefault: b.isDefault,
          }))}
          platformFeeBps={Number(process.env.PLATFORM_FEE_BPS ?? 50)}
          tdsBps={Number(process.env.TDS_BPS ?? 100)}
        />
      </div>
    </div>
  );
}
