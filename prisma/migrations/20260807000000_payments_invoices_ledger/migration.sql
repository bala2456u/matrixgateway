-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('WAITING', 'CONFIRMING', 'CONFIRMED', 'SENDING', 'PARTIALLY_PAID', 'FINISHED', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PAYMENT_CREDIT', 'SERVICE_FEE', 'PAYOUT_DEBIT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "ipnSecret" TEXT,
ADD COLUMN     "brandColor" TEXT DEFAULT '#10b981';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "priceAmount" DECIMAL(18,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'INR',
    "payCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "orderId" TEXT,
    "orderDescription" TEXT,
    "ipnCallbackUrl" TEXT,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "priceAmount" DECIMAL(18,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'INR',
    "payCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "payAmount" DECIMAL(28,10) NOT NULL,
    "actuallyPaid" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "lockedRateInr" DECIMAL(18,4) NOT NULL,
    "networkId" TEXT NOT NULL,
    "payAddress" TEXT NOT NULL,
    "serviceFee" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "outcomeAmount" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'WAITING',
    "txHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "orderDescription" TEXT,
    "purchaseId" TEXT,
    "ipnCallbackUrl" TEXT,
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "createdViaApiKeyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(28,10) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpnDelivery" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpnDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_token_key" ON "Invoice"("token");

-- CreateIndex
CREATE INDEX "Invoice_merchantId_createdAt_idx" ON "Invoice"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentId_key" ON "Payment"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_merchantId_createdAt_idx" ON "Payment"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_txHash_idx" ON "Payment"("txHash");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_merchantId_createdAt_idx" ON "LedgerEntry"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "IpnDelivery_success_attempts_idx" ON "IpnDelivery"("success", "attempts");

-- CreateIndex
CREATE INDEX "IpnDelivery_paymentId_createdAt_idx" ON "IpnDelivery"("paymentId", "createdAt");

-- AddForeignKey
ALTER TABLE "IpnDelivery" ADD CONSTRAINT "IpnDelivery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "AssetNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
