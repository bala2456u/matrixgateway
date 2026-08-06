import { createHmac } from "crypto";
import { prisma } from "./db";

/**
 * Deliver an event to all of a user's enabled webhook endpoints.
 * Signature scheme (Stripe-style):
 *   X-MatrixGateway-Signature: t=<unix>,v1=HMAC_SHA256(secret, "<t>.<body>")
 */
export async function dispatchWebhooks(userId: string, eventType: string, data: unknown) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId, enabled: true },
  });
  if (endpoints.length === 0) return;

  const payload = { id: `evt_${Date.now().toString(36)}`, type: eventType, created: Math.floor(Date.now() / 1000), data };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const t = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", ep.secret).update(`${t}.${body}`).digest("hex");
      let statusCode: number | null = null;
      let success = false;
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MatrixGateway-Signature": `t=${t},v1=${sig}`,
            "X-MatrixGateway-Event": eventType,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        statusCode = res.status;
        success = res.ok;
      } catch {
        // network error; recorded as failed delivery
      }
      await prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          eventType,
          payload: payload as object,
          statusCode,
          success,
          attempts: 1,
          lastAttempt: new Date(),
        },
      });
    })
  );
}
