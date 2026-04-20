// Set environment variables BEFORE any imports that use env.ts
process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

// Mock the providers module to avoid circular dependency issues
const mockIsRateLimitError = mock((error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
});

mock.module("../providers", () => ({
  isRateLimitError: mockIsRateLimitError,
  getModel: mock(() => ({})),
  getModelChain: mock(() => ["model-1"]),
  isAiEnabled: mock(() => true),
}));

describe("ai/lib/utils", () => {
  describe("generateMessageId", () => {
    it("returns string with msg_ prefix", async () => {
      const { generateMessageId } = await import("./utils");
      const id = generateMessageId();
      expect(id.startsWith("msg_")).toBe(true);
    });

    it("generates unique IDs", async () => {
      const { generateMessageId } = await import("./utils");
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("parseRateLimitError", () => {
    beforeEach(() => {
      mockIsRateLimitError.mockClear();
      mockIsRateLimitError.mockImplementation((error: unknown) => {
        if (!(error instanceof Error)) {
          return false;
        }
        const msg = error.message.toLowerCase();
        return (
          msg.includes("429") ||
          msg.includes("rate limit") ||
          msg.includes("too many requests")
        );
      });
    });

    it("returns isRateLimit false for non-Error input", async () => {
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError("string error");
      expect(result.isRateLimit).toBe(false);
      expect(result.message).toBe("An error occurred");
    });

    it("returns isRateLimit false for non-rate-limit Error", async () => {
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError(new Error("some other error"));
      expect(result.isRateLimit).toBe(false);
      expect(result.message).toBe("some other error");
    });

    it("parses rate limit error with retry seconds", async () => {
      mockIsRateLimitError.mockImplementation(() => true);
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError(
        new Error("Rate limited. Retry in 30.5 seconds")
      );
      expect(result.isRateLimit).toBe(true);
      expect(result.retryAfterSeconds).toBe(31);
      expect(result.message).toContain("31 seconds");
    });

    it("defaults to 60 seconds when no retry time found", async () => {
      mockIsRateLimitError.mockImplementation(() => true);
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError(new Error("429 rate limited"));
      expect(result.isRateLimit).toBe(true);
      expect(result.retryAfterSeconds).toBe(60);
    });

    it("handles null input", async () => {
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError(null);
      expect(result.isRateLimit).toBe(false);
    });
  });
});

afterAll(() => {
  mock.restore();
});
