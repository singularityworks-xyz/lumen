import { afterAll, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
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
      const { parseRateLimitError } = await import("./utils");
      const result = parseRateLimitError(
        new Error("Rate limited. Retry in 30.5 seconds")
      );
      expect(result.isRateLimit).toBe(true);
      expect(result.retryAfterSeconds).toBe(31);
      expect(result.message).toContain("31 seconds");
    });

    it("defaults to 60 seconds when no retry time found", async () => {
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
