import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiKeyUser } from "@/lib/apikeys";
import { createPayment, publicPayment, advancePayment, PaymentError } from "@/lib/payments";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  price_amount: z.coerce.number().positive(),
  price_currency: z.string().trim().default("INR"),
  pay_currency: z.string().trim().optional(),
  network: z.string().trim().optional(),
  order_id: z.string().trim().max(200).optional().nullable(),
  order_description: z.string().trim().max(500).optional().nullable(),
  purchase_id: z.string().trim().max(200).optional().nullable(),
  ipn_callback_url: z.string().url().optional().nullable(),
  success_url: z.string().url().optional().nullable(),
  cancel_url: z.string().url().optional().nullable(),
});

/** POST /api/v1/payment — create a payment. */
export async function POST(req: Request) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });
  if (!rateLimit(`pay:${auth.user.id}`, 120, 60_000)) {
    return NextResponse.json({ error: { message: "Rate limit exceeded" } }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid request body" } },
      { status: 400 }
    );
  }
  const d = parsed.data;
  if (d.pay_currency && d.pay_currency.toUpperCase() !== "USDT") {
    return NextResponse.json({ error: { message: "Only USDT is supported" } }, { status: 400 });
  }

  try {
    const payment = await createPayment({
      merchantId: auth.user.id,
      priceAmount: d.price_amount,
      priceCurrency: d.price_currency,
      networkCode: d.network,
      orderId: d.order_id,
      orderDescription: d.order_description,
      purchaseId: d.purchase_id,
      ipnCallbackUrl: d.ipn_callback_url,
      successUrl: d.success_url,
      cancelUrl: d.cancel_url,
      viaApiKeyId: auth.apiKeyId,
    });
    await audit("payment.create_api", { userId: auth.user.id, detail: payment.paymentId });
    return NextResponse.json(publicPayment(payment), { status: 201 });
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: { message: e.message } }, { status: 400 });
    throw e;
  }
}

/** GET /api/v1/payment — list the merchant's payments. */
export async function GET(req: Request) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
  const status = url.searchParams.get("status")?.toUpperCase();
  const orderBy = url.searchParams.get("orderBy") === "asc" ? "asc" : "desc";

  const where = {
    merchantId: auth.user.id,
    ...(status ? { status: status as never } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { network: true },
      orderBy: { createdAt: orderBy },
      skip: page * limit,
      take: limit,
    }),
  ]);

  // Move any stale rows forward so listed statuses are current
  await Promise.all(
    rows
      .filter((r) => !["FINISHED", "EXPIRED", "FAILED", "REFUNDED", "PARTIALLY_PAID"].includes(r.status))
      .slice(0, 20)
      .map((r) => advancePayment(r.id).catch(() => {}))
  );

  const fresh = await prisma.payment.findMany({
    where,
    include: { network: true },
    orderBy: { createdAt: orderBy },
    skip: page * limit,
    take: limit,
  });

  return NextResponse.json({
    data: fresh.map(publicPayment),
    limit,
    page,
    pagesCount: Math.ceil(total / limit),
    total,
  });
}
