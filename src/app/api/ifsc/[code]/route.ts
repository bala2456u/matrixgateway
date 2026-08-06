import { NextResponse } from "next/server";

/**
 * IFSC lookup: resolves bank + branch from an IFSC code.
 * Primary source: Razorpay's public IFSC API; falls back to a local
 * bank-code map so the form still autofills offline.
 */
const BANK_CODES: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  YESB: "Yes Bank",
  IDFB: "IDFC FIRST Bank",
  INDB: "IndusInd Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IOBA: "Indian Overseas Bank",
  IDIB: "Indian Bank",
  FDRL: "Federal Bank",
  RATN: "RBL Bank",
  AUBL: "AU Small Finance Bank",
  PYTM: "Paytm Payments Bank",
  AIRP: "Airtel Payments Bank",
};

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const ifsc = code.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return NextResponse.json({ error: "Invalid IFSC format" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const data = (await res.json()) as { BANK?: string; BRANCH?: string; CITY?: string };
      return NextResponse.json({
        ifsc,
        bank: data.BANK ?? BANK_CODES[ifsc.slice(0, 4)] ?? null,
        branch: data.BRANCH ?? null,
        city: data.CITY ?? null,
        source: "live",
      });
    }
    if (res.status === 404) {
      return NextResponse.json({ error: "IFSC not found" }, { status: 404 });
    }
  } catch {
    // network unavailable — fall through to local map
  }

  const bank = BANK_CODES[ifsc.slice(0, 4)];
  if (!bank) return NextResponse.json({ error: "IFSC not found" }, { status: 404 });
  return NextResponse.json({ ifsc, bank, branch: null, city: null, source: "local" });
}
