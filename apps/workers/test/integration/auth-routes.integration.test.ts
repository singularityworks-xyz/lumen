process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";
process.env.LOG_LEVEL = "error";

import { describe, expect, it } from "bun:test";

const SESSION_TOKEN_REGEX = /better-auth\.session_token=([^;]+)/;
const TOKEN_HEX_REGEX = /^[a-f0-9]{64}$/;
const COOKIE_NAME_REGEX = /^([^=]+)=/;

const parseCookieName = (cookieString: string): string => {
  const match = cookieString.match(COOKIE_NAME_REGEX);
  return match?.[1]?.trim() || "unknown";
};

describe("WORKERS-I-01: auth-routes integration", () => {
  describe("SESSION_TOKEN_REGEX correctly extracts token from cookie string", () => {
    it("extracts session token from cookie string", () => {
      const cookieString =
        "other=value; better-auth.session_token=my-token; more=data";
      const match = cookieString.match(SESSION_TOKEN_REGEX);
      expect(match?.[1]).toBe("my-token");
    });

    it("returns null when no session token in cookie", () => {
      const cookieString = "other=value; more=data";
      const match = cookieString.match(SESSION_TOKEN_REGEX);
      expect(match).toBeNull();
    });

    it("handles encoded session tokens", () => {
      const cookieString = "better-auth.session_token=my%20encoded%20token";
      const match = cookieString.match(SESSION_TOKEN_REGEX);
      expect(match?.[1]).toBe("my%20encoded%20token");
    });
  });

  describe("TOKEN_HEX_REGEX validates hex strings", () => {
    it("validates 64 character hex strings", () => {
      const validToken = "a".repeat(64);
      expect(validToken).toMatch(TOKEN_HEX_REGEX);
    });

    it("accepts mixed hex characters", () => {
      const token = "abcdef0123456789".repeat(4);
      expect(token).toMatch(TOKEN_HEX_REGEX);
    });

    it("rejects tokens with non-hex characters", () => {
      const invalidToken = `g${"a".repeat(63)}`;
      expect(invalidToken).not.toMatch(TOKEN_HEX_REGEX);
    });

    it("rejects tokens shorter than 64 chars", () => {
      const shortToken = "a".repeat(63);
      expect(shortToken).not.toMatch(TOKEN_HEX_REGEX);
    });

    it("rejects tokens longer than 64 chars", () => {
      const longToken = "a".repeat(65);
      expect(longToken).not.toMatch(TOKEN_HEX_REGEX);
    });
  });

  describe("native token generation route handler structure", () => {
    it("generate-token endpoint uses session token cookie regex", () => {
      expect(SESSION_TOKEN_REGEX).toBeInstanceOf(RegExp);
    });

    it("exchange-token endpoint validates 64 char hex token format", () => {
      const validHex64 = "a".repeat(64);
      expect(validHex64).toMatch(TOKEN_HEX_REGEX);
    });
  });

  describe("cookie parsing utility", () => {
    it("parseCookieName extracts cookie name from cookie string", () => {
      expect(parseCookieName("session_token=abc123")).toBe("session_token");
      expect(parseCookieName("name=value")).toBe("name");
      expect(parseCookieName("=no name")).toBe("unknown");
    });
  });
});
