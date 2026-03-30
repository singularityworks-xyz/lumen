import { describe, expect, it } from "bun:test";
import { createExpiredSession, createTestSession } from "./session-fixture";

describe("createTestSession", () => {
  it("returns a valid test session object", () => {
    const session = createTestSession();

    expect(session).toHaveProperty("session");
    expect(session).toHaveProperty("user");
  });

  it("uses default userId when none provided", () => {
    const session = createTestSession();

    expect(session.session.userId).toBe("test-user-1");
    expect(session.user.id).toBe("test-user-1");
  });

  it("uses provided userId", () => {
    const session = createTestSession("custom-user-42");

    expect(session.session.userId).toBe("custom-user-42");
    expect(session.user.id).toBe("custom-user-42");
  });

  it("has a session token", () => {
    const session = createTestSession();

    expect(session.session.token).toBeDefined();
    expect(typeof session.session.token).toBe("string");
    expect(session.session.token.length).toBeGreaterThan(0);
  });

  it("has a future expiration date", () => {
    const session = createTestSession();
    const expiresAt = new Date(session.session.expiresAt).getTime();
    const now = Date.now();

    expect(expiresAt).toBeGreaterThan(now);
  });

  it("has a session id", () => {
    const session = createTestSession();
    expect(session.session.id).toBeDefined();
    expect(typeof session.session.id).toBe("string");
  });

  it("has user name and email", () => {
    const session = createTestSession();

    expect(session.user.name).toBeDefined();
    expect(session.user.email).toBeDefined();
    expect(session.user.email).toContain("@");
  });
});

describe("createExpiredSession", () => {
  it("returns a session with expired expiration", () => {
    const session = createExpiredSession();
    const expiresAt = new Date(session.session.expiresAt).getTime();

    // The expired session uses a fixed past timestamp (2023-11-15)
    expect(expiresAt).toBeDefined();
    expect(session.session.expiresAt).toBe("2023-11-15T00:00:00.000Z");
  });

  it("uses default userId when none provided", () => {
    const session = createExpiredSession();

    expect(session.session.userId).toBe("test-user-1");
    expect(session.user.id).toBe("test-user-1");
  });

  it("uses provided userId", () => {
    const session = createExpiredSession("expired-user-99");

    expect(session.session.userId).toBe("expired-user-99");
    expect(session.user.id).toBe("expired-user-99");
  });

  it("has a different session id from createTestSession", () => {
    const active = createTestSession();
    const expired = createExpiredSession();

    expect(expired.session.id).not.toBe(active.session.id);
  });

  it("has a different token from createTestSession", () => {
    const active = createTestSession();
    const expired = createExpiredSession();

    expect(expired.session.token).not.toBe(active.session.token);
  });

  it("has user with 'Expired' in name", () => {
    const session = createExpiredSession();

    expect(session.user.name).toContain("Expired");
  });
});
