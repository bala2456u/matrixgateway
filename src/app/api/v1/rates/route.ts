import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";

/** Public: live INR rates for all supported assets and their networks. */
export async function GET() {
  const assets = await prisma.asset.findMany({
    where: { enabled: true },
    include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  const { rates, live, fetchedAt } = await getRates(assets.map((a) => a.coingeckoId));
  return NextResponse.json({
    object: "rates",
    live,
    fetched_at: new Date(fetchedAt).toISOString(),
    data: assets.map((a) => ({
      asset: a.symbol,
      name: a.name,
      rate_inr: rates[a.coingeckoId] ?? null,
      min_sell_amount: String(a.minSellAmount),
      networks: a.networks.map((n) => ({
        code: n.code,
        name: n.name,
        confirmations_required: n.confirmationsRequired,
        avg_settle_minutes: n.avgSettleMinutes,
        recommended: n.recommended,
      })),
    })),
  });
}
