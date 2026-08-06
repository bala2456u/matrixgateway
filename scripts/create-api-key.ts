/**
 * Dev utility: mint an API key for a user.
 * Usage: npx tsx scripts/create-api-key.ts user@example.com [label]
 * Prints the raw key once; only its SHA-256 hash is stored.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomBytes } from "crypto";

try {
  process.loadEnvFile(".env");
} catch {}

const email = process.argv[2];
const label = process.argv[3] ?? "CLI-generated key";
if (!email) {
  console.error("Usage: npx tsx scripts/create-api-key.ts <email> [label]");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);
  const raw = `mg_live_${randomBytes(24).toString("base64url")}`;
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label,
      prefix: raw.slice(0, 15),
      keyHash: createHash("sha256").update(raw).digest("hex"),
    },
  });
  console.log(raw);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
