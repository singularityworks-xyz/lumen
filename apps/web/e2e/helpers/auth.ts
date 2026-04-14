import { randomBytes } from "node:crypto";
import { Client } from "pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required for E2E tests"
  );
}

let pgClient: Client | null = null;
let pgConnectPromise: Promise<unknown> | null = null;

async function getPgClient(): Promise<Client> {
  if (!pgClient) {
    pgClient = new Client({ connectionString: dbUrl });
  }

  if (!pgConnectPromise) {
    pgConnectPromise = pgClient.connect();
  }

  await pgConnectPromise;
  return pgClient;
}

export interface SeedResult {
  cookieValue: string;
  sessionId: string;
  sessionToken: string;
  storageState: {
    cookies: Array<{
      domain: string;
      expires: number;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "Strict" | "None";
      secure: boolean;
      value: string;
    }>;
    origins: {
      origin: string;
      localStorage: { name: string; value: string }[];
    }[];
  };
  userId: string;
}

export async function seedE2EAuth(): Promise<SeedResult> {
  const client = await getPgClient();
  const userId = `e2e-user-${randomBytes(8).toString("hex")}`;
  const sessionId = `e2e-session-${randomBytes(8).toString("hex")}`;
  const sessionToken = `e2e-session-${userId}-${randomBytes(32).toString("base64url")}`;

  const { createHash } = await import("node:crypto");
  const hashedToken = createHash("sha256").update(sessionToken).digest("hex");

  await client.query(
    `
    INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
  `,
    [userId, "E2E Test User", `${userId}@e2e.test`, true]
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await client.query(
    `
    INSERT INTO "session" (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
  `,
    [sessionId, userId, hashedToken, expiresAt]
  );

  console.log(
    `Seeded E2E auth into DB (via pg): userId=${userId}, sessionId=${sessionId}`
  );

  const cookieName = "better-auth.session_token";
  const cookieValue = `${cookieName}=${sessionToken}`;

  const storageState: SeedResult["storageState"] = {
    cookies: [
      {
        name: cookieName,
        value: sessionToken,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(expiresAt.getTime() / 1000),
      },
    ],
    origins: [],
  };

  return {
    userId,
    sessionId,
    sessionToken,
    cookieValue,
    storageState,
  };
}

export async function cleanupE2EAuth(
  userId: string,
  sessionId: string
): Promise<void> {
  const client = await getPgClient();
  await client.query(`DELETE FROM "session" WHERE id = $1 AND "userId" = $2`, [
    sessionId,
    userId,
  ]);
  await client.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
}

export async function closeE2EAuthDb(): Promise<void> {
  if (!pgClient) {
    return;
  }

  try {
    await pgClient.end();
  } finally {
    pgClient = null;
    pgConnectPromise = null;
  }
}

let shutdownPromise: Promise<void> | null = null;

const handleProcessShutdown = (): void => {
  if (!shutdownPromise) {
    shutdownPromise = closeE2EAuthDb();
  }
};

process.once("beforeExit", handleProcessShutdown);
process.once("SIGINT", handleProcessShutdown);
process.once("SIGTERM", handleProcessShutdown);
