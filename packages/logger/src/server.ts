// Server-only OTEL exports - DO NOT import in client components
// Use: import { initOtel } from "@lumen/logger/server"
// biome-ignore lint/performance/noBarrelFile: Server-only OTEL exports - DO NOT import in client components
export {
  createActiveConnectionsGauge,
  createErrorCounter,
  createRequestCounter,
  createRequestDurationHistogram,
  getMeter,
  incrementErrorCount,
  incrementRequestCount,
  recordRequestDuration,
} from "./metrics";
export {
  getLoggerProvider,
  getMeterProvider,
  getTracerProvider,
  initOtel,
  isOtelInitialized,
  shutdownOtel,
} from "./sdk-node";
export {
  addSpanEvent,
  getActiveSpan,
  getTraceContext,
  getTracer,
  recordSpanError,
  SpanStatusCode,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "./tracer";
