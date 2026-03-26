import { describe, expect, it } from "bun:test";
import type { Span } from "@opentelemetry/api";
import {
  addSpanEvent,
  recordSpanError,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "./tracer";

describe("tracer", () => {
  describe("withSpan", () => {
    it("executes function within span and returns result", () => {
      const result = withSpan("test-op", (span: Span) => {
        expect(span).toBeDefined();
        return 42;
      });

      expect(result).toBe(42);
    });

    it("records error and ends span when function throws", () => {
      const error = new Error("boom");

      expect(() =>
        withSpan("failing-op", () => {
          throw error;
        })
      ).toThrow("boom");
    });

    it("passes span options through to tracer", () => {
      const options = { kind: 1 };
      const result = withSpan("opts-op", () => "ok", options);
      expect(result).toBe("ok");
    });

    it("uses empty object when no options provided", () => {
      const result = withSpan("no-opts-op", () => "ok");
      expect(result).toBe("ok");
    });
  });

  describe("withSpanAsync", () => {
    it("awaits async function and returns result", async () => {
      const result = await withSpanAsync("async-op", () => {
        return Promise.resolve("async-result");
      });

      expect(result).toBe("async-result");
    });

    it("records error when async function rejects", async () => {
      const error = new Error("async boom");

      await expect(
        withSpanAsync("async-fail", () => {
          return Promise.reject(error);
        })
      ).rejects.toThrow("async boom");
    });
  });

  describe("recordSpanError", () => {
    it("records Error instances without throwing", () => {
      withSpan("test-span", (span) => {
        const error = new Error("direct error");
        expect(() => recordSpanError(span, error)).not.toThrow();
      });
    });

    it("wraps non-Error values in Error", () => {
      withSpan("test-span", (span) => {
        expect(() => recordSpanError(span, "string error")).not.toThrow();
      });
    });

    it("handles number errors", () => {
      withSpan("test-span", (span) => {
        expect(() => recordSpanError(span, 404)).not.toThrow();
      });
    });
  });

  describe("setSpanAttributes", () => {
    it("does not throw when called with attributes", () => {
      withSpan("test-span", () => {
        expect(() =>
          setSpanAttributes({ "http.method": "GET", "http.status": 200 })
        ).not.toThrow();
      });
    });

    it("does not throw when no active span", () => {
      expect(() => setSpanAttributes({ key: "val" })).not.toThrow();
    });
  });

  describe("addSpanEvent", () => {
    it("does not throw when called with event name and attributes", () => {
      withSpan("test-span", () => {
        expect(() =>
          addSpanEvent("cache.miss", { key: "user:123" })
        ).not.toThrow();
      });
    });

    it("does not throw when called without attributes", () => {
      withSpan("test-span", () => {
        expect(() => addSpanEvent("checkpoint")).not.toThrow();
      });
    });

    it("does not throw when no active span", () => {
      expect(() => addSpanEvent("checkpoint")).not.toThrow();
    });
  });
});
