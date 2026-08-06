import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ACCESS_COOKIE, accessEnabled, accessToken } from "@/lib/access";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!accessEnabled()) return NextResponse.json({ ok: true });

  const ip = clientIp(req);
  if (!rateLimit(`access:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const supplied = Buffer.from(String(body.code ?? ""));
  const expected = Buffer.from(String(process.env.ACCESS_CODE));
  const ok = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (!ok) return NextResponse.json({ error: "Incorrect access code" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, accessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
