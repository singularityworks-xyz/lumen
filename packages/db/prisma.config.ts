import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env (gitignored secrets) first, then committed .env.development
// dev defaults. dotenv never overrides existing values, so the process
// environment and .env always win over .env.development — in containers
// (prisma-sync) DATABASE_URL comes from the deployment env and this file
// is excluded by .dockerignore anyway.
loadEnv();
loadEnv({ path: ".env.development", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
