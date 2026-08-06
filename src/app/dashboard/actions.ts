"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateApiKey, generateWebhookSecret } from "@/lib/ids";
import { newInvoiceToken } from "@/lib/payments";
import { newIpnSecret } from "@/lib/ipn";
import { baseUrl } from "@/lib/urls";

export type ActionResult = { ok: boolean; error?: string; secret?: string; url?: string };

// ---------- Payment links ----------

const linkSchema = z.object({
  priceAmount: z.coerce.number().positive("Enter an amount greater than zero"),
  priceCurrency: z.enum(["INR", "USD", "USDT"]).default("INR"),
  orderId: z.string().trim().max(200).optional().or(z.literal("")),
  orderDescription: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function createPaymentLink(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const invoice = await prisma.invoice.create({
    data: {
      token: newInvoiceToken(),
      merchantId: user.id,
      priceAmount: d.priceAmount.toString(),
      priceCurrency: d.priceCurrency,
      payCurrency: "USDT",
      orderId: d.orderId || null,
      orderDescription: d.orderDescription || null,
    },
  });
  await audit("invoice.create", { userId: user.id, detail: invoice.token });
  revalidatePath("/dashboard/links");
  return { ok: true, url: `${baseUrl()}/pay/${invoice.token}` };
}

export async function deletePaymentLink(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const inv = await prisma.invoice.findFirst({
    where: { id, merchantId: user.id },
    include: { payments: { select: { id: true }, take: 1 } },
  });
  if (!inv) return { ok: false, error: "Not found" };
  if (inv.payments.length > 0) return { ok: false, error: "This link already has payments and can't be deleted" };
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/dashboard/links");
  return { ok: true };
}

// ---------- Merchant profile & IPN ----------

export async function saveMerchantProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const businessName = String(formData.get("businessName") ?? "").trim().slice(0, 120);
  const brandColor = String(formData.get("brandColor") ?? "").trim();
  if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    return { ok: false, error: "Brand colour must be a hex value like #10b981" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { businessName: businessName || null, brandColor: brandColor || "#10b981" },
  });
  await audit("merchant.profile_update", { userId: user.id });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function rotateIpnSecret(): Promise<ActionResult> {
  const user = await requireUser();
  const secret = newIpnSecret();
  await prisma.user.update({ where: { id: user.id }, data: { ipnSecret: secret } });
  await audit("merchant.ipn_rotate", { userId: user.id });
  revalidatePath("/dashboard/settings");
  return { ok: true, secret };
}

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
