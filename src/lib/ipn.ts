import { createHmac, randomBytes } from "crypto";
import { prisma } from "./db";
import { publicPayment } from "./payments";

/**
 * Instant Payment Notification.
 *
 * Signature: HMAC-SHA512 of the JSON body with the merchant's IPN secret,
 * computed over the body with keys sorted, sent as `x-matrixgateway-sig`.
 * Sorting means the merchant can re-serialize and still match.
 */
export function ipnSignature(payload: unknown, secret: string) {
  const body = JSON.stringify(sortKeys(payload));
  return createHmac("sha512", secret).update(body).digest("hex");
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export function newIpnSecret() {
  return `ipn_${randomBytes(24).toString("base64url")}`;
}

type PaymentWithNetwork = Parameters<typeof publicPayment>[0] & { id: string; merchantId: string; ipnCallbackUrl: string | null };

/** Fire one IPN for a payment's current state; records the delivery attempt. */
export async function sendIpn(payment: PaymentWithNetwork) {
  const url = payment.ipnCallbackUrl;
  if (!url) return;

  const merchant = await prisma.user.findUnique({
    where: { id: payment.merchantId },
    select: { ipnSecret: true },
  });
  const secret = merchant?.ipnSecret;
  if (!secret) return;

  const payload = publicPayment(payment);
  const body = JSON.stringify(payload);
  const sig = ipnSignature(payload, secret);

  let statusCode: number | null = null;
  let success = false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-matrixgateway-sig": sig,
        "x-matrixgateway-event": `payment.${payload.payment_status}`,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    statusCode = res.status;
    success = res.ok;
  } catch {
    // network failure — recorded below, retried by the worker
  }

  await prisma.ipnDelivery
    .create({
      data: {
        paymentId: payment.id,
        url,
        eventType: `payment.${payload.payment_status}`,
        payload: payload as object,
        statusCode,
        success,
        attempts: 1,
        lastAttempt: new Date(),
      },
    })
    .catch(() => {});
}

/** Retry undelivered IPNs (called by the background worker). */
export async function retryFailedIpns() {
  const stale = await prisma.ipnDelivery.findMany({
    where: { success: false, attempts: { lt: 5 }, lastAttempt: { lt: new Date(Date.now() - 60_000) } },
    include: { payment: { select: { merchantId: true } } },
    take: 20,
  });

  for (const d of stale) {
    const merchant = await prisma.user.findUnique({
      where: { id: d.payment.merchantId },
      select: { ipnSecret: true },
    });
    if (!merchant?.ipnSecret) continue;

    const body = JSON.stringify(d.payload);
    const sig = ipnSignature(d.payload, merchant.ipnSecret);
    let statusCode: number | null = null;
    let success = false;
    try {
      const res = await fetch(d.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-matrixgateway-sig": sig,
          "x-matrixgateway-event": d.eventType,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      statusCode = res.status;
      success = res.ok;
    } catch {
      // still failing
    }
    await prisma.ipnDelivery.update({
      where: { id: d.id },
      data: { statusCode, success, attempts: { increment: 1 }, lastAttempt: new Date() },
    });
  }
}
