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
    // OTEL - disabled by default in development
    OTEL_ENABLED: z
      .string()
      .transform((v) => v === "true")
      .default(false),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
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
    OTEL_ENABLED: process.env.OTEL_ENABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
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
