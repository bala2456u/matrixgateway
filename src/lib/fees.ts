/**
 * Quote math. All INR amounts in rupees rounded to 2 decimals.
 * TDS: 1% under Section 194S, Income Tax Act (deducted on transfer of VDAs).
 */

export type QuoteBreakdown = {
  grossInr: number;
  platformFeeInr: number;
  tdsInr: number;
  netInr: number;
  platformFeeBps: number;
  tdsBps: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeQuote(cryptoAmount: number, rateInr: number): QuoteBreakdown {
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS ?? 50);
  const tdsBps = Number(process.env.TDS_BPS ?? 100);

  const grossInr = round2(cryptoAmount * rateInr);
  const platformFeeInr = round2((grossInr * platformFeeBps) / 10_000);
  // TDS is computed on consideration net of platform fee (simplified model)
  const tdsInr = round2(((grossInr - platformFeeInr) * tdsBps) / 10_000);
  const netInr = round2(grossInr - platformFeeInr - tdsInr);

  return { grossInr, platformFeeInr, tdsInr, netInr, platformFeeBps, tdsBps };
}

export const formatInr = (n: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n));
