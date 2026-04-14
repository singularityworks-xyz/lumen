import { randomBytes } from "node:crypto";
import { Client } from "pg";

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://lumen-sw:q4KVaf7YMfMMTpBMn39ZPMbVExt7P9@129.154.253.96:54669/lumendb";
const pgClient = new Client({ connectionString: dbUrl });
pgClient.connect();

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
  const userId = `e2e-user-${randomBytes(8).toString("hex")}`;
  const sessionId = `e2e-session-${randomBytes(8).toString("hex")}`;
  const sessionToken = `e2e-session-${userId}-${randomBytes(32).toString("base64url")}`;

  const { createHash } = await import("node:crypto");
  const hashedToken = createHash("sha256").update(sessionToken).digest("hex");

  await pgClient.query(
    `
    INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
  `,
    [userId, "E2E Test User", `${userId}@e2e.test`, true]
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pgClient.query(
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
  await pgClient.query(
    `DELETE FROM "session" WHERE id = $1 AND "userId" = $2`,
    [sessionId, userId]
  );
  await pgClient.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
}
