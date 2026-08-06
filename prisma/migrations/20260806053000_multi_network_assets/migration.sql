-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "confirmationsRequired",
DROP COLUMN "network",
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "SellOrder" ADD COLUMN     "networkId" TEXT;

-- CreateTable
CREATE TABLE "AssetNetwork" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressFamily" TEXT NOT NULL,
    "confirmationsRequired" INTEGER NOT NULL DEFAULT 2,
    "avgSettleMinutes" INTEGER NOT NULL DEFAULT 2,
    "feeNote" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssetNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetNetwork_assetId_code_key" ON "AssetNetwork"("assetId", "code");

-- AddForeignKey
ALTER TABLE "AssetNetwork" ADD CONSTRAINT "AssetNetwork_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellOrder" ADD CONSTRAINT "SellOrder_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "AssetNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
