import { describe, expect, it, mock } from "bun:test";
import type { Span } from "@opentelemetry/api";
import {
  addSpanEvent,
  recordSpanError,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "./tracer";

const createMockSpan = (): Span => {
  const recordException = mock();
  const setStatus = mock();
  const setAttribute = mock();
  const setAttributes = mock();
  const addEvent = mock();
  const end = mock();

  return {
    recordException,
    setStatus,
    setAttribute,
    setAttributes,
    addEvent,
    end,
    spanContext: () => ({
      traceId: "00000000000000000000000000000000",
      spanId: "0000000000000000",
      traceFlags: 0,
    }),
    isRecording: () => false,
  } as unknown as Span;
};

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
      const endMock = mock();
      const testSpan = createMockSpan();
      testSpan.end = endMock;

      withSpan("test-op", (_span: Span) => {
        return 42;
      });

      expect(endMock).toHaveBeenCalled();
    });

    it("records error and ends span when function throws", () => {
      const error = new Error("boom");

      expect(() =>
        withSpan("failing-op", () => {
          throw error;
        })
      ).toThrow("boom");
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
    it("calls span.recordException with the Error", () => {
      const mockSpan = createMockSpan();
      const error = new Error("test error");

      recordSpanError(mockSpan, error);

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    });

    it("calls span.setStatus with ERROR status", () => {
      const mockSpan = createMockSpan();
      const error = new Error("test error");

      recordSpanError(mockSpan, error);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: "test error",
      });
    });

    it("wraps non-Error values in Error", () => {
      const mockSpan = createMockSpan();

      recordSpanError(mockSpan, "string error");

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" })
      );
    });

    it("handles number errors", () => {
      const mockSpan = createMockSpan();

      recordSpanError(mockSpan, 404);

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "404" })
      );
    });
  });

  describe("setSpanAttributes", () => {
    it("calls span.setAttributes with provided attributes", () => {
      const mockSpan = createMockSpan();

      setSpanAttributes({ "http.method": "GET", "http.status": 200 });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        "http.method": "GET",
        "http.status": 200,
      });
    });

    it("does not throw when no active span", () => {
      expect(() => setSpanAttributes({ key: "val" })).not.toThrow();
    });
  });

  describe("addSpanEvent", () => {
    it("calls span.addEvent with event name and attributes", () => {
      const mockSpan = createMockSpan();

      addSpanEvent("cache.miss", { key: "user:123" });

      expect(mockSpan.addEvent).toHaveBeenCalledWith("cache.miss", {
        key: "user:123",
      });
    });

    it("calls span.addEvent with only event name when no attributes", () => {
      const mockSpan = createMockSpan();

      addSpanEvent("checkpoint");

      expect(mockSpan.addEvent).toHaveBeenCalledWith("checkpoint", undefined);
    });

    it("does not throw when no active span", () => {
      expect(() => addSpanEvent("checkpoint")).not.toThrow();
    });
  });
});
