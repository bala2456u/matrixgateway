/**
 * Live INR rate engine.
 * Primary source: CoinGecko simple-price API (no key required, rate-limited).
 * Falls back to last-known or static rates if the network call fails,
 * so the platform keeps functioning offline / in sandboxes.
 */

type RateMap = Record<string, number>; // coingeckoId -> INR

const FALLBACK_RATES: RateMap = {
  bitcoin: 8_200_000,
  ethereum: 310_000,
  tether: 88.5,
  solana: 16_500,
};

let cache: { rates: RateMap; fetchedAt: number } | null = null;
const TTL_MS = 30_000;

export async function getRates(coingeckoIds: string[]): Promise<{ rates: RateMap; live: boolean; fetchedAt: number }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS && coingeckoIds.every((id) => id in cache!.rates)) {
    return { rates: cache.rates, live: true, fetchedAt: cache.fetchedAt };
  }

  try {
    const ids = coingeckoIds.join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr`,
      { signal: AbortSignal.timeout(5000), next: { revalidate: 0 } }
    );
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const data = (await res.json()) as Record<string, { inr: number }>;
    const rates: RateMap = {};
    for (const [id, v] of Object.entries(data)) {
      if (v?.inr > 0) rates[id] = v.inr;
    }
    if (Object.keys(rates).length === 0) throw new Error("empty rates");
    cache = { rates: { ...FALLBACK_RATES, ...cache?.rates, ...rates }, fetchedAt: now };
    return { rates: cache.rates, live: true, fetchedAt: now };
  } catch {
    const rates = cache?.rates ?? FALLBACK_RATES;
    return { rates, live: false, fetchedAt: cache?.fetchedAt ?? now };
  }
}
