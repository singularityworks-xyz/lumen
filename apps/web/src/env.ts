import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    NEXT_TELEMETRY_DISABLED: z.string().default("1"),
    TURBO_TELEMETRY_DISABLED: z.string().default("1"),
    BETTER_AUTH_TELEMETRY: z.string().default("0"),
  },
  /*
   * Specify what values should be validated by your schemas above.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
    TURBO_TELEMETRY_DISABLED: process.env.TURBO_TELEMETRY_DISABLED ?? "1",
    BETTER_AUTH_TELEMETRY: process.env.BETTER_AUTH_TELEMETRY ?? "0",
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
