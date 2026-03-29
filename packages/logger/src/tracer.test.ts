import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track active span for mocking
let currentActiveSpan: any = null;

// Mock span factory
function createMockSpan() {
  return {
    _ended: false,
    _exception: null as unknown,
    _status: null as unknown,
    _attributes: {} as Record<string, unknown>,
    _events: [] as Array<{ name: string; attrs?: unknown }>,
    end() {
      this._ended = true;
    },
    recordException(err: unknown) {
      this._exception = err;
    },
    setStatus(status: unknown) {
      this._status = status;
    },
    setAttribute(key: string, value: unknown) {
      this._attributes[key] = value;
    },
    setAttributes(attrs: Record<string, unknown>) {
      Object.assign(this._attributes, attrs);
    },
    addEvent(name: string, attrs?: unknown) {
      this._events.push({ name, attrs });
    },
    isRecording: () => true,
    spanContext: () => ({
      traceId: "test-trace-id-1234567890abcdef",
      spanId: "test-span-id-12345678",
      traceFlags: 1,
    }),
  };
}

// Mock the trace API
const mockGetActiveSpan = mock(() => currentActiveSpan);
const mockTracer = {
  startActiveSpan(_name: string, optsOrFn: unknown, fnOrUndefined?: unknown) {
    const fn = typeof optsOrFn === "function" ? optsOrFn : fnOrUndefined;
    const span = createMockSpan();
    const prev = currentActiveSpan;
    currentActiveSpan = span;
    try {
      const result = (fn as (s: any) => unknown)(span);
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: String(error) });
      throw error;
    } finally {
      span.end();
      currentActiveSpan = prev;
    }
  },
};

mock.module("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => mockTracer,
    getActiveSpan: mockGetActiveSpan,
  },
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
}));

