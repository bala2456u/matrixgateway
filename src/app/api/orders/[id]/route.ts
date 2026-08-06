import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { advanceOrder, publicOrder } from "@/lib/orders";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const owned = await prisma.sellOrder.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await advanceOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...publicOrder(order),
    id: order.id,
    events: order.events.map((e) => ({
      status: e.status,
      message: e.message,
      at: e.createdAt.toISOString(),
    })),
  });
}
