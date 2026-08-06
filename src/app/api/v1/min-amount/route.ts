import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/v1/min-amount?currency_from=usdt&fiat_equivalent=inr */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fiat = (url.searchParams.get("fiat_equivalent") ?? "INR").toUpperCase();

  const settings = await getSettings();
  const min = Number(settings.min_payment_usdt);

  const asset = await prisma.asset.findUnique({ where: { symbol: "USDT" } });
  let equivalent: number | null = null;
  if (asset) {
    const { rates } = await getRates([asset.coingeckoId]);
    const usdtInr = rates[asset.coingeckoId];
    if (usdtInr) {
      const rate = fiat === "INR" ? usdtInr : fiat === "USD" ? usdtInr / 88 : 1;
      equivalent = Math.round(min * rate * 100) / 100;
    }
  }

  return NextResponse.json({
    currency_from: "usdt",
    currency_to: "usdt",
    min_amount: min,
    fiat_equivalent: equivalent,
    fiat_currency: fiat.toLowerCase(),
  });
}
