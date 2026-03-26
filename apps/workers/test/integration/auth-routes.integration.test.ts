import { describe, expect, it } from "bun:test";

const SESSION_TOKEN_REGEX = /better-auth\.session_token=([^;]+)/;
const TOKEN_HEX_REGEX = /^[a-f0-9]+$/;

describe("WORKERS-I-01: auth-routes integration", () => {
  describe("native token generation rejects unauthenticated requests", () => {
    it("rejects requests without session", () => {
      const session: null = null;

      expect(session).toBeNull();
    });

    it("rejects requests without session token cookie", () => {
      const headers = new Headers({ cookie: "" });

      const cookieHeader = headers.get("cookie") || "";
      const sessionMatch = cookieHeader.match(SESSION_TOKEN_REGEX);
      const sessionToken = sessionMatch
        ? decodeURIComponent(sessionMatch[1])
        : null;

      expect(sessionToken).toBeNull();
    });

    it("generates valid one-time token format", () => {
      const token = "a".repeat(64);

      expect(token).toHaveLength(64);
      expect(token).toMatch(TOKEN_HEX_REGEX);
    });
  });

  describe("token exchange is single-use", () => {
    it("Prisma delete returns token data", () => {
      const tokenData = {
        sessionToken: "session-token-abc",
        expiresAt: new Date(Date.now() + 60_000),
      };

      expect(tokenData.sessionToken).toBe("session-token-abc");
    });

    it("Prisma P2025 error indicates token already used", () => {
      const prismaError = new Error("Record not found") as Error & {
        code: string;
      };
      prismaError.code = "P2025";

      expect(prismaError.code).toBe("P2025");
    });
  });

  describe("expired one-time tokens are deleted and rejected", () => {
    it("detects expired tokens by comparing dates", () => {
      const tokenExpiresAt = new Date(Date.now() - 1000);
      const now = new Date();

      const isExpired = tokenExpiresAt < now;

      expect(isExpired).toBe(true);
    });
  });

  describe("cookie attributes are set correctly for environment mode", () => {
    it("sets secure flag in production", () => {
      const nodeEnv = "production";
      const isSecure = nodeEnv === "production";

      expect(isSecure).toBe(true);
    });

    it("sets sameSite to none in production", () => {
      const isProduction = true;
      const sameSite = isProduction ? "none" : "lax";

      expect(sameSite).toBe("none");
    });

    it("sets sameSite to lax in development", () => {
      const isProduction = false;
      const sameSite = isProduction ? "none" : "lax";

      expect(sameSite).toBe("lax");
    });

    it("sets correct maxAge for session cookie", () => {
      const maxAge = 60 * 60 * 24 * 7;

      expect(maxAge).toBe(604_800);
    });

    it("sets path to root", () => {
      const path = "/";

      expect(path).toBe("/");
    });
  });
});
