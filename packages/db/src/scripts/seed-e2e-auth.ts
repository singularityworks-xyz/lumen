import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../index";

interface SeedResult {
  cookieValue: string;
  sessionId: string;
  sessionToken: string;
  storageState: {
    cookies: Array<{
      domain: string;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "Strict" | "None";
      secure: boolean;
      value: string;
    }>;
  };
  userId: string;
}

export async function seedE2EAuth(dbUrl?: string): Promise<SeedResult> {
  const userId = `e2e-user-${randomBytes(8).toString("hex")}`;
  const sessionId = `e2e-session-${randomBytes(8).toString("hex")}`;
  const sessionToken = `${randomBytes(32).toString("base64url")}.${randomBytes(16).toString("base64url")}`;

  if (dbUrl) {
    process.env.DATABASE_URL ??= dbUrl;
  }

  await prisma.user.create({
    data: {
      id: userId,
      name: "E2E Test User",
      email: `${userId}@e2e.test`,
      emailVerified: true,
    },
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(
    `Seeded E2E auth into DB: userId=${userId}, sessionId=${sessionId}`
  );

  const cookieName = "better-auth.session_token";
  const cookieValue = `${cookieName}=${sessionToken}`;

  const storageState: SeedResult["storageState"] = {
    cookies: [
      {
        name: cookieName,
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ],
  };

  return {
    userId,
    sessionId,
    sessionToken,
    cookieValue,
    storageState,
  };
}

export function writeStorageState(
  result: SeedResult,
  outputPath = "apps/web/e2e/fixtures/storage-state.json"
): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(result.storageState, null, 2));
  console.log(`Storage state written to: ${outputPath}`);
}

export async function cleanupE2EAuth(
  userId: string,
  sessionId: string
): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  await prisma.user.deleteMany({ where: { id: userId } });

  console.log(`Cleaned up E2E auth: userId=${userId}, sessionId=${sessionId}`);
}
