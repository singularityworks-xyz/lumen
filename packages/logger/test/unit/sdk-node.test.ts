import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { LoggerProvider } from "@opentelemetry/sdk-logs";
import type { MeterProvider } from "@opentelemetry/sdk-metrics";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

// Track mock state for providers
const mockTracerProviderShutdown = mock(() => Promise.resolve());
const mockMeterProviderShutdown = mock(() => Promise.resolve());
const mockLoggerProviderShutdown = mock(() => Promise.resolve());
const mockTracerProviderRegister = mock(() => undefined);

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
let otelEnabled = true;

mock.module("@opentelemetry/api", () => {
  function DiagConsoleLogger() {}
  return {
    DiagConsoleLogger,
    DiagLogLevel: { INFO: 9 },
    diag: {
      setLogger: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
    },
    metrics: {
      setGlobalMeterProvider: mock(() => undefined),
    },
    trace: {},
  };
});

mock.module("@opentelemetry/exporter-logs-otlp-http", () => {
  function OTLPLogExporter() {}
  return { OTLPLogExporter };
});

mock.module("@opentelemetry/exporter-metrics-otlp-http", () => {
  function OTLPMetricExporter() {}
  return { OTLPMetricExporter };
});

mock.module("@opentelemetry/exporter-trace-otlp-http", () => {
  function OTLPTraceExporter() {}
  return { OTLPTraceExporter };
});

mock.module("@opentelemetry/host-metrics", () => {
  class HostMetrics {
    start() {}
  }
  return { HostMetrics };
});

mock.module("@opentelemetry/instrumentation", () => ({
  registerInstrumentations: mock(() => undefined),
}));

mock.module("@opentelemetry/resources", () => ({
  resourceFromAttributes: mock((attrs: Record<string, unknown>) => attrs),
}));

mock.module("@opentelemetry/sdk-logs", () => {
  function BatchLogRecordProcessor() {}
  return {
    BatchLogRecordProcessor,
    LoggerProvider: mock(() => mockLoggerProvider),
  };
});

mock.module("@opentelemetry/api-logs", () => {
  return {
    logs: {
      setGlobalLoggerProvider: mock(() => undefined),
      getLogger: mock(() => ({ emit: mock() })),
    },
  };
});

mock.module("@opentelemetry/sdk-metrics", () => {
  function PeriodicExportingMetricReader() {}
  return {
    MeterProvider: mock(() => mockMeterProvider),
    PeriodicExportingMetricReader,
  };
});

mock.module("@opentelemetry/sdk-trace-node", () => {
  function BatchSpanProcessor() {}
  return {
    BatchSpanProcessor,
    NodeTracerProvider: mock(() => mockTracerProvider),
  };
});

mock.module("../../src/config", () => ({
  getOtelConfig: (_serviceName: string) => ({
    enabled: otelEnabled,
    endpoint: otelEnabled ? "http://localhost:4318" : "",
    environment: "test",
    headers: { Authorization: "Bearer test" },
    serviceName: "test-service",
  }),
}));

import {
  getLoggerProvider,
  getMeterProvider,
  getTracerProvider,
  initOtel,
  isOtelInitialized,
  shutdownOtel,
} from "../../src/sdk-node";

describe("sdk-node", () => {
  beforeEach(() => {
    otelEnabled = true;
    mockTracerProviderShutdown.mockClear();
    mockMeterProviderShutdown.mockClear();
    mockLoggerProviderShutdown.mockClear();
    mockTracerProviderRegister.mockClear();
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
    it("returns false and does not initialize when OTEL is disabled", () => {
      otelEnabled = false;

      const result = initOtel("test-service");

      expect(result).toBe(false);
      expect(isOtelInitialized()).toBe(false);
    });

    it("returns true and initializes providers when OTEL is enabled", () => {
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
      expect(getTracerProvider()).toBe(mockTracerProvider);
    });
  });

  describe("getMeterProvider", () => {
    it("returns provider after initialization", () => {
      initOtel("test-service");
      expect(getMeterProvider()).toBe(mockMeterProvider);
    });
  });

  describe("getLoggerProvider", () => {
    it("returns provider after initialization", () => {
      initOtel("test-service");
      expect(getLoggerProvider()).toBe(mockLoggerProvider);
    });
  });

  describe("isOtelInitialized", () => {
    it("returns true after successful init", () => {
      initOtel("test-service");
      expect(isOtelInitialized()).toBe(true);
    });

    it("returns false after init with disabled config", () => {
      otelEnabled = false;
      initOtel("test-service");
      expect(isOtelInitialized()).toBe(false);
    });
  });
});
