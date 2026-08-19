import { afterAll, afterEach, beforeEach, mock } from "bun:test";
import { createConnection } from "node:net";

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
  REDIS_URL: "redis://127.0.0.1:16379",
  JWKS_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  AI_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  GENERALCOMPUTE_API_KEY: "test-generalcompute-api-key",
  LOG_LEVEL: "error",
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

async function isDatabaseReachable(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return false;
  }

  const hostname = parsedUrl.hostname;
  const connectHost = hostname === "localhost" ? "127.0.0.1" : hostname;
  const port = Number.parseInt(parsedUrl.port || "5432", 10);

  if (!(connectHost && Number.isFinite(port) && port > 0)) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: connectHost, port, family: 4 });
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(100);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function checkPrismaAvailable(): Promise<boolean> {
  const databaseReachable = await isDatabaseReachable();
  if (!databaseReachable) {
    return false;
  }

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
  mock.restore();
});

afterAll(() => {
  for (const [key, originalValue] of Object.entries(originalEnv)) {
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});
