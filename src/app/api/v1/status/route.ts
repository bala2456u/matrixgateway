import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health probe for merchants integrating the API. */
export async function GET() {
  return NextResponse.json({ message: "OK" });
}
