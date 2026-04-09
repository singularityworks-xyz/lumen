import { describe, expect, it } from "bun:test";

const formatTokens = (tokens: number) => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
};

describe("message-bubble utilities", () => {
  describe("formatTokens", () => {
    it("returns string representation for values under 1000", () => {
      expect(formatTokens(0)).toBe("0");
      expect(formatTokens(1)).toBe("1");
      expect(formatTokens(100)).toBe("100");
      expect(formatTokens(999)).toBe("999");
    });

    it("formats 1000 as 1.0K", () => {
      expect(formatTokens(1000)).toBe("1.0K");
    });

    it("formats values between 1000 and 10000 with one decimal", () => {
      expect(formatTokens(1500)).toBe("1.5K");
      expect(formatTokens(2500)).toBe("2.5K");
      expect(formatTokens(9999)).toBe("10.0K");
    });

    it("formats large values with one decimal", () => {
      expect(formatTokens(10_000)).toBe("10.0K");
      expect(formatTokens(50_000)).toBe("50.0K");
      expect(formatTokens(100_000)).toBe("100.0K");
      expect(formatTokens(999_999)).toBe("1000.0K");
    });

    it("handles exact thousands", () => {
      expect(formatTokens(2000)).toBe("2.0K");
      expect(formatTokens(3000)).toBe("3.0K");
      expect(formatTokens(10_000)).toBe("10.0K");
    });
  });
});
