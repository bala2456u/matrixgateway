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
    // `prisma generate` runs at build time, where DATABASE_URL may not be
    // injected yet. It doesn't need a real URL — only `migrate` does, and that
    // runs at start-up with the real value.
    url: process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
});
