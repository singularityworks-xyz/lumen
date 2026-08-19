// Load the gitignored root .env secrets (override per-app .env.development
// defaults) BEFORE validating env. Skipped in production, no-op if absent.
import { loadLocalEnvFiles } from "./env-loader";

loadLocalEnvFiles();

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
    // OTEL - mandatory, no opt-out flag
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    // OpenObserve auth: Basic auth derived from user + password
    OPENOBSERVE_USER: z.string().optional(),
    OPENOBSERVE_PASSWORD: z.string().optional(),
    // OpenObserve routing: org + per-signal stream names
    OPENOBSERVE_ORG: z.string().default("default"),
    OPENOBSERVE_LOG_STREAM: z.string().default("lumen_workers_logs"),
    OPENOBSERVE_METRIC_STREAM: z.string().default("lumen_workers_metrics"),
    OPENOBSERVE_TRACE_STREAM: z.string().default("lumen_workers_traces"),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWKS_ENCRYPTION_KEY: z.string().min(32),
    GENERALCOMPUTE_API_KEY: z.string().optional(),
    AI_ENCRYPTION_KEY: AI_ENCRYPTION_KEY_SCHEMA,
    SUPERMEMORY_API_URL: z.url().optional(),
    SUPERMEMORY_API_KEY: z.string().optional(),
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
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OPENOBSERVE_USER: process.env.OPENOBSERVE_USER,
    OPENOBSERVE_PASSWORD: process.env.OPENOBSERVE_PASSWORD,
    OPENOBSERVE_ORG: process.env.OPENOBSERVE_ORG,
    OPENOBSERVE_LOG_STREAM: process.env.OPENOBSERVE_LOG_STREAM,
    OPENOBSERVE_METRIC_STREAM: process.env.OPENOBSERVE_METRIC_STREAM,
    OPENOBSERVE_TRACE_STREAM: process.env.OPENOBSERVE_TRACE_STREAM,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWKS_ENCRYPTION_KEY: process.env.JWKS_ENCRYPTION_KEY,
    GENERALCOMPUTE_API_KEY: process.env.GENERALCOMPUTE_API_KEY,
    AI_ENCRYPTION_KEY: process.env.AI_ENCRYPTION_KEY,
    SUPERMEMORY_API_URL: process.env.SUPERMEMORY_API_URL,
    SUPERMEMORY_API_KEY: process.env.SUPERMEMORY_API_KEY,
  },
  onValidationError: (error) => {
    console.error("Environment validation failed:", error);
    throw error;
  },
});

// Production startup gate: the container refuses to boot until every
// environment variable production needs is set with a real value.
// Vars required by the schema above (DATABASE_URL, REDIS_URL,
// BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET, JWKS_ENCRYPTION_KEY,
// BETTER_AUTH_URL) already fail hard via createEnv; these are optional in
// development but mandatory in production — a half-configured container
// must not start silently (AI disabled, no observability, no memory).
const PRODUCTION_REQUIRED_ENV: Array<{ key: string; purpose: string }> = [
  {
    key: "GENERALCOMPUTE_API_KEY",
    purpose: "LLM provider for chat and memory extraction",
  },
  { key: "AI_ENCRYPTION_KEY", purpose: "conversation content encryption" },
  {
    key: "SUPERMEMORY_API_URL",
    purpose: "self-hosted long-term memory server",
  },
  { key: "SUPERMEMORY_API_KEY", purpose: "long-term memory server auth" },
  {
    key: "OTEL_EXPORTER_OTLP_ENDPOINT",
    purpose: "OpenTelemetry export (OpenObserve)",
  },
  { key: "OPENOBSERVE_USER", purpose: "OpenObserve auth" },
  { key: "OPENOBSERVE_PASSWORD", purpose: "OpenObserve auth" },
  {
    key: "INTERNAL_API_KEY",
    purpose: "shared secret with the presence service",
  },
];

const PLACEHOLDER_VALUE = /^(your-|sm_\.\.\.|change-me|test-|dev-only-)/i;

if (env.NODE_ENV === "production") {
  const missing = PRODUCTION_REQUIRED_ENV.filter(
    ({ key }) =>
      !process.env[key]?.trim() ||
      PLACEHOLDER_VALUE.test(process.env[key]?.trim() ?? "")
  );

  if (missing.length > 0) {
    const detail = missing
      .map(({ key, purpose }) => `  - ${key} (${purpose})`)
      .join("\n");
    console.error(
      [
        "",
        "Production startup check failed:",
        `${missing.length} required environment variable(s) are missing or still placeholders.`,
        detail,
        "Set them in the deployment environment (Dokploy) before starting the container.",
        "",
      ].join("\n")
    );
    process.exit(1);
  }
}
