import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Define types inline to avoid importing real OpenTelemetry modules
// before mock.module() calls take effect
interface Instrumentation {
  _config: { enabled: boolean };
  disable: () => void;
  enable: () => void;
  getConfig: () => { enabled: boolean };
  instrumentationName: string;
  instrumentationVersion: string;
  setConfig: () => { enabled: boolean };
  setLoggerProvider: () => void;
  setMeterProvider: () => void;
  setTracerProvider: () => void;
}

interface LoggerProvider {
  shutdown: () => Promise<void>;
}
interface MeterProvider {
  shutdown: () => Promise<void>;
}
interface NodeTracerProvider {
  register: () => void;
  shutdown: () => Promise<void>;
}

// Track mock state for providers
const mockTracerProviderShutdown = mock(() => Promise.resolve());
const mockMeterProviderShutdown = mock(() => Promise.resolve());
const mockLoggerProviderShutdown = mock(() => Promise.resolve());
const mockTracerProviderRegister = mock(() => undefined);
const mockDiagSetLogger = mock(() => undefined);
const mockDiagWarn = mock((_message: string, _error?: Error) => undefined);
const mockRegisterInstrumentations = mock(() => undefined);

const mockTracerProvider = {
  register: mockTracerProviderRegister,
  shutdown: mockTracerProviderShutdown,
} as unknown as NodeTracerProvider;

const mockMeterProvider = {
  shutdown: mockMeterProviderShutdown,
} as unknown as MeterProvider;

const mockLoggerProvider = {
  shutdown: mockLoggerProviderShutdown,
} as unknown as LoggerProvider;

// Track initialized state to control getOtelConfig mock
let otelEndpoint = "http://localhost:5080";
let otelEnvironment: "development" | "production" | "test" = "test";

mock.module("./env", () => ({
  get env() {
    return {
      NODE_ENV: otelEnvironment,
      OTEL_EXPORTER_OTLP_ENDPOINT: otelEndpoint,
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer%20test",
      OPENOBSERVE_ORG: "default",
      OPENOBSERVE_LOG_STREAM: "lumen_logs",
      OPENOBSERVE_METRIC_STREAM: "lumen_metrics",
      OPENOBSERVE_TRACE_STREAM: "lumen_traces",
    };
  },
}));

// Also mock the config: OTEL is mandatory and enabled whenever an endpoint is set
mock.module("./config", () => ({
  getOtelConfig: (serviceName: string) => {
    const endpoint = otelEndpoint;
    return {
      enabled: !!endpoint,
      endpoint,
      org: "default",
      logStream: "lumen_logs",
      metricStream: "lumen_metrics",
      traceStream: "lumen_traces",
      headers: { Authorization: "Bearer test" },
      serviceName,
      environment: otelEnvironment,
    };
  },
  getOtlpSignalEndpoint: (
    config: { endpoint: string; org: string },
    signal: string
  ) => `${config.endpoint}/api/${config.org}/v1/${signal}`,
}));

mock.module("@opentelemetry/api", () => {
  function DiagConsoleLogger() {
    /* mock */
  }
  function createContextKey(_name: string) {
    return Symbol(_name);
  }
  return {
    createContextKey,
    DiagConsoleLogger,
    DiagLogLevel: { INFO: 9, WARN: 13, ERROR: 17 },
    diag: {
      setLogger: mockDiagSetLogger,
      info: mock(() => undefined),
      warn: mockDiagWarn,
      error: mock(() => undefined),
    },
    metrics: {
      setGlobalMeterProvider: mock(() => undefined),
    },
    trace: {
      getTracer: mock(() => ({})),
      getActiveSpan: mock(() => undefined),
    },
    context: {
      createContextKey,
      active: mock(() => ({})),
    },
  };
});

class OTLPExporterBase {
  export(_items: unknown, _resultCallback: unknown) {
    /* mock */
  }
}

// This is needed to make OTLPExporterBase extendable
Object.defineProperty(OTLPExporterBase, "name", { value: "OTLPExporterBase" });

mock.module("@opentelemetry/otlp-exporter-base", () => {
  // Return a proper extendable class
  return {
    OTLPExporterBase: class MockOTLPExporterBase {
      export(_items: unknown, _resultCallback: unknown) {
        /* mock */
      }
    },
  };
});

mock.module("@opentelemetry/otlp-exporter-base/node-http", () => ({
  OTLPExporterNodeBase: OTLPExporterBase,
  OTLPExporterBase,
  createOtlpHttpExportDelegate: mock(() => ({})),
  convertLegacyHttpOptions: mock(() => ({})),
}));

