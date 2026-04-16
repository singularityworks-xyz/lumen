import { randomBytes } from "node:crypto";
import { prisma } from "@lumen/db";

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

  await prisma.user.create({
    data: {
      id: userId,
      name: "E2E Test User",
      email: `${userId}@e2e.test`,
      emailVerified: true,
    },
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: sessionToken,
      expiresAt,
    },
  });

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
  await prisma.session.deleteMany({
    where: {
      id: sessionId,
      userId,
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: userId,
    },
  });
}

export async function closeE2EAuthDb(): Promise<void> {
  await prisma.$disconnect();
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
