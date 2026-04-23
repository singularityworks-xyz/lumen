import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const ALLOWED_ORIGINS_SCHEMA = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
  .optional();

export const BETTER_AUTH_TRUSTED_ORIGINS_SCHEMA = z
  .string()
  .transform((v) => v.split(","))
  .optional();

export const OTEL_ENABLED_SCHEMA = z
  .string()
  .transform((v) => v === "true")
  .default(false);

export const PORT_SCHEMA = z.coerce.number().default(3002);

export const NODE_ENV_SCHEMA = z
  .enum(["development", "production", "test"])
  .default("development");

export const LOG_LEVEL_SCHEMA = z
  .enum(["debug", "info", "warn", "error"])
  .default("info");

export const BETTER_AUTH_SECRET_SCHEMA = z.string().min(21);

export const AI_ENCRYPTION_KEY_SCHEMA = z.string().min(32).optional();

export const env = createEnv({
  server: {
    NODE_ENV: NODE_ENV_SCHEMA,
    PORT: PORT_SCHEMA,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS_SCHEMA,
    WEB_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: BETTER_AUTH_SECRET_SCHEMA,
    BETTER_AUTH_TRUSTED_ORIGINS: BETTER_AUTH_TRUSTED_ORIGINS_SCHEMA,
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    LOG_LEVEL: LOG_LEVEL_SCHEMA,
    OTEL_ENABLED: OTEL_ENABLED_SCHEMA,
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url().optional(),
    JWKS_ENCRYPTION_KEY: z.string().min(32),
    CEREBRAS_API_KEY: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    AI_ENCRYPTION_KEY: AI_ENCRYPTION_KEY_SCHEMA,
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    WEB_URL: process.env.WEB_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    OTEL_ENABLED: process.env.OTEL_ENABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWKS_ENCRYPTION_KEY: process.env.JWKS_ENCRYPTION_KEY,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    AI_ENCRYPTION_KEY: process.env.AI_ENCRYPTION_KEY,
  },
  onValidationError: (error) => {
    console.error("Environment validation failed:", error);
    throw error;
  },
});
