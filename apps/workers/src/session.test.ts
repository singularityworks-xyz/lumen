import { describe, expect, test } from "bun:test";
import type { SessionModel, UserModel } from "@lumen/db";
import {
  extractSessionToken,
  formatAuthSession,
  isSessionValid,
  logSessionActivity,
} from "./session";

function createMockSession(
  overrides: Partial<SessionModel> = {}
): SessionModel {
  return {
    id: "test-session-id",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: "test-token",
    userId: "test-user-id",
    userAgent: null,
    ipAddress: null,
    lastAccessedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SessionModel;
}

function createMockUser(overrides: Partial<UserModel> = {}): UserModel {
  return {
    id: "test-user-id",
    email: "test@example.com",
    emailVerified: false,
    name: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserModel;
}

describe("session", () => {
  describe("isSessionValid", () => {
    test("WORKERS-U-01: session validity flips correctly at expiry boundary", () => {
      const now = Date.now();
      const hourInMs = 60 * 60 * 1000;

      const sessionValid = createMockSession({
        expiresAt: new Date(now + hourInMs),
      });
      expect(isSessionValid(sessionValid)).toBe(true);

      const sessionExpired = createMockSession({
        expiresAt: new Date(now - 1),
      });
      expect(isSessionValid(sessionExpired)).toBe(false);

      const sessionJustExpired = createMockSession({
        expiresAt: new Date(now - 1000),
      });
      expect(isSessionValid(sessionJustExpired)).toBe(false);

      const sessionJustValid = createMockSession({
        expiresAt: new Date(now + 100),
      });
      expect(isSessionValid(sessionJustValid)).toBe(true);
    });
  });

  describe("extractSessionToken", () => {
    test("WORKERS-U-01: cookie parsing extracts only the configured session token", () => {
      const headersWithToken = new Headers({
        cookie: "better-auth.session_token=abc123; other_cookie=xyz",
      });
      expect(extractSessionToken(headersWithToken)).toBe("abc123");

      const headersWithMultiple = new Headers({
        cookie: "foo=bar; better-auth.session_token=token123; baz=qux",
      });
      expect(extractSessionToken(headersWithMultiple)).toBe("token123");

      const headersWithoutToken = new Headers({
        cookie: "foo=bar; baz=qux",
      });
      expect(extractSessionToken(headersWithoutToken)).toBe(null);

      const emptyHeaders = new Headers();
      expect(extractSessionToken(emptyHeaders)).toBe(null);
    });

    test("WORKERS-U-01: handles edge cases in cookie parsing", () => {
      const headersWithEncodedToken = new Headers({
        cookie: "better-auth.session_token=abc%3D123",
      });
      expect(extractSessionToken(headersWithEncodedToken)).toBe("abc%3D123");

      const headersWithSpecialChars = new Headers({
        cookie: "better-auth.session_token=abc123xyz; other=value",
      });
      expect(extractSessionToken(headersWithSpecialChars)).toBe("abc123xyz");
    });
  });

  describe("formatAuthSession", () => {
    test("WORKERS-U-01: session formatting preserves user/session identity", () => {
      const user = createMockUser();
      const session = createMockSession();

      const authSession = formatAuthSession(user, session);

      expect(authSession.user).toBe(user);
      expect(authSession.session).toBe(session);
      expect(authSession.user.id).toBe("test-user-id");
      expect(authSession.session.id).toBe("test-session-id");
    });
  });

  describe("logSessionActivity", () => {
    test("logSessionActivity does not throw", () => {
      expect(() =>
        logSessionActivity("login", "session-123", "user-456", {
          ip: "192.168.1.1",
        })
      ).not.toThrow();
    });

    test("logSessionActivity handles missing metadata", () => {
      expect(() =>
        logSessionActivity("logout", "session-123", "user-456")
      ).not.toThrow();
    });
  });
});
