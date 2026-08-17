import { createLogger } from "@lumen/logger";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const logger = createLogger({ name: "web:env" });

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Telemetry
    NEXT_TELEMETRY_DISABLED: z.string().default("1"),
    TURBO_TELEMETRY_DISABLED: z.string().default("1"),
    BETTER_AUTH_TELEMETRY: z.string().default("0"),
    // OTEL - mandatory, no opt-out flag
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    // OpenObserve auth: Basic auth derived from user + password
    OPENOBSERVE_USER: z.string().optional(),
    OPENOBSERVE_PASSWORD: z.string().optional(),
    // OpenObserve routing: org + per-signal stream names
    OPENOBSERVE_ORG: z.string().default("default"),
    OPENOBSERVE_LOG_STREAM: z.string().default("lumen_web_logs"),
    OPENOBSERVE_METRIC_STREAM: z.string().default("lumen_web_metrics"),
    OPENOBSERVE_TRACE_STREAM: z.string().default("lumen_web_traces"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url().default("http://localhost:3002"),
    NEXT_PUBLIC_PRESENCE_WS_URL: z.url().default("ws://localhost:4000"),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
    TURBO_TELEMETRY_DISABLED: process.env.TURBO_TELEMETRY_DISABLED ?? "1",
    BETTER_AUTH_TELEMETRY: process.env.BETTER_AUTH_TELEMETRY ?? "0",
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OPENOBSERVE_USER: process.env.OPENOBSERVE_USER,
    OPENOBSERVE_PASSWORD: process.env.OPENOBSERVE_PASSWORD,
    OPENOBSERVE_ORG: process.env.OPENOBSERVE_ORG,
    OPENOBSERVE_LOG_STREAM: process.env.OPENOBSERVE_LOG_STREAM,
    OPENOBSERVE_METRIC_STREAM: process.env.OPENOBSERVE_METRIC_STREAM,
    OPENOBSERVE_TRACE_STREAM: process.env.OPENOBSERVE_TRACE_STREAM,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_PRESENCE_WS_URL: process.env.NEXT_PUBLIC_PRESENCE_WS_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: false,
  onValidationError: (error) => {
    logger.error({ error }, "Environment validation failed");
    throw error;
  },
  onInvalidAccess: (key) => {
    logger.error({ key }, "Invalid environment variable access");
    throw new Error(`Invalid environment variable access: ${key}`);
  },
});

logger.debug("Web environment variables loaded");
