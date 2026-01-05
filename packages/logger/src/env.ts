import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    OTEL_ENABLED: z
      .string()
      .transform((v) => v === "true" || v === "1")
      .default(true),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    OTEL_ENABLED: process.env.OTEL_ENABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
  },
  skipValidation: typeof window !== "undefined",
});
