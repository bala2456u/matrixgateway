import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { createQuote, OrderError } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
  networkCode: z.string().trim().toUpperCase().optional(),
  cryptoAmount: z.coerce.number().positive(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`quote:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many quote requests" }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const order = await createQuote({
      userId: user.id,
      assetSymbol: parsed.data.assetSymbol,
      networkCode: parsed.data.networkCode,
      cryptoAmount: parsed.data.cryptoAmount,
    });
    await audit("order.quote", { userId: user.id, detail: order.reference, ip: clientIp(req) });
    return NextResponse.json({ id: order.id, reference: order.reference });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
