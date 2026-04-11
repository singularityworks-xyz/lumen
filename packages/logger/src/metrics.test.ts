import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockCounterAdd = mock(() => undefined);
const mockHistogramRecord = mock(() => undefined);
const mockGaugeAddCallback = mock((fn) => {
  fn({ observe: mock(() => undefined) });
});

const mockMeter = {
  createCounter: mock(() => ({ add: mockCounterAdd })),
  createHistogram: mock(() => ({ record: mockHistogramRecord })),
  createObservableGauge: mock(() => ({ addCallback: mockGaugeAddCallback })),
};

mock.module("@opentelemetry/api", () => ({
  createContextKey: (name: string) => Symbol(name),
  metrics: {
    getMeter: mock(() => mockMeter),
  },
  trace: {
    getTracer: mock(() => ({})),
    getActiveSpan: mock(() => undefined),
  },
  context: {
    active: mock(() => ({})),
  },
  diag: {
    setLogger: mock(() => undefined),
    info: mock(() => undefined),
    warn: mock(() => undefined),
    error: mock(() => undefined),
  },
  DiagLogLevel: { INFO: 9, WARN: 13, ERROR: 17 },
  SpanStatusCode: { UNSET: 0, OK: 1, ERROR: 2 },
}));

import type { Meter } from "@opentelemetry/api";
import {
  createActiveConnectionsGauge,
  createErrorCounter,
  createRequestCounter,
  createRequestDurationHistogram,
  getMeter,
  incrementErrorCount,
  incrementRequestCount,
  recordRequestDuration,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    mockCounterAdd.mockClear();
    mockHistogramRecord.mockClear();
    mockGaugeAddCallback.mockClear();
    mockMeter.createCounter.mockClear();
    mockMeter.createHistogram.mockClear();
    mockMeter.createObservableGauge.mockClear();
  });

  describe("getMeter", () => {
    it("returns a meter with default name", () => {
      const meter = getMeter();
      expect(meter).toBe(mockMeter as unknown as Meter);
    });

    it("returns a meter with custom name", () => {
      const meter = getMeter("custom-meter");
      expect(meter).toBe(mockMeter as unknown as Meter);
    });
  });

  describe("createRequestCounter", () => {
    it("creates a counter with correct name and description", () => {
      createRequestCounter(mockMeter as unknown as Meter);
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        "http_requests_total",
        { description: "Total number of HTTP requests" }
      );
    });
  });

  describe("createRequestDurationHistogram", () => {
    it("creates a histogram with correct name, description, and unit", () => {
      createRequestDurationHistogram(mockMeter as unknown as Meter);
      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        "http_request_duration_seconds",
        { description: "HTTP request duration in seconds", unit: "s" }
      );
    });
  });

  describe("createActiveConnectionsGauge", () => {
    it("creates an observable gauge and registers callback", () => {
      const getConnections = mock(() => 5);
      createActiveConnectionsGauge(
        mockMeter as unknown as Meter,
        getConnections
      );

      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith(
        "active_connections",
        { description: "Number of active connections" }
      );
      expect(mockGaugeAddCallback).toHaveBeenCalled();
    });

    it("callback observes the live connection count", () => {
      const getConnections = mock(() => 42);
      const mockObserver = { observe: mock(() => undefined) };

      mockGaugeAddCallback.mockImplementationOnce(
        (fn: (observer: { observe: (value: number) => void }) => void) => {
          fn(mockObserver);
        }
      );

      createActiveConnectionsGauge(
        mockMeter as unknown as Meter,
        getConnections
      );

      expect(getConnections).toHaveBeenCalled();
      expect(mockObserver.observe).toHaveBeenCalledWith(42);
    });
  });

  describe("createErrorCounter", () => {
    it("creates a counter with correct name and description", () => {
      createErrorCounter(mockMeter as unknown as Meter);
      expect(mockMeter.createCounter).toHaveBeenCalledWith("errors_total", {
        description: "Total number of errors",
      });
    });
  });

  describe("incrementRequestCount", () => {
    it("initializes default metrics and increments counter", () => {
      incrementRequestCount();

      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        "http_requests_total",
        expect.any(Object)
      );
      expect(mockCounterAdd).toHaveBeenCalledWith(1, undefined);
    });

    it("passes attributes to the counter", () => {
      incrementRequestCount({ method: "GET", status: "200" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        method: "GET",
        status: "200",
      });
    });

    it("does not re-initialize metrics on subsequent calls", () => {
      mockMeter.createCounter.mockClear();

      incrementRequestCount();
      incrementRequestCount();

      const createCounterMock =
        mockMeter.createCounter as unknown as ReturnType<typeof mock>;
      const createCalls = createCounterMock.mock.calls.filter(
        (c) => c[0] === "http_requests_total"
      );
      expect(createCalls.length).toBe(0); // Because it uses singleton
    });
  });

  describe("incrementErrorCount", () => {
    it("initializes default metrics and increments error counter", () => {
      incrementErrorCount();

      expect(mockCounterAdd).toHaveBeenCalledWith(1, undefined);
    });

    it("passes attributes to the error counter", () => {
      incrementErrorCount({ type: "ValidationError" });

      expect(mockCounterAdd).toHaveBeenCalledWith(1, {
        type: "ValidationError",
      });
    });
  });

  describe("recordRequestDuration", () => {
    it("initializes default metrics and records duration", () => {
      recordRequestDuration(0.25);

      expect(mockHistogramRecord).toHaveBeenCalledWith(0.25, undefined);
    });

    it("passes attributes to the histogram", () => {
      recordRequestDuration(1.5, { endpoint: "/api/users" });

      expect(mockHistogramRecord).toHaveBeenCalledWith(1.5, {
        endpoint: "/api/users",
      });
    });
  });
});
