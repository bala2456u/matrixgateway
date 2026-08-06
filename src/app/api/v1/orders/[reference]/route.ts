import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiKeyUser } from "@/lib/apikeys";
import { advanceOrder, publicOrder } from "@/lib/orders";

/** Fetch a sell order by its reference (MG-YYYYMMDD-XXXXXX). */
export async function GET(req: Request, ctx: { params: Promise<{ reference: string }> }) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });
  const { reference } = await ctx.params;

  const found = await prisma.sellOrder.findFirst({
    where: { reference, userId: auth.user.id },
    select: { id: true },
  });
  if (!found) return NextResponse.json({ error: { message: "No such order" } }, { status: 404 });

  const order = await advanceOrder(found.id);
  if (!order) return NextResponse.json({ error: { message: "No such order" } }, { status: 404 });
  return NextResponse.json({ object: "sell_order", ...publicOrder(order) });
}
