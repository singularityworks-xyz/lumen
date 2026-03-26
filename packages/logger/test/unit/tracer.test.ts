import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  Attributes,
  Exception,
  Span,
  SpanStatus,
  Tracer,
} from "@opentelemetry/api";

const endMock = mock(() => undefined);
const recordExceptionMock = mock((_e: Exception) => undefined);
const setStatusMock = mock((_status: SpanStatus) => mockSpan);
const setAttributesMock = mock((_attributes: Attributes) => mockSpan);
const addEventMock = mock((_name: string) => mockSpan);
const setAttributeMock = mock(() => mockSpan);
const addLinkMock = mock(() => mockSpan);
const addLinksMock = mock(() => mockSpan);
const updateNameMock = mock(() => mockSpan);
const isRecordingMock = mock(() => true);

const mockSpan = {
  end: endMock,
  recordException: recordExceptionMock,
  setStatus: setStatusMock,
  setAttributes: setAttributesMock,
  setAttribute: setAttributeMock,
  addEvent: addEventMock,
  addLink: addLinkMock,
  addLinks: addLinksMock,
  updateName: updateNameMock,
  isRecording: isRecordingMock,
  spanContext: () => ({
    traceId: "trace-abc",
    spanId: "span-def",
    traceFlags: 1,
  }),
} as unknown as Span;

const startActiveSpanMock = mock(
  (_name: string, _options: unknown, fn: (span: Span) => unknown) => {
    return fn(mockSpan);
  }
);
const startSpanMock = mock(() => mockSpan);

const mockTracer = {
  startActiveSpan: startActiveSpanMock,
  startSpan: startSpanMock,
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
    endMock.mockClear();
    recordExceptionMock.mockClear();
    setStatusMock.mockClear();
    setAttributesMock.mockClear();
    addEventMock.mockClear();
    startActiveSpanMock.mockClear();
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
      expect(startActiveSpanMock).toHaveBeenCalled();
      expect(endMock).toHaveBeenCalled();
      expect(recordExceptionMock).not.toHaveBeenCalled();
    });

    it("records error and ends span when function throws", () => {
      const error = new Error("boom");

      expect(() =>
        withSpan("failing-op", () => {
          throw error;
        })
      ).toThrow("boom");

      expect(recordExceptionMock).toHaveBeenCalledWith(error);
      expect(setStatusMock).toHaveBeenCalledWith({
        code: 2,
        message: "boom",
      });
      expect(endMock).toHaveBeenCalled();
    });

    it("passes span options through to tracer", () => {
      const options = { kind: 1 };

      withSpan("opts-op", () => "ok", options);

      expect(startActiveSpanMock).toHaveBeenCalledWith(
        "opts-op",
        options,
        expect.any(Function)
      );
    });

    it("uses empty object when no options provided", () => {
      withSpan("no-opts-op", () => "ok");

      expect(startActiveSpanMock).toHaveBeenCalledWith(
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
      expect(endMock).toHaveBeenCalled();
      expect(recordExceptionMock).not.toHaveBeenCalled();
    });

    it("records error and ends span when async function rejects", async () => {
      const error = new Error("async boom");

      await expect(
        withSpanAsync("async-fail", () => Promise.reject(error))
      ).rejects.toThrow("async boom");

      expect(recordExceptionMock).toHaveBeenCalledWith(error);
      expect(setStatusMock).toHaveBeenCalledWith({
        code: 2,
        message: "async boom",
      });
      expect(endMock).toHaveBeenCalled();
    });
  });

  describe("recordSpanError", () => {
    it("records Error instances directly", () => {
      const error = new Error("direct error");

      recordSpanError(mockSpan, error);

      expect(recordExceptionMock).toHaveBeenCalledWith(error);
      expect(setStatusMock).toHaveBeenCalledWith({
        code: 2,
        message: "direct error",
      });
    });

    it("wraps non-Error values in Error", () => {
      recordSpanError(mockSpan, "string error");

      expect(recordExceptionMock).toHaveBeenCalledWith(expect.any(Error));
      const recorded = recordExceptionMock.mock.calls[0]![0] as Error;
      expect(recorded.message).toBe("string error");

      expect(setStatusMock).toHaveBeenCalledWith({
        code: 2,
        message: "string error",
      });
    });

    it("wraps number errors in Error", () => {
      recordSpanError(mockSpan, 404);

      const recorded = recordExceptionMock.mock.calls[0]![0] as Error;
      expect(recorded.message).toBe("404");
    });
  });

  describe("recordError", () => {
    it("records error on active span with attributes", () => {
      const error = new Error("recorded");
      const attrs = { key: "value", count: 3 };

      recordError(error, attrs);

      expect(recordExceptionMock).toHaveBeenCalledWith(error);
      expect(setStatusMock).toHaveBeenCalledWith({
        code: 2,
        message: "recorded",
      });
      expect(setAttributesMock).toHaveBeenCalledWith(attrs);
    });

    it("records error without attributes", () => {
      recordError(new Error("no attrs"));

      expect(recordExceptionMock).toHaveBeenCalled();
      expect(setAttributesMock).not.toHaveBeenCalled();
    });

    it("does nothing when no active span exists", () => {
      activeSpanOverride = undefined;

      recordError(new Error("no span"));

      expect(recordExceptionMock).not.toHaveBeenCalled();
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

      expect(setAttributesMock).toHaveBeenCalledWith(attrs);
    });

    it("does nothing when no active span", () => {
      activeSpanOverride = undefined;

      setSpanAttributes({ key: "val" });

      expect(setAttributesMock).not.toHaveBeenCalled();
    });
  });

  describe("addSpanEvent", () => {
    it("adds event with attributes to the active span", () => {
      addSpanEvent("cache.miss", { key: "user:123" });

      expect(addEventMock).toHaveBeenCalledWith("cache.miss", {
        key: "user:123",
      });
    });

    it("adds event without attributes", () => {
      addSpanEvent("checkpoint");

      expect(addEventMock).toHaveBeenCalledWith("checkpoint", undefined);
    });

    it("does nothing when no active span", () => {
      activeSpanOverride = undefined;

      addSpanEvent("checkpoint");

      expect(addEventMock).not.toHaveBeenCalled();
    });
  });
});
