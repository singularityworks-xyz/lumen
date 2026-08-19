import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env (gitignored secrets) first. dotenv never overrides existing
// values, so the process environment always wins.
loadEnv();

// The committed .env.development dev defaults (loopback DATABASE_URL) are
// loaded only in local development — never in production, where DATABASE_URL
// must come from the deployment environment.
const nodeEnv = process.env.NODE_ENV ?? "development";
if (nodeEnv !== "production") {
  loadEnv({ path: ".env.development", quiet: true });
} else if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required in production. Set it in the deployment environment (Dokploy)."
  );
  process.exit(1);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
