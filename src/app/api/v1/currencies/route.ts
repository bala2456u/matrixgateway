import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Currencies the gateway accepts, one entry per USDT network. */
export async function GET() {
  const networks = await prisma.assetNetwork.findMany({
    where: { enabled: true, asset: { symbol: "USDT", enabled: true } },
    include: { asset: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    currencies: networks.map((n) => `usdt${n.code.toLowerCase()}`),
    data: networks.map((n) => ({
      code: `USDT${n.code}`,
      name: `${n.asset.name} (${n.name})`,
      currency: "USDT",
      network: n.code,
      network_name: n.name,
      confirmations_required: n.confirmationsRequired,
      avg_settle_minutes: n.avgSettleMinutes,
      recommended: n.recommended,
      enable: true,
    })),
  });
}
