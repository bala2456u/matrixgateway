import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiKeyUser } from "@/lib/apikeys";
import { newInvoiceToken } from "@/lib/payments";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const schema = z.object({
  price_amount: z.coerce.number().positive(),
  price_currency: z.string().trim().default("INR"),
  order_id: z.string().trim().max(200).optional().nullable(),
  order_description: z.string().trim().max(500).optional().nullable(),
  ipn_callback_url: z.string().url().optional().nullable(),
  success_url: z.string().url().optional().nullable(),
  cancel_url: z.string().url().optional().nullable(),
});

/** POST /api/v1/invoice — create a hosted payment link. */
export async function POST(req: Request) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });
  if (!rateLimit(`inv:${auth.user.id}`, 120, 60_000)) {
    return NextResponse.json({ error: { message: "Rate limit exceeded" } }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid request body" } },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const currency = d.price_currency.toUpperCase();
  if (!["INR", "USD", "USDT"].includes(currency)) {
    return NextResponse.json({ error: { message: "price_currency must be INR, USD or USDT" } }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      token: newInvoiceToken(),
      merchantId: auth.user.id,
      priceAmount: d.price_amount.toString(),
      priceCurrency: currency,
      payCurrency: "USDT",
      orderId: d.order_id ?? null,
      orderDescription: d.order_description ?? null,
      ipnCallbackUrl: d.ipn_callback_url ?? null,
      successUrl: d.success_url ?? null,
      cancelUrl: d.cancel_url ?? null,
    },
  });
  await audit("invoice.create_api", { userId: auth.user.id, detail: invoice.token });

  return NextResponse.json(
    {
      id: invoice.id,
      token_id: invoice.token,
      order_id: invoice.orderId,
      order_description: invoice.orderDescription,
      price_amount: Number(invoice.priceAmount),
      price_currency: invoice.priceCurrency.toLowerCase(),
      pay_currency: "usdt",
      invoice_url: `${baseUrl()}/pay/${invoice.token}`,
      ipn_callback_url: invoice.ipnCallbackUrl,
      success_url: invoice.successUrl,
      cancel_url: invoice.cancelUrl,
      created_at: invoice.createdAt.toISOString(),
      updated_at: invoice.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}
