import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const defaultDatabaseUrl =
  "postgresql://lumen:lumen_dev_password@localhost:5432/lumen";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    NEXT_TELEMETRY_DISABLED: z.string().default("1"),
    TURBO_TELEMETRY_DISABLED: z.string().default("1"),
  },
  /*
   * Specify what values should be validated by your schemas above.
   * Uses defaultDatabaseUrl if DATABASE_URL is not set (for local development).
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? defaultDatabaseUrl,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
    TURBO_TELEMETRY_DISABLED: process.env.TURBO_TELEMETRY_DISABLED ?? "1",
  },
  /*
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to validate against z.string().min(1), it will fail validation.
   *
   * If you want to allow empty strings, you can set this to true.
   */
  emptyStringAsUndefined: true,
  /*
   * Run validation on module load.
   * If validation fails, the app will crash immediately.
   */
  skipValidation: false,
});
