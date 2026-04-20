import { describe, expect, it } from "bun:test";
import { formatRelativeTime } from "./date";

const NOW_ISO = "2025-06-15T12:00:00Z";

describe("formatRelativeTime", () => {
  it('returns "just now" for timestamps within 60 seconds', () => {
    expect(
      formatRelativeTime("2025-06-15T11:59:30Z", { nowIso: NOW_ISO })
    ).toBe("just now");
  });

  it('returns "just now" at exactly 59 seconds ago', () => {
    expect(
      formatRelativeTime("2025-06-15T11:59:01Z", { nowIso: NOW_ISO })
    ).toBe("just now");
  });

  it("returns minutes ago for timestamps under 1 hour", () => {
    expect(
      formatRelativeTime("2025-06-15T11:30:00Z", { nowIso: NOW_ISO })
    ).toBe("30m ago");
  });

  it("returns hours ago for timestamps under 24 hours", () => {
    expect(
      formatRelativeTime("2025-06-15T09:00:00Z", { nowIso: NOW_ISO })
    ).toBe("3h ago");
  });

  it('returns "yesterday" for exactly 1 day ago in long form', () => {
    expect(
      formatRelativeTime("2025-06-14T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe("yesterday");
  });

  it("returns days ago for timestamps under 7 days", () => {
    expect(
      formatRelativeTime("2025-06-13T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe("2d ago");
  });

  it("returns locale date string for timestamps 7+ days ago", () => {
    const expected = new Date("2025-06-01T12:00:00Z").toLocaleDateString();
    expect(
      formatRelativeTime("2025-06-01T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe(expected);
  });

  it('returns "in Xm" for future timestamps under 1 hour', () => {
    expect(
      formatRelativeTime("2025-06-15T12:30:00Z", { nowIso: NOW_ISO })
    ).toBe("in 30m");
  });

  it("returns future hour format for timestamps under 24 hours", () => {
    expect(
      formatRelativeTime("2025-06-15T15:00:00Z", { nowIso: NOW_ISO })
    ).toBe("in 3h");
  });

  it('returns "tomorrow" for exactly 1 day in the future in long form', () => {
    expect(
      formatRelativeTime("2025-06-16T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe("tomorrow");
  });

  it("returns future day format for timestamps under 7 days", () => {
    expect(
      formatRelativeTime("2025-06-17T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe("in 2d");
  });

  it("returns locale date string for future timestamps 7+ days", () => {
    const expected = new Date("2025-07-01T12:00:00Z").toLocaleDateString();
    expect(
      formatRelativeTime("2025-07-01T12:00:00Z", { nowIso: NOW_ISO })
    ).toBe(expected);
  });

  it('returns "Invalid date" for malformed date strings', () => {
    expect(formatRelativeTime("not-a-date", { nowIso: NOW_ISO })).toBe(
      "Invalid date"
    );
    expect(formatRelativeTime("", { nowIso: NOW_ISO })).toBe("Invalid date");
  });

  it("short mode omits 'ago' suffix for past times", () => {
    expect(
      formatRelativeTime("2025-06-15T11:30:00Z", {
        short: true,
        nowIso: NOW_ISO,
      })
    ).toBe("30m");
  });

  it("short mode uses compact hour format", () => {
    expect(
      formatRelativeTime("2025-06-15T09:00:00Z", {
        short: true,
        nowIso: NOW_ISO,
      })
    ).toBe("3h");
  });

  it("short mode returns day count without 'ago'", () => {
    expect(
      formatRelativeTime("2025-06-13T12:00:00Z", {
        short: true,
        nowIso: NOW_ISO,
      })
    ).toBe("2d");
  });

  it("short mode for 1 day past skips 'yesterday' and returns '1d'", () => {
    expect(
      formatRelativeTime("2025-06-14T12:00:00Z", {
        short: true,
        nowIso: NOW_ISO,
      })
    ).toBe("1d");
  });

  it("short mode for 1 day future skips 'tomorrow' and returns 'in 1d'", () => {
    expect(
      formatRelativeTime("2025-06-16T12:00:00Z", {
        short: true,
        nowIso: NOW_ISO,
      })
    ).toBe("in 1d");
  });

  it("handles exact boundary at 60 seconds as '1m ago'", () => {
    expect(
      formatRelativeTime("2025-06-15T11:59:00Z", { nowIso: NOW_ISO })
    ).toBe("1m ago");
  });

  it("handles 61 seconds as '1m ago' (floors to 1 minute)", () => {
    expect(
      formatRelativeTime("2025-06-15T11:58:59Z", { nowIso: NOW_ISO })
    ).toBe("1m ago");
  });

  it("future 'just now' boundary works", () => {
    expect(
      formatRelativeTime("2025-06-15T12:00:50Z", { nowIso: NOW_ISO })
    ).toBe("just now");
  });

  it("uses current time when nowIso not provided", () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toBe("just now");
  });

  it("handles pre-1970 date math", () => {
    expect(
      formatRelativeTime("1969-12-31T00:00:00Z", {
        nowIso: "1970-01-01T00:00:00Z",
      })
    ).toBe("yesterday");
  });

  it("handles leap-day carry in month accumulation", () => {
    expect(
      formatRelativeTime("2024-02-29T00:00:00Z", {
        nowIso: "2024-03-01T00:00:00Z",
      })
    ).toBe("yesterday");
  });

  it("falls back to zero diff when nowIso parses but does not match internal ISO pattern", () => {
    expect(
      formatRelativeTime("2025-06-15T11:00:00Z", {
        nowIso: "2025-06-15",
      })
    ).toBe("just now");
  });
});
