// Set environment variables BEFORE any imports that use them
process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock the env module BEFORE importing routes
const mockEnv = {
  NODE_ENV: "development",
  PORT: 3002,
  WEB_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-must-be-21-chars-long!!",
  BETTER_AUTH_TRUSTED_ORIGINS: [],
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  LOG_LEVEL: "info",
  OTEL_ENABLED: false,
  DATABASE_URL: "postgres://dummy",
  JWKS_ENCRYPTION_KEY: "test-jwks-encryption-key-32chars!!",
  CEREBRAS_API_KEY: undefined,
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  AI_ENCRYPTION_KEY: undefined,
};

mock.module("../env", () => ({
  env: mockEnv,
}));

describe("aiRoutes", () => {
  beforeEach(() => {
    // Reset modules before each test to ensure clean imports
    mock.module("../env", () => ({
      env: mockEnv,
    }));
  });

  it("exports an Elysia instance with routes", async () => {
    // Use dynamic import to get fresh module instance
    const mod = await import("./routes");
    expect(mod.aiRoutes).toBeDefined();
  });
});

afterAll(() => {
  mock.restore();
});
