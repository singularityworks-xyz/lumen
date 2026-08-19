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

const mockEnv = {
  GENERALCOMPUTE_API_KEY: "test-api-key",
};

// Mock the env module BEFORE importing providers
mock.module("../env", () => ({
  env: mockEnv,
}));

// Import these after setting up mocks - they'll use the mocked env
const { DEFAULT_PRIMARY_MODEL } = await import("@lumen/ai");
const { getModel, getModelChain, isAiEnabled, isRateLimitError } = await import(
  "./providers"
);

describe("isAiEnabled", () => {
  it("returns true when GENERALCOMPUTE_API_KEY is set", () => {
    mockEnv.GENERALCOMPUTE_API_KEY = "test-key";
    expect(isAiEnabled()).toBe(true);
  });

  it("returns false when GENERALCOMPUTE_API_KEY is empty", () => {
    mockEnv.GENERALCOMPUTE_API_KEY = "";
    expect(isAiEnabled()).toBe(false);
  });
});

describe("getModel", () => {
  beforeEach(() => {
    mockEnv.GENERALCOMPUTE_API_KEY = "test-api-key";
  });

  it("returns a language model with default model", () => {
    const model = getModel();
    expect((model as { provider: string }).provider).toBe(
      "generalcompute.chat"
    );
    expect((model as { modelId: string }).modelId).toBe(DEFAULT_PRIMARY_MODEL);
  });

  it("returns a language model with specified model", () => {
    const model = getModel("deepseek-v3.2");
    expect((model as { provider: string }).provider).toBe(
      "generalcompute.chat"
    );
    expect((model as { modelId: string }).modelId).toBe("deepseek-v3.2");
  });

  it("throws when GENERALCOMPUTE_API_KEY is not configured", () => {
    mockEnv.GENERALCOMPUTE_API_KEY = "";
    expect(() => getModel()).toThrow(
      "GENERALCOMPUTE_API_KEY is not configured"
    );
  });
});

describe("getModelChain", () => {
  it("returns fallback chain from provider helpers", () => {
    const chain = getModelChain();
    expect(chain[0]).toBe(DEFAULT_PRIMARY_MODEL);
    expect(Array.isArray(chain)).toBe(true);
    expect(chain.length).toBeGreaterThan(1);
  });
});

describe("isRateLimitError", () => {
  it("returns true for rate limit errors", () => {
    const rateLimitError = new Error("rate limit exceeded");
    expect(isRateLimitError(rateLimitError)).toBe(true);

    const otherError = new Error("something else");
    expect(isRateLimitError(otherError)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRateLimitError("string")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

afterAll(() => {
  mock.restore();
});
