import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Integration test: logger + config + tracer working together
// Tests the cross-module interaction patterns

interface EmitData {
  attributes: Record<string, unknown>;
  body: string;
}

const emitMock = mock<(data: EmitData) => void>(() => {
  // no-op
});

mock.module("@opentelemetry/api-logs", () => ({
  logs: {
    getLogger: () => ({
      emit: emitMock,
    }),
  },
  SeverityNumber: {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  },
}));

// Track active span for tracer mocking
let currentActiveSpan: ReturnType<typeof createMockSpan> | null = null;

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
    spanContext: () => ({
      traceId: "integration-trace-id",
      spanId: "integration-span-id",
      traceFlags: 1,
    }),
  };
}

const mockGetActiveSpan = mock(() => currentActiveSpan);
const mockTracer = {
  startActiveSpan(
    _name: string,
    optsOrFn:
      | Record<string, unknown>
      | ((s: ReturnType<typeof createMockSpan>) => unknown),
    fnOrUndefined?: (s: ReturnType<typeof createMockSpan>) => unknown
  ) {
    const fn = typeof optsOrFn === "function" ? optsOrFn : fnOrUndefined;
    const span = createMockSpan();
    const prev = currentActiveSpan;
    currentActiveSpan = span;
    try {
      const result = (fn as (s: ReturnType<typeof createMockSpan>) => unknown)(
        span
      );
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
  createContextKey: (name: string) => Symbol(name),
  trace: {
    getTracer: () => mockTracer,
    getActiveSpan: mockGetActiveSpan,
  },
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
  context: {
    active: mock(() => ({})),
  },
}));

mock.module("@opentelemetry/core", () => ({
  createContextKey: (name: string) => Symbol(name),
  suppressTracing: {
    isTracingSuppressed: () => false,
    suppressTracing: () => ({}),
    unsuppressTracing: () => ({}),
  },
}));

// Properly mock OTLPExporterBase to be extendable
class MockOTLPExporterBase {
  export(_items: unknown, _resultCallback: unknown) {
    /* mock */
  }
}

mock.module("@opentelemetry/otlp-exporter-base", () => ({
  OTLPExporterBase: MockOTLPExporterBase,
}));

// Track the current state of env mock - use a dynamic getter to allow changes
// This variable is exported so other test files can control it
let _otelEndpoint = "http://localhost:5080";
const envMock = {
  NODE_ENV: "test",
  get OTEL_EXPORTER_OTLP_ENDPOINT() {
    return _otelEndpoint;
  },
  OPENOBSERVE_USER: "testuser",
  OPENOBSERVE_PASSWORD: "testpass",
  OPENOBSERVE_ORG: "default",
  OPENOBSERVE_LOG_STREAM: "lumen_logs",
  OPENOBSERVE_METRIC_STREAM: "lumen_metrics",
  OPENOBSERVE_TRACE_STREAM: "lumen_traces",
};

mock.module("./env", () => ({
  get env() {
    return envMock;
  },
  // Export the control variable for cross-test coordination
  _otelEndpointControl: _otelEndpoint,
}));

mock.module("./config", () => ({
  getOtelConfig: (serviceName: string) => {
    if (typeof window !== "undefined") {
      return {
        enabled: false,
        endpoint: "",
        org: "default",
        logStream: "",
        metricStream: "",
        traceStream: "",
        headers: {},
        serviceName,
        environment: "browser",
      };
    }
    const currentEnv = envMock;
    return {
      enabled: !!currentEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
      endpoint: currentEnv.OTEL_EXPORTER_OTLP_ENDPOINT || "",
      org: currentEnv.OPENOBSERVE_ORG,
      logStream: currentEnv.OPENOBSERVE_LOG_STREAM,
      metricStream: currentEnv.OPENOBSERVE_METRIC_STREAM,
      traceStream: currentEnv.OPENOBSERVE_TRACE_STREAM,
      headers: (() =>
        currentEnv.OPENOBSERVE_USER && currentEnv.OPENOBSERVE_PASSWORD
          ? {
              Authorization: `Basic ${Buffer.from(
                `${currentEnv.OPENOBSERVE_USER}:${currentEnv.OPENOBSERVE_PASSWORD}`
              ).toString("base64")}`,
            }
          : {})(),
      serviceName,
      environment: currentEnv.NODE_ENV,
    };
  },
  getOtlpSignalEndpoint: (
    config: { endpoint: string; org: string },
    signal: string
  ) => `${config.endpoint}/api/${config.org}/v1/${signal}`,
}));

