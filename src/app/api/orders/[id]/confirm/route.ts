import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { confirmOrder, OrderError } from "@/lib/orders";
import { audit } from "@/lib/audit";

const schema = z.object({ bankAccountId: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a bank account" }, { status: 400 });

  try {
    const order = await confirmOrder(id, user.id, parsed.data.bankAccountId);
    await audit("order.confirm", { userId: user.id, detail: order.reference });
    return NextResponse.json({ ok: true, deposit_address: order.depositAddress });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