mock.module("@opentelemetry/core", () => {
  function createContextKey(_name: string) {
    return Symbol(_name);
  }
  return {
    createContextKey,
    suppressTracing: {
      isTracingSuppressed: mock(() => false),
      suppressTracing: mock(() => ({})),
      unsuppressTracing: mock(() => ({})),
    },
    baggage: {
      W3CBaggagePropagator: mock(() => ({})),
    },
  };
});

mock.module("@opentelemetry/otlp-transformer", () => ({
  JsonLogsSerializer: {},
}));

mock.module("@opentelemetry/sdk-metrics", () => {
  function PeriodicExportingMetricReader() {
    /* exported for type checking */
  }
  return {
    MeterProvider: mock(() => mockMeterProvider),
    PeriodicExportingMetricReader,
  };
});

class OTLPLogExporterMock {}

mock.module("@opentelemetry/exporter-logs-otlp-http", () => ({
  OTLPLogExporter: OTLPLogExporterMock,
}));

mock.module("@opentelemetry/exporter-metrics-otlp-http", () => {
  function OTLPMetricExporter() {
    /* mock */
  }
  return { OTLPMetricExporter };
});

mock.module("@opentelemetry/exporter-trace-otlp-http", () => {
  function OTLPTraceExporter() {
    return {
      export: mock((_items: unknown, _resultCallback: unknown) => undefined),
    };
  }
  return { OTLPTraceExporter };
});

mock.module("@opentelemetry/host-metrics", () => {
  class HostMetrics {
    start() {
      /* mock */
    }
  }
  return { HostMetrics };
});

mock.module("@opentelemetry/instrumentation", () => ({
  registerInstrumentations: mockRegisterInstrumentations,
}));

mock.module("@opentelemetry/resources", () => ({
  resourceFromAttributes: mock((attrs: Record<string, unknown>) => attrs),
}));

mock.module("@opentelemetry/sdk-logs", () => {
  function BatchLogRecordProcessor() {
    /* mock */
  }
  return {
    BatchLogRecordProcessor,
    LoggerProvider: mock(() => mockLoggerProvider),
  };
});

mock.module("@opentelemetry/api-logs", () => ({
  logs: {
    setGlobalLoggerProvider: mock(() => undefined),
    getLogger: mock(() => ({ emit: mock() })),
  },
}));

mock.module("@opentelemetry/sdk-trace-node", () => {
  function BatchSpanProcessor() {
    /* mock */
  }
  return {
    BatchSpanProcessor,
    NodeTracerProvider: mock(() => mockTracerProvider),
  };
});

import {
  getLoggerProvider,
  getMeterProvider,
  getTracerProvider,
  initOtel,
  isOtelInitialized,
  shutdownOtel,
} from "./sdk-node";

