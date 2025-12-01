import { createLogger } from "@lumen/logger";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const logger = createLogger({ name: "web:env" });

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    NEXT_TELEMETRY_DISABLED: z.string().default("1"),
    TURBO_TELEMETRY_DISABLED: z.string().default("1"),
    BETTER_AUTH_TELEMETRY: z.string().default("0"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
    TURBO_TELEMETRY_DISABLED: process.env.TURBO_TELEMETRY_DISABLED ?? "1",
    BETTER_AUTH_TELEMETRY: process.env.BETTER_AUTH_TELEMETRY ?? "0",
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