import {
  addSpanEvent,
  getActiveSpan,
  getTraceContext,
  getTracer,
  recordError,
  recordSpanError,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "./tracer";

beforeEach(() => {
  currentActiveSpan = null;
  mockGetActiveSpan.mockClear();
});

describe("tracer", () => {
  describe("getTracer", () => {
    it("returns a tracer with default name", () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
    });

    it("returns a tracer with custom name", () => {
      const tracer = getTracer("custom-tracer");
      expect(tracer).toBeDefined();
    });
  });

  describe("withSpan", () => {
    it("executes function within span and returns result", () => {
      const result = withSpan("test-op", (span) => {
        expect(span).toBeDefined();
        return 42;
      });
      expect(result).toBe(42);
    });

    it("calls span.end when function completes", () => {
      const result = withSpan("test-op", () => "done");
      expect(result).toBe("done");
    });

    it("records error and re-throws when function throws", () => {
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
        (span) => {
          expect(span).toBeDefined();
          return "ok";
        },
        { attributes: { key: "value" } }
      );
      expect(result).toBe("ok");
    });

    it("handles non-Error throw values", () => {
      expect(() =>
        withSpan("string-throw", () => {
          // biome-ignore lint/style/useThrowOnlyError: testing non-Error throw handling
          throw "string error";
        })
      ).toThrow("string error");
    });
  });

  describe("withSpanAsync", () => {
    it("awaits async function and returns result", async () => {
      const result = await withSpanAsync("async-op", () =>
        Promise.resolve("async-result")
      );
      expect(result).toBe("async-result");
    });

    it("records error when async function rejects", async () => {
      const error = new Error("async boom");
      await expect(
        withSpanAsync("async-fail", () => Promise.reject(error))
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
        () => Promise.resolve("done"),
        { attributes: { async: true } }
      );
      expect(result).toBe("done");
    });

    it("handles non-Error rejection values", async () => {
      await expect(
        withSpanAsync("string-reject", () => Promise.reject("string rejection"))
      ).rejects.toBe("string rejection");
    });
  });

  describe("recordSpanError", () => {
    it("calls span.recordException with the Error", () => {
      const mockSpan = createMockSpan();
      const error = new Error("test error");
      recordSpanError(mockSpan as any, error);
      expect(mockSpan._exception).toBe(error);
    });

    it("calls span.setStatus with ERROR status", () => {
      const mockSpan = createMockSpan();
      const error = new Error("test error");
      recordSpanError(mockSpan as any, error);
      expect(mockSpan._status).toEqual({ code: 2, message: "test error" });
    });

    it("wraps non-Error values in Error", () => {
      const mockSpan = createMockSpan();
      recordSpanError(mockSpan as any, "string error");
      expect((mockSpan._exception as Error).message).toBe("string error");
    });

    it("handles number errors", () => {
      const mockSpan = createMockSpan();
      recordSpanError(mockSpan as any, 404);
      expect((mockSpan._exception as Error).message).toBe("404");
    });

    it("handles null errors", () => {
      const mockSpan = createMockSpan();
      recordSpanError(mockSpan as any, null);
      expect((mockSpan._exception as Error).message).toBe("null");
    });

    it("handles undefined errors", () => {
      const mockSpan = createMockSpan();
      recordSpanError(mockSpan as any, undefined);
      expect((mockSpan._exception as Error).message).toBe("undefined");
    });
  });

  describe("setSpanAttributes", () => {
    it("calls setAttributes on active span when one exists", () => {
      withSpan("test-op", () => {
        setSpanAttributes({ "http.method": "POST", "http.status": 201 });
        return null;
      });
    });

    it("does not throw when no active span", () => {
      currentActiveSpan = null;
      expect(() => setSpanAttributes({ key: "val" })).not.toThrow();
    });

    it("handles mixed attribute types", () => {
      withSpan("test-op", () => {
        setSpanAttributes({
          stringKey: "value",
          numberKey: 42,
          booleanKey: true,
        });
        return null;
      });
    });
  });

  describe("addSpanEvent", () => {
    it("calls addEvent on active span with attributes", () => {
      withSpan("test-op", () => {
        addSpanEvent("cache.miss", { key: "user:123" });
        return null;
      });
    });

    it("calls addEvent on active span without attributes", () => {
      withSpan("test-op", () => {
        addSpanEvent("checkpoint");
        return null;
      });
    });

    it("does not throw when no active span", () => {
      currentActiveSpan = null;
      expect(() => addSpanEvent("checkpoint")).not.toThrow();
    });
  });

  describe("getActiveSpan", () => {
    it("returns active span when inside withSpan", () => {
      withSpan("test-op", () => {
        const span = getActiveSpan();
        expect(span).toBeDefined();
        return null;
      });
    });

    it("returns null/undefined when no active span", () => {
      currentActiveSpan = null;
      const span = getActiveSpan();
      expect(span == null).toBe(true);
    });
  });

  describe("getTraceContext", () => {
    it("returns trace and span IDs when inside withSpan", () => {
      withSpan("test-op", () => {
        const ctx = getTraceContext();
        expect(ctx).not.toBeNull();
        expect(ctx?.traceId).toBe("test-trace-id-1234567890abcdef");
        expect(ctx?.spanId).toBe("test-span-id-12345678");
        return null;
      });
    });

    it("returns null when no active span", () => {
      currentActiveSpan = null;
      const ctx = getTraceContext();
      expect(ctx).toBeNull();
    });
  });

  describe("recordError", () => {
    it("records error with attributes when inside withSpan", () => {
      withSpan("test-op", () => {
        recordError(new Error("test error"), { key: "value" });
        return null;
      });
    });

    it("records error without attributes when inside withSpan", () => {
      withSpan("test-op", () => {
        recordError(new Error("test error"));
        return null;
      });
    });

    it("does not throw when no active span", () => {
      currentActiveSpan = null;
      expect(() => recordError(new Error("test"))).not.toThrow();
    });

    it("wraps non-Error values when inside withSpan", () => {
      withSpan("test-op", () => {
        recordError("string error");
        return null;
      });
    });

    it("wraps number values when inside withSpan", () => {
      withSpan("test-op", () => {
        recordError(404);
        return null;
      });
    });

    it("sets attributes on span when provided", () => {
      withSpan("test-op", () => {
        recordError(new Error("test"), { requestId: "req-123", userId: "u-1" });
        return null;
      });
    });
  });
});
