import {
  type Counter,
  type Histogram,
  type Meter,
  metrics,
} from "@opentelemetry/api";

const DEFAULT_METER_NAME = "lumen";

export function getMeter(name: string = DEFAULT_METER_NAME): Meter {
  return metrics.getMeter(name);
}

export function createRequestCounter(meter: Meter): Counter {
  return meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  });
}

export function createRequestDurationHistogram(meter: Meter): Histogram {
  return meter.createHistogram("http_request_duration_seconds", {
    description: "HTTP request duration in seconds",
    unit: "s",
  });
}

export function createActiveConnectionsGauge(
  meter: Meter,
  getConnections: () => number
) {
  return meter
    .createObservableGauge("active_connections", {
      description: "Number of active connections",
    })
    .addCallback((result) => {
      result.observe(getConnections());
    });
}

export function createErrorCounter(meter: Meter): Counter {
  return meter.createCounter("errors_total", {
    description: "Total number of errors",
  });
}

let defaultMeter: Meter | null = null;
let requestCounter: Counter | null = null;
let errorCounter: Counter | null = null;
let requestDuration: Histogram | null = null;

function ensureDefaultMetrics(): void {
  if (!defaultMeter) {
    defaultMeter = getMeter();
    requestCounter = createRequestCounter(defaultMeter);
    errorCounter = createErrorCounter(defaultMeter);
    requestDuration = createRequestDurationHistogram(defaultMeter);
  }
}

export function incrementRequestCount(
  attributes?: Record<string, string>
): void {
  ensureDefaultMetrics();
  requestCounter?.add(1, attributes);
}

export function incrementErrorCount(attributes?: Record<string, string>): void {
  ensureDefaultMetrics();
  errorCounter?.add(1, attributes);
}

export function recordRequestDuration(
  durationSeconds: number,
  attributes?: Record<string, string>
): void {
  ensureDefaultMetrics();
  requestDuration?.record(durationSeconds, attributes);
}
