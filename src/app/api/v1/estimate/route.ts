import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";

export const dynamic = "force-dynamic";

/** GET /api/v1/estimate?amount=100&currency_from=inr&currency_to=usdt */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const amount = Number(url.searchParams.get("amount"));
  const from = (url.searchParams.get("currency_from") ?? "INR").toUpperCase();
  const to = (url.searchParams.get("currency_to") ?? "USDT").toUpperCase();

  if (!(amount > 0)) {
    return NextResponse.json({ error: { message: "amount must be positive" } }, { status: 400 });
  }
  if (to !== "USDT") {
    return NextResponse.json({ error: { message: "Only USDT is supported" } }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({ where: { symbol: "USDT" } });
  if (!asset) return NextResponse.json({ error: { message: "USDT unavailable" } }, { status: 503 });

  const { rates } = await getRates([asset.coingeckoId]);
  const usdtInr = rates[asset.coingeckoId];
  if (!usdtInr) return NextResponse.json({ error: { message: "Rate unavailable" } }, { status: 503 });

  const rate = from === "INR" ? usdtInr : from === "USD" ? usdtInr / 88 : 1;
  const estimated = from === "USDT" ? amount : amount / rate;

  return NextResponse.json({
    currency_from: from.toLowerCase(),
    amount_from: amount,
    currency_to: to.toLowerCase(),
    estimated_amount: Math.round(estimated * 1e6) / 1e6,
    rate_inr_per_usdt: usdtInr,
  });
}
