import type {
  SessionModel,
  UserModel,
} from "@lumen/db/prisma/generated/prisma/models";
import { createLogger } from "@lumen/logger";
import type { AuthSession } from "./types";

const logger = createLogger({ name: "auth:session" });
const SESSION_TOKEN_REGEX = /better-auth\.session_token=([^;]+)/;

export function isSessionValid(session: SessionModel): boolean {
  const now = new Date();
  const isValid = session.expiresAt > now;

  if (!isValid) {
    logger.info("Session expired", {
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      now: now.toISOString(),
    });
  }

  return isValid;
}

export function formatAuthSession(
  user: UserModel,
  session: SessionModel
): AuthSession {
  return {
    user,
    session,
  };
}

export function extractSessionToken(headers: Headers): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) {
    return null;
  }

  const tokenMatch = cookie.match(SESSION_TOKEN_REGEX);
  return tokenMatch ? tokenMatch[1] : null;
}

export function logSessionActivity(
  action: string,
  sessionId: string,
  userId: string,
  metadata?: Record<string, unknown>
) {
  logger.info(`Session ${action}`, {
    sessionId,
    userId,
    ...metadata,
  });
}
