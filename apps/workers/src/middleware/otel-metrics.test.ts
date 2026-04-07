import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockIncrementRequestCount = mock();
const mockRecordRequestDuration = mock();
const mockIncrementErrorCount = mock();

mock.module("@lumen/logger/server", () => ({
  incrementRequestCount: mockIncrementRequestCount,
  recordRequestDuration: mockRecordRequestDuration,
  incrementErrorCount: mockIncrementErrorCount,
}));

import { normalizePath, otelMetrics } from "./otel-metrics";

interface MockApp {
  derive: (fn: () => unknown) => MockApp;
  handle: (request: unknown, next: () => unknown) => unknown;
  on: (event: string, fn: (ctx: unknown) => void) => MockApp;
  onAfterResponse: (fn: (ctx: unknown) => void) => MockApp;
  state: Record<string, unknown>;
  use: (plugin: (app: MockApp) => void) => MockApp;
}

function createMockApp(): MockApp {
  const app: MockApp = {
    derive: mock((_fn: () => unknown) => app),
    on: mock((_event: string, _fn: (ctx: unknown) => void) => app),
    onAfterResponse: mock((_fn: (ctx: unknown) => void) => app),
    use: mock((_plugin: (app: MockApp) => void) => app),
    state: {},
    handle: mock((_request: unknown, next: () => unknown) => next()),
  };
  return app;
}

describe("otel-metrics", () => {
  beforeEach(() => {
    mockIncrementRequestCount.mockClear();
    mockRecordRequestDuration.mockClear();
    mockIncrementErrorCount.mockClear();
  });

  describe("middleware", () => {
    it("records request count on every response", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/test",
          method: "GET",
        },
        set: { status: 200 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementRequestCount).toHaveBeenCalledWith({
        method: "GET",
        route: "/test",
        status: "200",
        service_name: "lumen-workers",
      });
    });

    it("records request duration calculated from _startTime", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/test",
          method: "POST",
        },
        set: { status: 201 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockRecordRequestDuration).toHaveBeenCalled();
      const durationArg = (
        mockRecordRequestDuration.mock.calls[0] as [unknown]
      )[0];
      expect(typeof durationArg).toBe("number");
      expect(durationArg).toBeGreaterThanOrEqual(0);
    });

    it("records error count for 4xx status", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/not-found",
          method: "GET",
        },
        set: { status: 404 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementErrorCount).toHaveBeenCalledWith({
        method: "GET",
        route: "/not-found",
        status: "404",
        service_name: "lumen-workers",
      });
    });

    it("records error count for 5xx status", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/error",
          method: "POST",
        },
        set: { status: 500 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementErrorCount).toHaveBeenCalledWith({
        method: "POST",
        route: "/error",
        status: "500",
        service_name: "lumen-workers",
      });
    });

    it("does not record error for 2xx status", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/success",
          method: "GET",
        },
        set: { status: 200 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementErrorCount).not.toHaveBeenCalled();
    });

    it("handles undefined status defaults to 200", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/test",
          method: "GET",
        },
        set: { status: undefined },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementRequestCount).toHaveBeenCalledWith({
        method: "GET",
        route: "/test",
        status: "200",
        service_name: "lumen-workers",
      });
    });

    it("handles null status defaults to 200", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/test",
          method: "GET",
        },
        set: { status: null as unknown as undefined },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementRequestCount).toHaveBeenCalledWith({
        method: "GET",
        route: "/test",
        status: "200",
        service_name: "lumen-workers",
      });
    });

    it("preserves status 0 as 0", () => {
      let capturedDerive: (() => unknown) | undefined;
      let capturedOnAfter: ((ctx: unknown) => void) | undefined;

      const mockApp = createMockApp();
      (mockApp.derive as ReturnType<typeof mock>).mockImplementation(
        (fn: () => unknown) => {
          capturedDerive = fn;
          return mockApp;
        }
      );
      (mockApp.onAfterResponse as ReturnType<typeof mock>).mockImplementation(
        (fn: (ctx: unknown) => void) => {
          capturedOnAfter = fn;
          return mockApp;
        }
      );

      otelMetrics(mockApp as unknown as Parameters<typeof otelMetrics>[0]);

      const derived = capturedDerive?.() as Record<string, unknown>;

      const mockCtx = {
        request: {
          url: "http://localhost/test",
          method: "GET",
        },
        set: { status: 0 },
        ...derived,
      };

      capturedOnAfter?.(mockCtx);

      expect(mockIncrementRequestCount).toHaveBeenCalledWith({
        method: "GET",
        route: "/test",
        status: "0",
        service_name: "lumen-workers",
      });
    });
  });

  describe("normalizePath", () => {
    it("normalizes UUID paths to :id", () => {
      const result = normalizePath(
        "/users/550e8400-e29b-41d4-a716-446655440000/profile"
      );
      expect(result).toBe("/users/:id/profile");
    });

    it("normalizes numeric IDs (4+ digits) to :id", () => {
      const result = normalizePath("/api/v1/users/12345/posts");
      expect(result).toBe("/api/v1/users/:id/posts");
    });

    it("normalizes long alphanumeric tokens (16+ chars) to :token", () => {
      const result = normalizePath("/api/tokens/abcdef1234567890abcdef");
      expect(result).toBe("/api/tokens/:token");
    });

    it("normalizes short alphanumeric IDs (8-15 chars) to :id", () => {
      const result = normalizePath("/ws/abc123XYZ/docs");
      expect(result).toBe("/ws/:id/docs");
    });
  });
});
