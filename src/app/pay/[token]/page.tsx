import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { createPayment, advancePayment, publicPayment } from "@/lib/payments";
import { Checkout } from "./checkout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Complete your payment" };

/**
 * Hosted checkout. Opening an invoice link spawns (or resumes) a payment and
 * shows the customer the amount, address and QR.
 */
export default async function PayPage(props: PageProps<"/pay/[token]">) {
  const { token } = await props.params;

  const invoice = await prisma.invoice.findUnique({
    where: { token },
    include: { merchant: { select: { businessName: true, fullName: true, brandColor: true } } },
  });
  if (!invoice) notFound();

  // Reuse an open payment for this invoice, otherwise create one
  const existing = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id, status: { in: ["WAITING", "CONFIRMING", "CONFIRMED", "SENDING"] } },
    orderBy: { createdAt: "desc" },
  });

  const payment = existing
    ? await advancePayment(existing.id)
    : await createPayment({
        merchantId: invoice.merchantId,
        priceAmount: Number(invoice.priceAmount),
        priceCurrency: invoice.priceCurrency,
        orderId: invoice.orderId,
        orderDescription: invoice.orderDescription,
        ipnCallbackUrl: invoice.ipnCallbackUrl,
        successUrl: invoice.successUrl,
        cancelUrl: invoice.cancelUrl,
        invoiceId: invoice.id,
      });
  if (!payment) notFound();

  const networks = await prisma.assetNetwork.findMany({
    where: { enabled: true, asset: { symbol: "USDT" } },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, avgSettleMinutes: true, recommended: true },
  });

  return (
    <Checkout
      merchantName={invoice.merchant.businessName ?? invoice.merchant.fullName}
      brandColor={invoice.merchant.brandColor ?? "#10b981"}
      token={token}
      networks={networks}
      initial={{
        ...publicPayment(payment),
        events: payment.events.map((e) => ({
          status: e.status,
          message: e.message,
          at: e.createdAt.toISOString(),
        })),
      }}
    />
  );
}
