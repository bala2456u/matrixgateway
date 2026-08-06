import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { simulateDeposit, OrderError } from "@/lib/orders";
import { audit } from "@/lib/audit";

/** Sandbox-only: stands in for the blockchain watcher detecting a real deposit. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const order = await simulateDeposit(id, user.id);
    await audit("order.simulate_deposit", { userId: user.id, detail: order.reference });
    return NextResponse.json({ ok: true, tx_hash: order.depositTxHash });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