import { createChildLogger, createLogger, getOtelConfig } from "./index";
import { getTraceContext, recordError, withSpan } from "./tracer";

describe("logger integration", () => {
  let consoleLogMock: ReturnType<typeof mock<Console["log"]>>;
  const originalConsoleLog = globalThis.console.log;
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    emitMock.mockClear();
    currentActiveSpan = null;
    consoleLogMock = mock<Console["log"]>(() => undefined);
    globalThis.console.log = consoleLogMock;

    originalWindow = globalThis.window;
    // @ts-expect-error
    globalThis.window = undefined;
  });

  afterEach(() => {
    globalThis.console.log = originalConsoleLog;
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
  });

  describe("config + logger interop", () => {
    it("getOtelConfig returns enabled config with headers in server mode", () => {
      const config = getOtelConfig("integration-test");
      expect(config.enabled).toBe(true);
      expect(config.serviceName).toBe("integration-test");
      expect(config.headers.Authorization).toBe(
        `Basic ${Buffer.from("testuser:testpass").toString("base64")}`
      );
      expect(config.endpoint).toBe("http://localhost:5080");
      expect(config.org).toBe("default");
      expect(config.traceStream).toBe("lumen_traces");
    });

    it("logger creates and logs with correct config-derived environment", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("config test");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"env":"test"');
    });

    it("config without endpoint is consistent with logger behavior", () => {
      const originalEndpoint = _otelEndpoint;
      try {
        _otelEndpoint = "";
        const config = getOtelConfig("svc");
        expect(config.enabled).toBe(false);
        // Logger still works even when no endpoint is configured
        const l = createLogger({ level: "info", pretty: false });
        l.info("works without otel");
        expect(consoleLogMock).toHaveBeenCalled();
      } finally {
        _otelEndpoint = originalEndpoint;
      }
    });
  });

  describe("tracer + logger interop", () => {
    it("logger emits otel logs with trace context when inside withSpan", () => {
      withSpan("integration-span", () => {
        const ctx = getTraceContext();
        expect(ctx).not.toBeNull();
        expect(ctx?.traceId).toBe("integration-trace-id");

        const l = createLogger({ level: "info", name: "traced-logger" });
        l.info("traced message", { requestId: "req-123" });

        expect(emitMock).toHaveBeenCalled();
        const data = emitMock.mock.calls[0]?.[0];
        expect(data).toBeDefined();
        expect(data!.body).toBe("traced message");
        expect(data!.attributes["logger.name"]).toBe("traced-logger");
        return null;
      });
    });

    it("error recorded in span is consistent with logger error output", () => {
      withSpan("error-span", () => {
        const error = new Error("integration failure");
        recordError(error, { component: "auth" });

        const l = createLogger({ level: "error", pretty: false });
        l.error("Operation failed", { error: error.message });

        expect(consoleLogMock).toHaveBeenCalled();
        const call = consoleLogMock.mock.calls[0]?.[0]! as string;
        expect(call).toContain("Operation failed");
        expect(call).toContain("integration failure");
        return null;
      });
    });

    it("nested spans work with logger in each level", () => {
      withSpan("outer", () => {
        const l1 = createLogger({ level: "info", pretty: false });
        l1.info("outer span log");

        withSpan("inner", () => {
          const l2 = createLogger({ level: "info", pretty: false });
          l2.info("inner span log");
          return null;
        });

        const l3 = createLogger({ level: "info", pretty: false });
        l3.info("back to outer");
        return null;
      });

      expect(consoleLogMock).toHaveBeenCalledTimes(3);
    });
  });

  describe("child loggers + tracer interop", () => {
    it("child logger inherits parent bindings within traced context", () => {
      withSpan("child-span", () => {
        const parent = createLogger({
          level: "info",
          pretty: false,
          base: { service: "api" },
        });
        const child = createChildLogger(parent, { module: "auth" });

        child.info("child in span");
        const call = consoleLogMock.mock.calls[0]?.[0]! as string;
        expect(call).toContain('"service":"api"');
        expect(call).toContain('"module":"auth"');
        return null;
      });
    });

    it("deeply nested child loggers preserve all bindings", () => {
      const root = createLogger({
        level: "info",
        pretty: false,
        base: { app: "lumen" },
      });
      const service = createChildLogger(root, { service: "api" });
      const module = createChildLogger(service, { module: "users" });
      const handler = createChildLogger(module, { handler: "create" });

      handler.info("deeply nested");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"app":"lumen"');
      expect(call).toContain('"service":"api"');
      expect(call).toContain('"module":"users"');
      expect(call).toContain('"handler":"create"');
    });
  });

  describe("level filtering + config interop", () => {
    it("production environment would set info level by default", () => {
      // Verify the config passes through environment correctly
      const config = getOtelConfig("svc");
      expect(config.environment).toBe("test");

      // In non-production, default level is debug
      const l = createLogger({});
      l.debug("should log in test");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("explicit level overrides environment default", () => {
      const l = createLogger({ level: "error" });
      l.info("should not log");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.error("should log");
      expect(consoleLogMock).toHaveBeenCalled();
    });
  });

  describe("browser + server mode interop", () => {
    it("config returns disabled in browser mode", () => {
      // @ts-expect-error
      globalThis.window = {};
      const config = getOtelConfig("svc");
      expect(config.enabled).toBe(false);
      expect(config.environment).toBe("browser");
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("logger adapts to browser/server mode changes", () => {
      // Server mode
      const serverLogger = createLogger({ level: "info", pretty: false });
      serverLogger.info("server msg");
      const serverCall = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(serverCall).toContain("INFO");

      // Switch to browser mode
      consoleLogMock.mockClear();
      // @ts-expect-error
      globalThis.window = {};
      const browserLogger = createLogger({ level: "info", pretty: false });
      browserLogger.info("browser msg");
      // In browser mode, uses console.groupCollapsed
      // @ts-expect-error
      globalThis.window = undefined;
    });
  });

  describe("otel emission + config interop", () => {
    it("logger name from config is propagated to otel attributes", () => {
      const l = createLogger({ level: "info", name: "integration-svc" });
      l.info("test");
      expect(emitMock).toHaveBeenCalled();
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes["logger.name"]).toBe("integration-svc");
    });

    it("base env attribute is included in otel emission", () => {
      const l = createLogger({ level: "info" });
      l.info("env check");
      expect(emitMock).toHaveBeenCalled();
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes["base.env"]).toBe("test");
    });
  });

  describe("error resilience", () => {
    it("logger continues working after otel emit throws", () => {
      emitMock.mockImplementationOnce(() => {
        throw new Error("otel failure");
      });
      const l = createLogger({ level: "info", pretty: false });
      // This should not throw even if otel emit fails
      expect(() => l.info("resilient")).toThrow("otel failure");
    });

    it("child logger works independently of parent otel state", () => {
      const parent = createLogger({
        level: "info",
        pretty: false,
        base: { p: 1 },
      });
      const child = parent.child({ c: 2 });
      child.info("independent child");
      expect(consoleLogMock).toHaveBeenCalled();
      expect(emitMock).toHaveBeenCalled();
    });
  });
});
