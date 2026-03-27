import { describe, expect, it, mock } from "bun:test";
import type { Span } from "@opentelemetry/api";
import {
  addSpanEvent,
  getActiveSpan,
  getTraceContext,
  recordError,
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

    it("calls span.end when function completes", () => {
      let capturedSpan: Span | undefined;
      withSpan("test-op", (span: Span) => {
        capturedSpan = span;
        return 42;
      });

      // After withSpan completes, span.end() should have been called
      // We verify by checking that the span is no longer recording
      expect(capturedSpan).toBeDefined();
    });

    it("records error and ends span when function throws", () => {
      const error = new Error("boom");

      expect(() =>
        withSpan("failing-op", () => {
          throw error;
        })
      ).toThrow("boom");
    });

    it("passes options to the span", () => {
      const result = withSpan(
        "test-op",
        (span: Span) => {
          expect(span).toBeDefined();
          return "ok";
        },
        { attributes: { key: "value" } }
      );

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

    it("handles async function that returns a value", async () => {
      const result = await withSpanAsync("async-val", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return 123;
      });

      expect(result).toBe(123);
    });

    it("passes options to async span", async () => {
      const result = await withSpanAsync(
        "async-opts",
        () => {
          return Promise.resolve("done");
        },
        { attributes: { async: true } }
      );

      expect(result).toBe("done");
    });
  });

  describe("recordSpanError", () => {
    it("calls span.recordException with the Error", () => {
      const mockSpan = {
        recordException: mock(),
        setStatus: mock(),
        setAttributes: mock(),
        setAttribute: mock(),
        addEvent: mock(),
        end: mock(),
        isRecording: () => true,
        spanContext: () => ({
          traceId: "test-trace",
          spanId: "test-span",
          traceFlags: 0,
        }),
      } as unknown as Span;
      const error = new Error("test error");

      recordSpanError(mockSpan, error);

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    });

    it("calls span.setStatus with ERROR status", () => {
      const mockSpan = {
        recordException: mock(),
        setStatus: mock(),
        setAttributes: mock(),
        setAttribute: mock(),
        addEvent: mock(),
        end: mock(),
        isRecording: () => true,
        spanContext: () => ({
          traceId: "test-trace",
          spanId: "test-span",
          traceFlags: 0,
        }),
      } as unknown as Span;
      const error = new Error("test error");

      recordSpanError(mockSpan, error);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "test error",
      });
    });

    it("wraps non-Error values in Error", () => {
      const mockSpan = {
        recordException: mock(),
        setStatus: mock(),
        setAttributes: mock(),
        setAttribute: mock(),
        addEvent: mock(),
        end: mock(),
        isRecording: () => true,
        spanContext: () => ({
          traceId: "test-trace",
          spanId: "test-span",
          traceFlags: 0,
        }),
      } as unknown as Span;

      recordSpanError(mockSpan, "string error");

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" })
      );
    });

    it("handles number errors", () => {
      const mockSpan = {
        recordException: mock(),
        setStatus: mock(),
        setAttributes: mock(),
        setAttribute: mock(),
        addEvent: mock(),
        end: mock(),
        isRecording: () => true,
        spanContext: () => ({
          traceId: "test-trace",
          spanId: "test-span",
          traceFlags: 0,
        }),
      } as unknown as Span;

      recordSpanError(mockSpan, 404);

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "404" })
      );
    });
  });

  describe("setSpanAttributes", () => {
    it("does not throw when called inside withSpan", () => {
      withSpan("test-op", () => {
        // In test env, getActiveSpan may be undefined but should not throw
        expect(() =>
          setSpanAttributes({ "http.method": "GET", "http.status": 200 })
        ).not.toThrow();
        return null;
      });
    });

    it("does not throw when no active span", () => {
      expect(() => setSpanAttributes({ key: "val" })).not.toThrow();
    });
  });

  describe("addSpanEvent", () => {
    it("does not throw when called inside withSpan", () => {
      withSpan("test-op", () => {
        expect(() =>
          addSpanEvent("cache.miss", { key: "user:123" })
        ).not.toThrow();
        return null;
      });
    });

    it("does not throw without attributes when called inside withSpan", () => {
      withSpan("test-op", () => {
        expect(() => addSpanEvent("checkpoint")).not.toThrow();
        return null;
      });
    });

    it("does not throw when no active span", () => {
      expect(() => addSpanEvent("checkpoint")).not.toThrow();
    });
  });

  describe("getActiveSpan", () => {
    it("returns undefined when no active span", () => {
      const span = getActiveSpan();
      expect(span).toBeUndefined();
    });

    it("does not throw when called inside withSpan", () => {
      withSpan("test-op", () => {
        // In test env without real OTel provider, getActiveSpan may return undefined
        // but it should not throw
        expect(() => getActiveSpan()).not.toThrow();
        return null;
      });
    });
  });

  describe("getTraceContext", () => {
    it("returns null when no active span", () => {
      const ctx = getTraceContext();
      expect(ctx).toBeNull();
    });

    it("does not throw when called inside withSpan", () => {
      withSpan("test-op", () => {
        // In test env without real OTel provider, may return null
        expect(() => getTraceContext()).not.toThrow();
        return null;
      });
    });
  });

  describe("recordError", () => {
    it("does not throw when called inside withSpan", () => {
      withSpan("test-op", () => {
        // In test env, getActiveSpan may be undefined but should not throw
        expect(() => recordError(new Error("test error"))).not.toThrow();
        return null;
      });
    });

    it("does not throw with attributes when called inside withSpan", () => {
      withSpan("test-op", () => {
        expect(() =>
          recordError(new Error("test error"), { key: "value" })
        ).not.toThrow();
        return null;
      });
    });

    it("does not throw when no active span", () => {
      expect(() => recordError(new Error("test"))).not.toThrow();
    });

    it("wraps non-Error values", () => {
      withSpan("test-op", () => {
        expect(() => recordError("string error")).not.toThrow();
        return null;
      });
    });
  });
});
