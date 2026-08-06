import { prisma } from "./db";

/** Admin-editable platform configuration, with env fallbacks. */
export const SETTING_DEFAULTS = {
  service_fee_bps: process.env.SERVICE_FEE_BPS ?? "50", // 0.5% merchant commission
  payment_window_minutes: process.env.PAYMENT_WINDOW_MINUTES ?? "60",
  min_payment_usdt: "1",
  underpayment_tolerance_bps: "100", // within 1% counts as fully paid
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

let cache: { at: number; values: Record<string, string> } | null = null;
const TTL = 15_000;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.values as Record<SettingKey, string>;
  const values: Record<string, string> = { ...SETTING_DEFAULTS };
  try {
    for (const row of await prisma.platformSetting.findMany()) {
      if (row.key in SETTING_DEFAULTS) values[row.key] = row.value;
    }
  } catch {
    // table may not exist yet on a cold database — defaults are fine
  }
  cache = { at: Date.now(), values };
  return values as Record<SettingKey, string>;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await getSettings())[key];
}

export async function setSetting(key: SettingKey, value: string) {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache = null;
}
