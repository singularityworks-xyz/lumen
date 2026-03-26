import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";

const mockCounterAdd = mock(() => undefined);
const mockHistogramRecord = mock(() => undefined);
const mockGaugeAddCallback = mock(() => ({
  addCallback: mock(() => undefined),
}));

const mockCounter = { add: mockCounterAdd } as unknown as Counter;
const mockHistogram = { record: mockHistogramRecord } as unknown as Histogram;

const mockMeter = {
  createCounter: mock(() => mockCounter),
  createHistogram: mock(() => mockHistogram),
  createObservableGauge: mock((__name: string, __opts: unknown) => ({
    addCallback: mock(
      (_cb: (result: { observe: (v: number) => void }) => void) => {
        mockGaugeAddCallback();
        return { addCallback: mock(() => undefined) };
      }
    ),
  })),
} as unknown as Meter;

mock.module("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => mockMeter,
  },
}));

import {
  createActiveConnectionsGauge,
  createErrorCounter,
  createRequestCounter,
  createRequestDurationHistogram,
  getMeter,
  incrementErrorCount,
  incrementRequestCount,
  recordRequestDuration,
} from "../../src/metrics";

describe("metrics", () => {
  beforeEach(() => {
    mockCounterAdd.mockClear();
    mockHistogramRecord.mockClear();
    (mockMeter.createCounter as ReturnType<typeof mock>).mockClear();
    (mockMeter.createHistogram as ReturnType<typeof mock>).mockClear();
    (mockMeter.createObservableGauge as ReturnType<typeof mock>).mockClear();
    mockGaugeAddCallback.mockClear();
  });

  describe("getMeter", () => {
    it("returns a meter with default name", () => {
      const meter = getMeter();
      expect(meter).toBe(mockMeter);
    });

    it("returns a meter with custom name", () => {
      const meter = getMeter("custom-meter");
      expect(meter).toBe(mockMeter);
    });
  });

  describe("createRequestCounter", () => {
    it("creates a counter with correct name and description", () => {
      const counter = createRequestCounter(mockMeter);

      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        "http_requests_total",
        { description: "Total number of HTTP requests" }
      );
      expect(counter).toBe(mockCounter);
    });
  });

  describe("createRequestDurationHistogram", () => {
    it("creates a histogram with correct name, description, and unit", () => {
      const histogram = createRequestDurationHistogram(mockMeter);

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        "http_request_duration_seconds",
        {
          description: "HTTP request duration in seconds",
          unit: "s",
        }
      );
      expect(histogram).toBe(mockHistogram);
    });
  });

  describe("createActiveConnectionsGauge", () => {
    it("creates an observable gauge and registers callback", () => {
      const getConnectionCount = () => 5;
      createActiveConnectionsGauge(mockMeter, getConnectionCount);

      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith(
        "active_connections",
        { description: "Number of active connections" }
      );
      expect(mockGaugeAddCallback).toHaveBeenCalled();
    });

    it("callback observes the live connection count", () => {
      let capturedCallback: (result: { observe: (v: number) => void }) => void;

      const mockAddCallback = mock(
        (cb: (result: { observe: (v: number) => void }) => void) => {
          capturedCallback = cb;
          return { addCallback: mock(() => undefined) };
        }
      );

      const mockGauge = {
        createObservableGauge: mock(() => ({ addCallback: mockAddCallback })),
      } as unknown as Meter;

      let observedValue = 0;
      const mockObserve = mock((v: number) => {
        observedValue = v;
      });

      createActiveConnectionsGauge(mockGauge, () => 42);
      capturedCallback!({ observe: mockObserve });

      expect(observedValue).toBe(42);
      expect(mockObserve).toHaveBeenCalledWith(42);
    });
  });

  describe("createErrorCounter", () => {
    it("creates a counter with correct name and description", () => {
      const counter = createErrorCounter(mockMeter);

      expect(mockMeter.createCounter).toHaveBeenCalledWith("errors_total", {
        description: "Total number of errors",
      });
      expect(counter).toBe(mockCounter);
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
      incrementRequestCount();
      incrementRequestCount();

      const createCounterMock = mockMeter.createCounter as ReturnType<
        typeof mock
      >;
      const createCalls = createCounterMock.mock.calls.filter(
        (c) => c[0] === "http_requests_total"
      );
      expect(createCalls.length).toBe(1);
      expect(mockCounterAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe("incrementErrorCount", () => {
    it("initializes default metrics and increments error counter", () => {
      incrementErrorCount();

      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        "errors_total",
        expect.any(Object)
      );
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

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(
        "http_request_duration_seconds",
        expect.any(Object)
      );
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
