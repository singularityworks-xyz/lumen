import { describe, expect, it } from "bun:test";
import {
  extractSessionToken,
  formatAuthSession,
  isSessionValid,
} from "./session";

describe("isSessionValid", () => {
  it("returns true for future dates", () => {
    const session = {
      id: "session-1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as any;

    expect(isSessionValid(session)).toBe(true);
  });

  it("returns false for past dates", () => {
    const session = {
      id: "session-2",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    } as any;

    expect(isSessionValid(session)).toBe(false);
  });
});

describe("formatAuthSession", () => {
  it("returns correct shape", () => {
    const user = { id: "user-1", email: "test@example.com" } as any;
    const session = {
      id: "session-1",
      userId: "user-1",
      expiresAt: new Date(),
    } as any;

    const result = formatAuthSession(user, session);

    expect(result).toEqual({ user, session });
  });
});

describe("extractSessionToken", () => {
  it("extracts token from cookie header", () => {
    const headers = new Headers({
      cookie: "better-auth.session_token=abc123token; path=/",
    });

    expect(extractSessionToken(headers)).toBe("abc123token");
  });

  it("returns null for missing cookie", () => {
    const headers = new Headers();

    expect(extractSessionToken(headers)).toBeNull();
  });

  it("returns null for wrong cookie name", () => {
    const headers = new Headers({
      cookie: "wrong_cookie=somevalue",
    });

    expect(extractSessionToken(headers)).toBeNull();
  });
});