describe("sdk-node", () => {
  beforeEach(() => {
    otelEndpoint = "http://localhost:5080";
    otelEnvironment = "test";
    mockTracerProviderShutdown.mockClear();
    mockMeterProviderShutdown.mockClear();
    mockLoggerProviderShutdown.mockClear();
    mockTracerProviderRegister.mockClear();
    mockDiagSetLogger.mockClear();
    mockDiagWarn.mockClear();
    mockRegisterInstrumentations.mockClear();
  });

  afterEach(async () => {
    // Reset module state by shutting down if initialized
    await shutdownOtel();
  });

  describe("Initial State", () => {
    it("getTracerProvider returns null before initialization", () => {
      expect(getTracerProvider()).toBeNull();
    });

    it("getMeterProvider returns null before initialization", () => {
      expect(getMeterProvider()).toBeNull();
    });

    it("getLoggerProvider returns null before initialization", () => {
      expect(getLoggerProvider()).toBeNull();
    });

    it("isOtelInitialized returns false before init", () => {
      expect(isOtelInitialized()).toBe(false);
    });
  });

  describe("initOtel", () => {
    it("returns false and does not initialize when no endpoint is configured", () => {
      otelEndpoint = "";

      const result = initOtel("test-service");

      expect(result).toBe(false);
      expect(isOtelInitialized()).toBe(false);
    });

    it("returns true and initializes providers when an endpoint is configured", () => {
      const result = initOtel("test-service");

      expect(result).toBe(true);
      expect(isOtelInitialized()).toBe(true);
      expect(mockTracerProviderRegister).toHaveBeenCalled();
    });

    it("is idempotent — second call returns true without re-initializing", () => {
      const first = initOtel("test-service");
      expect(first).toBe(true);

      mockTracerProviderRegister.mockClear();

      const second = initOtel("test-service");
      expect(second).toBe(true);

      expect(mockTracerProviderRegister).not.toHaveBeenCalled();
    });

    it("accepts custom service version via options", () => {
      const result = initOtel("my-service", [], {
        serviceVersion: "1.2.3",
      });

      expect(result).toBe(true);
    });

    it("registers instrumentations when provided", () => {
      const instrumentation = {
        enable: () => undefined,
        instrumentationName: "test",
        instrumentationVersion: "1.0.0",
        disable: () => undefined,
        setTracerProvider: () => undefined,
        setMeterProvider: () => undefined,
        setLoggerProvider: () => undefined,
        getConfig: () => ({ enabled: true }),
        setConfig: () => ({ enabled: true }),
        _config: { enabled: true },
      } as unknown as Instrumentation;
      initOtel("test-service", [instrumentation]);

      expect(isOtelInitialized()).toBe(true);
      expect(mockRegisterInstrumentations).toHaveBeenCalledTimes(1);
    });

    it("sets diagnostic logger in development environment", () => {
      otelEnvironment = "development";

      const result = initOtel("test-service");

      expect(result).toBe(true);
      expect(mockDiagSetLogger).toHaveBeenCalledTimes(1);
    });

    it("warns when instrumentation registration throws", () => {
      const instrumentation = {
        enable: () => undefined,
        instrumentationName: "test",
        instrumentationVersion: "1.0.0",
        disable: () => undefined,
        setTracerProvider: () => undefined,
        setMeterProvider: () => undefined,
        setLoggerProvider: () => undefined,
        getConfig: () => ({ enabled: true }),
        setConfig: () => ({ enabled: true }),
        _config: { enabled: true },
      } as unknown as Instrumentation;

      mockRegisterInstrumentations.mockImplementationOnce(() => {
        throw new Error("register failed");
      });

      const result = initOtel("test-service", [instrumentation]);

      expect(result).toBe(true);
      const warningCall = mockDiagWarn.mock.calls.find(
        ([message]) => message === "[OTEL] Failed to register instrumentations"
      );
      expect(warningCall).toBeDefined();
      expect(warningCall?.[1]).toBeInstanceOf(Error);
    });
  });

  describe("shutdownOtel", () => {
    it("shuts down all providers and resets initialized state", async () => {
      initOtel("test-service");
      expect(isOtelInitialized()).toBe(true);

      await shutdownOtel();

      expect(mockTracerProviderShutdown).toHaveBeenCalled();
      expect(mockMeterProviderShutdown).toHaveBeenCalled();
      expect(mockLoggerProviderShutdown).toHaveBeenCalled();
      expect(isOtelInitialized()).toBe(false);
    });

    it("is a no-op when not initialized", async () => {
      await shutdownOtel();

      expect(mockTracerProviderShutdown).not.toHaveBeenCalled();
      expect(mockMeterProviderShutdown).not.toHaveBeenCalled();
      expect(mockLoggerProviderShutdown).not.toHaveBeenCalled();
    });

    it("allows re-initialization after shutdown", async () => {
      initOtel("test-service");
      await shutdownOtel();

      mockTracerProviderRegister.mockClear();

      const result = initOtel("test-service");
      expect(result).toBe(true);
      expect(mockTracerProviderRegister).toHaveBeenCalled();
    });
  });

  describe("getTracerProvider", () => {
    it("returns provider after initialization", () => {
      initOtel("test-service");
      expect(getTracerProvider()).toBe(
        mockTracerProvider as unknown as ReturnType<typeof getTracerProvider>
      );
    });
  });

  describe("getMeterProvider", () => {
    it("returns provider after initialization", () => {
      initOtel("test-service");
      expect(getMeterProvider()).toBe(
        mockMeterProvider as unknown as ReturnType<typeof getMeterProvider>
      );
    });
  });

  describe("getLoggerProvider", () => {
    it("returns provider after initialization", () => {
      initOtel("test-service");
      expect(getLoggerProvider()).toBe(
        mockLoggerProvider as unknown as ReturnType<typeof getLoggerProvider>
      );
    });
  });

  describe("isOtelInitialized", () => {
    it("returns true after successful init", () => {
      initOtel("test-service");
      expect(isOtelInitialized()).toBe(true);
    });

    it("returns false after init with no endpoint configured", () => {
      otelEndpoint = "";
      initOtel("test-service");
      expect(isOtelInitialized()).toBe(false);
    });
  });
});
