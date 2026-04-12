import { afterEach, beforeEach, mock } from "bun:test";

const originalEnv: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
};

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/lumen_test";

const TEST_ENV: Record<string, string> = {
  NODE_ENV: "development",
  PORT: "3999",
  WEB_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3002",
  BETTER_AUTH_SECRET: "test-secret-key-that-is-at-least-21-chars",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  DATABASE_URL: "postgresql://test:test@localhost:5432/lumen_test",
  JWKS_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  LOG_LEVEL: "error",
  OTEL_ENABLED: "false",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (key !== "DATABASE_URL") {
    originalEnv[key] = process.env[key];
  }
  process.env[key] = value;
}

const TABLES_TO_CLEAN = [
  "ai_message",
  "ai_conversation",
  "workspace_state",
  "workspace_collaborator",
  "workspace_share",
  "workspace",
  "one_time_auth_token",
  "verification",
  "account",
  "session",
  "jwks",
  "user",
];

let prismaAvailable = false;

async function getPrisma() {
  const { prisma } = await import("../index");
  return prisma;
}

async function checkPrismaAvailable(): Promise<boolean> {
  try {
    const prisma = await getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function truncateAllTables(): Promise<void> {
  if (!prismaAvailable) {
    return;
  }

  try {
    const prisma = await getPrisma();
    for (const table of TABLES_TO_CLEAN) {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${table}" CASCADE`
        );
      } catch {
        // table may not exist in some configurations
      }
    }
  } catch {
    // prisma not available, skip cleanup
  }
}

// Check once at setup time if Prisma/DB is available
prismaAvailable = await checkPrismaAvailable();

beforeEach(async () => {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }

  await truncateAllTables();
});

afterEach(() => {
  for (const [key, originalValue] of Object.entries(originalEnv)) {
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
  mock.restore();
});
