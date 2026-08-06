import { defineConfig } from "prisma/config";

// Prisma 7 CLI does not auto-load .env
try {
  process.loadEnvFile(".env");
} catch {
  // .env may not exist in CI; env vars come from the environment
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
});
