import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";

export async function GET() {
  const assets = await prisma.asset.findMany({
    where: { enabled: true },
    include: { networks: { where: { enabled: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  const { rates, live, fetchedAt } = await getRates(assets.map((a) => a.coingeckoId));
  return NextResponse.json({
    live,
    fetched_at: new Date(fetchedAt).toISOString(),
    assets: assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      featured: a.featured,
      min_sell_amount: String(a.minSellAmount),
      rate_inr: rates[a.coingeckoId] ?? null,
      networks: a.networks.map((n) => ({
        code: n.code,
        name: n.name,
        confirmations_required: n.confirmationsRequired,
        avg_settle_minutes: n.avgSettleMinutes,
        recommended: n.recommended,
        fee_note: n.feeNote,
      })),
    })),
  });
}
