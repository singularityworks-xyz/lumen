import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

interface SeedResult {
  cookieValue: string;
  sessionId: string;
  sessionToken: string;
  storageState: {
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "Lax" | "Strict" | "None";
    }>;
  };
  userId: string;
}

export function seedE2EAuth(_dbUrl?: string): SeedResult {
  const userId = `e2e-user-${randomBytes(8).toString("hex")}`;
  const sessionId = `e2e-session-${randomBytes(8).toString("hex")}`;
  const sessionToken = `${randomBytes(32).toString("base64url")}.${randomBytes(16).toString("base64url")}`;

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

  console.log(`Seeded E2E auth: userId=${userId}, sessionId=${sessionId}`);

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
