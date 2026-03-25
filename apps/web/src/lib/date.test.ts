import { afterEach, describe, expect, it } from "bun:test";

const RealDate = Date;
let fixedNow: number | null = null;

function freezeTime(iso: string) {
  fixedNow = new RealDate(iso).getTime();
  const OriginalDate = RealDate;

  const proxiedDate = new Proxy(OriginalDate, {
    construct(target, args) {
      if (args.length === 0 && fixedNow !== null) {
        return new OriginalDate(fixedNow);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (target as any)(...args);
    },
    apply(target, _thisArg, args) {
      if (args.length === 0 && fixedNow !== null) {
        return new OriginalDate(fixedNow);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (target as any)(...args);
    },
  }) as typeof Date;

  globalThis.Date = proxiedDate;
}

afterEach(() => {
  fixedNow = null;
  globalThis.Date = RealDate;
});

describe("formatRelativeTime", () => {
  it('returns "just now" for timestamps within 60 seconds', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    const date = "2025-06-15T11:59:30Z";
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it('returns "just now" at exactly 59 seconds ago', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    const date = "2025-06-15T11:59:01Z";
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns minutes ago for timestamps under 1 hour", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T11:30:00Z")).toBe("30m ago");
  });

  it("returns hours ago for timestamps under 24 hours", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T09:00:00Z")).toBe("3h ago");
  });

  it('returns "yesterday" for exactly 1 day ago in long form', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-14T12:00:00Z")).toBe("yesterday");
  });

  it("returns days ago for timestamps under 7 days", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-13T12:00:00Z")).toBe("2d ago");
  });

  it("returns locale date string for timestamps 7+ days ago", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    const expected = new RealDate("2025-06-01T12:00:00Z").toLocaleDateString();
    expect(formatRelativeTime("2025-06-01T12:00:00Z")).toBe(expected);
  });

  it('returns "in Xm" for future timestamps under 1 hour', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T12:30:00Z")).toBe("in 30m");
  });

  it("returns future hour format for timestamps under 24 hours", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T15:00:00Z")).toBe("in 3h");
  });

  it('returns "tomorrow" for exactly 1 day in the future in long form', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-16T12:00:00Z")).toBe("tomorrow");
  });

  it("returns future day format for timestamps under 7 days", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-17T12:00:00Z")).toBe("in 2d");
  });

  it("returns locale date string for future timestamps 7+ days", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    const expected = new RealDate("2025-07-01T12:00:00Z").toLocaleDateString();
    expect(formatRelativeTime("2025-07-01T12:00:00Z")).toBe(expected);
  });

  it('returns "Invalid date" for malformed date strings', () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("not-a-date")).toBe("Invalid date");
    expect(formatRelativeTime("")).toBe("Invalid date");
  });

  it("short mode omits 'ago' suffix for past times", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T11:30:00Z", { short: true })).toBe(
      "30m"
    );
  });

  it("short mode uses compact hour format", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T09:00:00Z", { short: true })).toBe(
      "3h"
    );
  });

  it("short mode returns day count without 'ago'", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-13T12:00:00Z", { short: true })).toBe(
      "2d"
    );
  });

  it("short mode for 1 day past skips 'yesterday' and returns '1d'", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-14T12:00:00Z", { short: true })).toBe(
      "1d"
    );
  });

  it("short mode for 1 day future skips 'tomorrow' and returns 'in 1d'", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-16T12:00:00Z", { short: true })).toBe(
      "in 1d"
    );
  });

  it("handles exact boundary at 60 seconds as '1m ago' since condition is < 60", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T11:59:00Z")).toBe("1m ago");
  });

  it("handles 61 seconds as '1m ago' (floors to 1 minute)", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T11:58:59Z")).toBe("1m ago");
  });

  it("future 'just now' boundary works", () => {
    freezeTime("2025-06-15T12:00:00Z");
    const { formatRelativeTime } = require("./date");
    expect(formatRelativeTime("2025-06-15T12:00:50Z")).toBe("just now");
  });
});
