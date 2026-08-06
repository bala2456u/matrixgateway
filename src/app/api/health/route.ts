import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { liveNetworkCodes } from "@/lib/chains";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for the platform host. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
  return NextResponse.json({
    status: "ok",
    mode: process.env.GATEWAY_MODE ?? "sandbox",
    live_networks: liveNetworkCodes(),
  });
}
