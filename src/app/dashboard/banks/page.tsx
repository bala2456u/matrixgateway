import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui";
import { BankForm, DeleteBankButton } from "./bank-form";
import { Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const user = await requireUser();
  const banks = await prisma.bankAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Bank accounts</h1>
      <p className="mt-1 text-sm text-slate-400">INR payouts are sent to these accounts via IMPS.</p>

      <Card className="mt-6">
        <CardHeader title="Linked accounts" />
        {banks.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">No bank accounts linked yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800">
                    <Landmark className="h-4 w-4 text-slate-300" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {b.bankName} ····{b.accountNumber.slice(-4)}
                      {b.isDefault && (
                        <span className="ml-2">
                          <Badge tone="emerald">Default</Badge>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.accountHolder} · {b.ifsc}
                      {b.upiId ? ` · ${b.upiId}` : ""}
                    </p>
                  </div>
                </div>
                <DeleteBankButton id={b.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-100">Add a bank account</h2>
        <div className="mt-4">
          <BankForm />
        </div>
      </Card>
    </div>
  );
}
