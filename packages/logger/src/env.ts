import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // OpenTelemetry is mandatory: no OTEL_ENABLED opt-out. Exporting is only
    // skipped when no OTLP endpoint is configured.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    // OpenObserve auth: Basic auth is derived from user + password
    OPENOBSERVE_USER: z.string().optional(),
    OPENOBSERVE_PASSWORD: z.string().optional(),
    // OpenObserve routing: org + per-signal stream names, so multiple apps can
    // share one OpenObserve instance without mixing telemetry.
    OPENOBSERVE_ORG: z.string().default("default"),
    OPENOBSERVE_LOG_STREAM: z.string().default("lumen_logs"),
    OPENOBSERVE_METRIC_STREAM: z.string().default("lumen_metrics"),
    OPENOBSERVE_TRACE_STREAM: z.string().default("lumen_traces"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OPENOBSERVE_USER: process.env.OPENOBSERVE_USER,
    OPENOBSERVE_PASSWORD: process.env.OPENOBSERVE_PASSWORD,
    OPENOBSERVE_ORG: process.env.OPENOBSERVE_ORG,
    OPENOBSERVE_LOG_STREAM: process.env.OPENOBSERVE_LOG_STREAM,
    OPENOBSERVE_METRIC_STREAM: process.env.OPENOBSERVE_METRIC_STREAM,
    OPENOBSERVE_TRACE_STREAM: process.env.OPENOBSERVE_TRACE_STREAM,
  },
  skipValidation: typeof window !== "undefined",
});
