import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile(".env");
} catch {}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type NetworkSeed = {
  code: string;
  name: string;
  addressFamily: "TRON" | "EVM" | "SOLANA" | "BITCOIN";
  confirmationsRequired: number;
  avgSettleMinutes: number;
  feeNote?: string;
  depositAddress?: string; // sandbox placeholder gateway wallet — admin replaces in Admin → Wallets
  recommended?: boolean;
  sortOrder: number;
};

type AssetSeed = {
  symbol: string;
  name: string;
  coingeckoId: string;
  decimals: number;
  minSellAmount: string;
  sortOrder: number;
  featured?: boolean;
  networks: NetworkSeed[];
};

const assets: AssetSeed[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
    coingeckoId: "tether",
    decimals: 6,
    minSellAmount: "1",
    sortOrder: 0,
    featured: true,
    networks: [
      {
        code: "TRC20",
        name: "Tron (TRC-20)",
        addressFamily: "TRON",
        confirmationsRequired: 1,
        avgSettleMinutes: 2,
        feeNote: "Lowest network fees — recommended",
        depositAddress: "TSandbxGatewayWa11etTRC20DoNotUse111",
        recommended: true,
        sortOrder: 0,
      },
      {
        code: "BEP20",
        name: "BNB Smart Chain (BEP-20)",
        addressFamily: "EVM",
        confirmationsRequired: 3,
        avgSettleMinutes: 3,
        feeNote: "Low fees",
        depositAddress: "0x5and60x6a7eWa11e78ep20d0no7u5e000000",
        sortOrder: 1,
      },
      {
        code: "SOL",
        name: "Solana (SPL)",
        addressFamily: "SOLANA",
        confirmationsRequired: 1,
        avgSettleMinutes: 1,
        feeNote: "Fastest settlement",
        sortOrder: 2,
      },
      {
        code: "ERC20",
        name: "Ethereum (ERC-20)",
        addressFamily: "EVM",
        confirmationsRequired: 6,
        avgSettleMinutes: 8,
        feeNote: "Higher gas fees",
        sortOrder: 3,
      },
    ],
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    coingeckoId: "bitcoin",
    decimals: 8,
    minSellAmount: "0.0002",
    sortOrder: 1,
    networks: [
      {
        code: "BTC",
        name: "Bitcoin",
        addressFamily: "BITCOIN",
        confirmationsRequired: 2,
        avgSettleMinutes: 20,
        sortOrder: 0,
      },
    ],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    decimals: 8,
    minSellAmount: "0.005",
    sortOrder: 2,
    networks: [
      {
        code: "ERC20",
        name: "Ethereum (ERC-20)",
        addressFamily: "EVM",
        confirmationsRequired: 6,
        avgSettleMinutes: 8,
        sortOrder: 0,
      },
    ],
  },
  {
    symbol: "SOL",
    name: "Solana",
    coingeckoId: "solana",
    decimals: 8,
    minSellAmount: "0.1",
    sortOrder: 3,
    networks: [
      {
        code: "SOL",
        name: "Solana",
        addressFamily: "SOLANA",
        confirmationsRequired: 1,
        avgSettleMinutes: 1,
        sortOrder: 0,
      },
    ],
  },
];

async function main() {
  for (const a of assets) {
    const { networks, ...assetData } = a;
    const asset = await prisma.asset.upsert({
      where: { symbol: a.symbol },
      update: assetData,
      create: assetData,
    });
    for (const n of networks) {
      // Never overwrite an admin-configured gateway wallet on reseed
      const { depositAddress, ...updatable } = n;
      await prisma.assetNetwork.upsert({
        where: { assetId_code: { assetId: asset.id, code: n.code } },
        update: updatable,
        create: { ...n, assetId: asset.id },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@matrixgateway.co.in";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        fullName: "Platform Admin",
        role: "ADMIN",
        kycStatus: "VERIFIED",
      },
    });
    console.log(`Seeded admin user: ${adminEmail} / ${adminPassword}`);
    console.log("(shown once — change it after first login)");
  } else {
    console.log("Admin user already exists, skipping.");
  }

  console.log(`Seeded ${assets.length} assets with networks.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
