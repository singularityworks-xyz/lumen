import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Span, Tracer } from "@opentelemetry/api";

const mockSpan = {
  end: mock(() => undefined),
  recordException: mock(() => undefined),
  setStatus: mock(() => undefined),
  setAttributes: mock(() => undefined),
  setAttribute: mock(() => undefined),
  addEvent: mock(() => undefined),
  addLink: mock(() => undefined),
  addLinks: mock(() => undefined),
  updateName: mock(() => undefined),
  isRecording: mock(() => true),
  spanContext: () => ({
    traceId: "trace-abc",
    spanId: "span-def",
    traceFlags: 1,
  }),
} as unknown as Span;

const mockTracer = {
  startActiveSpan: mock(
    (_name: string, _options: unknown, fn: (span: Span) => unknown) => {
      return fn(mockSpan);
    }
  ),
  startSpan: mock(() => mockSpan),
} as unknown as Tracer;

let activeSpanOverride: Span | undefined | null = null;

mock.module("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => mockTracer,
    getActiveSpan: () =>
      activeSpanOverride === null ? mockSpan : activeSpanOverride,
  },
  SpanStatusCode: { ERROR: 2 },
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
} from "../../src/tracer";

describe("tracer", () => {
  beforeEach(() => {
    mockSpan.end.mockClear();
    mockSpan.recordException.mockClear();
    mockSpan.setStatus.mockClear();
    mockSpan.setAttributes.mockClear();
    mockSpan.addEvent.mockClear();
    mockTracer.startActiveSpan.mockClear();
    activeSpanOverride = null;
  });

  afterEach(() => {
    activeSpanOverride = null;
  });

  describe("getTracer", () => {
    it("returns a tracer with default name", () => {
      const tracer = getTracer();
      expect(tracer).toBe(mockTracer);
    });

    it("returns a tracer with custom name", () => {
      const tracer = getTracer("custom-service");
      expect(tracer).toBe(mockTracer);
    });
  });

  describe("getActiveSpan", () => {
    it("returns the active span from context", () => {
      const span = getActiveSpan();
      expect(span).toBe(mockSpan);
    });
  });

  describe("withSpan", () => {
    it("executes function within span and ends span on success", () => {
      const result = withSpan("test-op", (span) => {
        expect(span).toBe(mockSpan);
        return 42;
      });

      expect(result).toBe(42);
      expect(mockTracer.startActiveSpan).toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
      expect(mockSpan.recordException).not.toHaveBeenCalled();
    });

    it("records error and ends span when function throws", () => {
      const error = new Error("boom");

      expect(() =>
        withSpan("failing-op", () => {
          throw error;
        })
      ).toThrow("boom");

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "boom",
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it("passes span options through to tracer", () => {
      const options = { kind: 1 };

      withSpan("opts-op", () => "ok", options);

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        "opts-op",
        options,
        expect.any(Function)
      );
    });

    it("uses empty object when no options provided", () => {
      withSpan("no-opts-op", () => "ok");

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        "no-opts-op",
        {},
        expect.any(Function)
      );
    });
  });

  describe("withSpanAsync", () => {
    it("awaits async function and ends span on success", async () => {
      const result = await withSpanAsync("async-op", (span) => {
        expect(span).toBe(mockSpan);
        return Promise.resolve("async-result");
      });

      expect(result).toBe("async-result");
      expect(mockSpan.end).toHaveBeenCalled();
      expect(mockSpan.recordException).not.toHaveBeenCalled();
    });

    it("records error and ends span when async function rejects", async () => {
      const error = new Error("async boom");

      await expect(
        withSpanAsync("async-fail", () => Promise.reject(error))
      ).rejects.toThrow("async boom");

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "async boom",
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe("recordSpanError", () => {
    it("records Error instances directly", () => {
      const error = new Error("direct error");

      recordSpanError(mockSpan, error);

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "direct error",
      });
    });

    it("wraps non-Error values in Error", () => {
      recordSpanError(mockSpan, "string error");

      expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
      const recorded = mockSpan.recordException.mock.calls[0]![0] as Error;
      expect(recorded.message).toBe("string error");

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "string error",
      });
    });

    it("wraps number errors in Error", () => {
      recordSpanError(mockSpan, 404);

      const recorded = mockSpan.recordException.mock.calls[0]![0] as Error;
      expect(recorded.message).toBe("404");
    });
  });

  describe("recordError", () => {
    it("records error on active span with attributes", () => {
      const error = new Error("recorded");
      const attrs = { key: "value", count: 3 };

      recordError(error, attrs);

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "recorded",
      });
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attrs);
    });

    it("records error without attributes", () => {
      recordError(new Error("no attrs"));

      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
    });

    it("does nothing when no active span exists", () => {
      activeSpanOverride = undefined;

      recordError(new Error("no span"));

      expect(mockSpan.recordException).not.toHaveBeenCalled();
    });
  });

  describe("getTraceContext", () => {
    it("returns trace and span IDs when span is active", () => {
      const context = getTraceContext();

      expect(context).toEqual({
        traceId: "trace-abc",
        spanId: "span-def",
      });
    });

    it("returns null when no active span", () => {
      activeSpanOverride = undefined;

      const context = getTraceContext();
      expect(context).toBeNull();
    });
  });

  describe("setSpanAttributes", () => {
    it("sets attributes on the active span", () => {
      const attrs = { "http.method": "GET", "http.status": 200 };

      setSpanAttributes(attrs);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attrs);
    });

    it("does nothing when no active span", () => {
      activeSpanOverride = undefined;

      setSpanAttributes({ key: "val" });

      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
    });
  });

  describe("addSpanEvent", () => {
    it("adds event with attributes to the active span", () => {
      addSpanEvent("cache.miss", { key: "user:123" });

      expect(mockSpan.addEvent).toHaveBeenCalledWith("cache.miss", {
        key: "user:123",
      });
    });

    it("adds event without attributes", () => {
      addSpanEvent("checkpoint");

      expect(mockSpan.addEvent).toHaveBeenCalledWith("checkpoint", undefined);
    });

    it("does nothing when no active span", () => {
      activeSpanOverride = undefined;

      addSpanEvent("checkpoint");

      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });
  });
});
