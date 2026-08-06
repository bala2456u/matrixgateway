import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { advancePayment, publicPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Public status poll for the hosted checkout. Keyed by invoice token, so it
 * exposes only what the paying customer already sees — no auth required.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const invoice = await prisma.invoice.findUnique({ where: { token }, select: { id: true } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latest = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payment = await advancePayment(latest.id);
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...publicPayment(payment),
    events: payment.events.map((e) => ({
      status: e.status,
      message: e.message,
      at: e.createdAt.toISOString(),
    })),
  });
}
