import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiKeyUser } from "@/lib/apikeys";
import { advancePayment, publicPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** GET /api/v1/payment/{payment_id} — payment status. */
export async function GET(req: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });
  const { paymentId } = await ctx.params;

  const found = await prisma.payment.findFirst({
    where: { paymentId, merchantId: auth.user.id },
    select: { id: true },
  });
  if (!found) return NextResponse.json({ error: { message: "No such payment" } }, { status: 404 });

  const payment = await advancePayment(found.id);
  if (!payment) return NextResponse.json({ error: { message: "No such payment" } }, { status: 404 });

  return NextResponse.json(publicPayment(payment));
}
