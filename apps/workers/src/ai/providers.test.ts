import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetCerebrasModel = mock((_key: string, model: string) => ({
  modelId: model,
  provider: "cerebras",
}));

const mockGetModelFallbackChain = mock((model: string) => [
  model,
  "llama-3.3-70b",
]);

const mockIsRateLimitError = mock(
  (error: unknown) =>
    error instanceof Error && error.message.includes("rate limit")
);

mock.module("@lumen/ai", () => ({
  DEFAULT_PRIMARY_MODEL: "llama-3.3-70b",
  getCerebrasModel: mockGetCerebrasModel,
  getModelFallbackChain: mockGetModelFallbackChain,
  isRateLimitError: mockIsRateLimitError,
}));

const mockEnv = {
  CEREBRAS_API_KEY: "test-api-key",
};

mock.module("../env", () => ({
  env: mockEnv,
}));

import {
  getModel,
  getModelChain,
  isAiEnabled,
  isRateLimitError,
} from "./providers";

describe("isAiEnabled", () => {
  it("returns true when CEREBRAS_API_KEY is set", () => {
    mockEnv.CEREBRAS_API_KEY = "test-key";
    expect(isAiEnabled()).toBe(true);
  });

  it("returns false when CEREBRAS_API_KEY is empty", () => {
    mockEnv.CEREBRAS_API_KEY = "";
    expect(isAiEnabled()).toBe(false);
  });
});

describe("getModel", () => {
  beforeEach(() => {
    mockGetCerebrasModel.mockClear();
    mockEnv.CEREBRAS_API_KEY = "test-api-key";
  });

  it("returns a language model with default model", () => {
    getModel();
    expect(mockGetCerebrasModel).toHaveBeenCalledWith(
      "test-api-key",
      "llama-3.3-70b"
    );
  });

  it("returns a language model with specified model", () => {
    const _model = getModel("custom-model" as never);
    expect(mockGetCerebrasModel).toHaveBeenCalledWith(
      "test-api-key",
      "custom-model"
    );
  });

  it("throws when CEREBRAS_API_KEY is not configured", () => {
    mockEnv.CEREBRAS_API_KEY = "";
    expect(() => getModel()).toThrow("CEREBRAS_API_KEY is not configured");
  });
});

describe("getModelChain", () => {
  it("returns fallback chain from provider helpers", () => {
    mockGetModelFallbackChain.mockClear();

    const chain = getModelChain();

    expect(mockGetModelFallbackChain).toHaveBeenCalledWith("llama-3.3-70b");
    expect(chain).toEqual(["llama-3.3-70b", "llama-3.3-70b"]);
    expect(Array.isArray(chain)).toBe(true);
  });
});

describe("isRateLimitError", () => {
  it("delegates to the @lumen/ai checkRateLimitError helper", () => {
    mockIsRateLimitError.mockClear();

    const rateLimitError = new Error("rate limit exceeded");
    expect(isRateLimitError(rateLimitError)).toBe(true);

    const otherError = new Error("something else");
    expect(isRateLimitError(otherError)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    mockIsRateLimitError.mockClear();
    expect(isRateLimitError("string")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
