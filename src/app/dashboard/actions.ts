"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateApiKey, generateWebhookSecret } from "@/lib/ids";

export type ActionResult = { ok: boolean; error?: string; secret?: string };

// ---------- KYC ----------

const kycSchema = z.object({
  panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN (e.g. ABCDE1234F)"),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your Aadhaar"),
  dateOfBirth: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date of birth"),
  addressLine: z.string().trim().min(5, "Enter your address"),
  city: z.string().trim().min(2, "Enter your city"),
  state: z.string().trim().min(2, "Enter your state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
});

export async function submitKyc(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.kycStatus === "VERIFIED") return { ok: false, error: "KYC is already verified" };
  if (user.kycStatus === "PENDING") return { ok: false, error: "KYC is already under review" };

  const parsed = kycSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  await prisma.kycProfile.upsert({
    where: { userId: user.id },
    update: { ...d, dateOfBirth: new Date(d.dateOfBirth), status: "PENDING", rejectReason: null, submittedAt: new Date() },
    create: { ...d, dateOfBirth: new Date(d.dateOfBirth), userId: user.id, status: "PENDING" },
  });
  await prisma.user.update({ where: { id: user.id }, data: { kycStatus: "PENDING" } });
  await audit("kyc.submit", { userId: user.id });
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------- Bank accounts ----------

const bankSchema = z.object({
  accountHolder: z.string().trim().min(2, "Enter the account holder name"),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Enter a valid account number (9–18 digits)"),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC (e.g. HDFC0001234)"),
  bankName: z.string().trim().min(2, "Enter the bank name"),
  upiId: z.string().trim().optional().or(z.literal("")),
});

export async function addBank(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = bankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const count = await prisma.bankAccount.count({ where: { userId: user.id } });
  await prisma.bankAccount.create({
    data: { ...parsed.data, upiId: parsed.data.upiId || null, userId: user.id, isDefault: count === 0 },
  });
  await audit("bank.add", { userId: user.id });
  revalidatePath("/dashboard/banks");
  return { ok: true };
}

export async function deleteBank(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const bank = await prisma.bankAccount.findFirst({ where: { id, userId: user.id }, include: { payouts: { select: { id: true }, take: 1 } } });
  if (!bank) return { ok: false, error: "Not found" };
  if (bank.payouts.length > 0) return { ok: false, error: "This account has payouts and cannot be removed" };
  await prisma.bankAccount.delete({ where: { id } });
  await audit("bank.delete", { userId: user.id });
  revalidatePath("/dashboard/banks");
  return { ok: true };
}

// ---------- API keys ----------

export async function createApiKey(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim() || "Default key";
  const active = await prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (active >= 5) return { ok: false, error: "Maximum 5 active keys. Revoke one first." };

  const { raw, prefix, keyHash } = generateApiKey();
  await prisma.apiKey.create({ data: { userId: user.id, label, prefix, keyHash } });
  await audit("apikey.create", { userId: user.id, detail: prefix });
  revalidatePath("/dashboard/developer");
  // The raw key is returned exactly once; only its hash is stored.
  return { ok: true, secret: raw };
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const key = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
  if (!key) return { ok: false, error: "Not found" };
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit("apikey.revoke", { userId: user.id, detail: key.prefix });
  revalidatePath("/dashboard/developer");
  return { ok: true };
}

// ---------- Webhook endpoints ----------

const webhookSchema = z.object({
  url: z.string().trim().url("Enter a valid https:// URL").refine((u) => u.startsWith("https://") || u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1"), "URL must use HTTPS (localhost allowed for testing)"),
});

export async function addWebhook(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = webhookSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" };
  const count = await prisma.webhookEndpoint.count({ where: { userId: user.id } });
  if (count >= 5) return { ok: false, error: "Maximum 5 endpoints" };

  const secret = generateWebhookSecret();
  await prisma.webhookEndpoint.create({ data: { userId: user.id, url: parsed.data.url, secret } });
  await audit("webhook.add", { userId: user.id, detail: parsed.data.url });
  revalidatePath("/dashboard/developer");
  return { ok: true, secret };
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const ep = await prisma.webhookEndpoint.findFirst({ where: { id, userId: user.id } });
  if (!ep) return { ok: false, error: "Not found" };
  await prisma.webhookEndpoint.delete({ where: { id } });
  await audit("webhook.delete", { userId: user.id, detail: ep.url });
  revalidatePath("/dashboard/developer");
  return { ok: true };
}
