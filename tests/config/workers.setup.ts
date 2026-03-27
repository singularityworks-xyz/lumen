import "./bun.setup";
import { afterEach, beforeEach } from "bun:test";

// Set DATABASE_URL immediately at module evaluation time so @lumen/db
// can be imported in test files without throwing
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/lumen_test";

const TEST_ENV: Record<string, string> = {
  NODE_ENV: "development",
  PORT: "3999",
  WEB_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3002",
  BETTER_AUTH_SECRET: "test-secret-key-that-is-at-least-21-chars",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  DATABASE_URL: "postgresql://test:test@localhost:5432/lumen_test",
  JWKS_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  LOG_LEVEL: "error",
  OTEL_ENABLED: "false",
};

const originalEnv: Record<string, string | undefined> = {};

for (const [key, value] of Object.entries(TEST_ENV)) {
  originalEnv[key] = process.env[key];
  process.env[key] = value;
}

beforeEach(() => {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }
});

afterEach(() => {
  for (const [key, originalValue] of Object.entries(originalEnv)) {
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});
