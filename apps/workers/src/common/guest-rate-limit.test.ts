import { beforeEach, describe, expect, it } from "bun:test";
import { serverGuestRateLimiter } from "./guest-rate-limit";

describe("serverGuestRateLimiter", () => {
  beforeEach(() => {
    serverGuestRateLimiter.reset();
  });

  describe("Chat Rate Limiting", () => {
    it("allows messages within rate limits", () => {
      const check = serverGuestRateLimiter.checkChatRateLimit("guest-1");
      expect(check.allowed).toBe(true);
    });

    it("enforces 1 message per second limit", () => {
      serverGuestRateLimiter.recordChatMessage("guest-1");

      const check = serverGuestRateLimiter.checkChatRateLimit("guest-1");
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe("second");
      expect(check.message).toContain("1 message per second");
    });

    it("isolates limits by guest identifier", () => {
      serverGuestRateLimiter.recordChatMessage("guest-1");

      const checkGuest2 = serverGuestRateLimiter.checkChatRateLimit("guest-2");
      expect(checkGuest2.allowed).toBe(true);
    });
  });

  describe("Larity Rate Limiting", () => {
    it("allows requests under the 20/day limit", () => {
      const check = serverGuestRateLimiter.checkLarityRateLimit("guest-1");
      expect(check.allowed).toBe(true);
    });

    it("enforces 20 messages per day limit", () => {
      for (let i = 0; i < 20; i++) {
        serverGuestRateLimiter.recordLarityMessage("guest-1");
      }

      const check = serverGuestRateLimiter.checkLarityRateLimit("guest-1");
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe("day");
      expect(check.message).toContain("20 messages/day");
    });
  });
});
