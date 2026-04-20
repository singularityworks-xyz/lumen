import { randomBytes } from "node:crypto";
import { prisma } from "@lumen/db";

const MAX_PRISMA_RETRY_ATTEMPTS = 5;
const BASE_PRISMA_RETRY_DELAY_MS = 100;

function isRetryablePrismaError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (maybeCode === "P1008" || maybeCode === "P2024") {
      return true;
    }
  }

  if (error instanceof Error) {
    return error.message.includes("Operation has timed out");
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_PRISMA_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const canRetry = isRetryablePrismaError(error);
      if (!canRetry || attempt === MAX_PRISMA_RETRY_ATTEMPTS) {
        throw error;
      }

      const backoffMs =
        BASE_PRISMA_RETRY_DELAY_MS * 2 ** (attempt - 1) +
        Math.floor(Math.random() * BASE_PRISMA_RETRY_DELAY_MS);

      console.warn(
        `[e2e-auth] ${operationName} failed (attempt ${attempt}/${MAX_PRISMA_RETRY_ATTEMPTS}), retrying in ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }

  throw new Error(`Unexpected retry loop exit for ${operationName}`);
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
  const userId = `e2e-user-${randomBytes(8).toString("hex")}`;
  const sessionId = `e2e-session-${randomBytes(8).toString("hex")}`;
  const sessionToken = `e2e-session-${userId}-${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let userCreated = false;

  try {
    await withPrismaRetry(
      () =>
        prisma.user.create({
          data: {
            id: userId,
            name: "E2E Test User",
            email: `${userId}@e2e.test`,
            emailVerified: true,
          },
        }),
      "create e2e user"
    );
    userCreated = true;

    await withPrismaRetry(
      () =>
        prisma.session.create({
          data: {
            id: sessionId,
            userId,
            token: sessionToken,
            expiresAt,
          },
        }),
      "create e2e session"
    );
  } catch (error) {
    if (userCreated) {
      await prisma.user.deleteMany({
        where: {
          id: userId,
        },
      });
    }
    throw error;
  }

  console.log(
    `Seeded E2E auth into DB (via Prisma): userId=${userId}, sessionId=${sessionId}`
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
  await withPrismaRetry(
    () =>
      prisma.session.deleteMany({
        where: {
          id: sessionId,
          userId,
        },
      }),
    "cleanup e2e session"
  );

  await withPrismaRetry(
    () =>
      prisma.user.deleteMany({
        where: {
          id: userId,
        },
      }),
    "cleanup e2e user"
  );
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
