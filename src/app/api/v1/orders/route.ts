import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiKeyUser } from "@/lib/apikeys";
import { createQuote, confirmOrder, publicOrder, OrderError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const schema = z.object({
  asset: z.string().trim().toUpperCase(),
  network: z.string().trim().toUpperCase().optional(), // e.g. TRC20, BEP20, SOL, ERC20
  amount: z.coerce.number().positive(),
});

/**
 * Create a sell order via API key. The quote is auto-confirmed against the
 * account's default bank account and a deposit address is returned.
 */
export async function POST(req: Request) {
  const auth = await apiKeyUser(req);
  if (!auth) return NextResponse.json({ error: { message: "Invalid or missing API key" } }, { status: 401 });
  if (!rateLimit(`v1:${auth.user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: { message: "Rate limit exceeded" } }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid request: expected { asset, amount, network? }" } },
      { status: 400 }
    );
  }

  const defaultBank = await prisma.bankAccount.findFirst({
    where: { userId: auth.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!defaultBank) {
    return NextResponse.json(
      { error: { message: "No bank account on file. Add one in the dashboard first." } },
      { status: 400 }
    );
  }

  try {
    const quote = await createQuote({
      userId: auth.user.id,
      assetSymbol: parsed.data.asset,
      networkCode: parsed.data.network,
      cryptoAmount: parsed.data.amount,
      viaApiKeyId: auth.apiKeyId,
    });
    const order = await confirmOrder(quote.id, auth.user.id, defaultBank.id);
    await audit("order.create_api", { userId: auth.user.id, detail: order.reference });
    return NextResponse.json({ object: "sell_order", ...publicOrder(order) }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) {
      return NextResponse.json({ error: { message: e.message } }, { status: 400 });
    }
    throw e;
  }
}
