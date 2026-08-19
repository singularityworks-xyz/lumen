import { describe, expect, it } from "bun:test";
import {
  createGeneralComputeProvider,
  createJsonModeFormat,
  createJsonSchemaFormat,
  DEFAULT_PRIMARY_MODEL,
  FALLBACK_MODELS,
  FAST_MODEL,
  type GeneralComputeModel,
  getGeneralComputeModel,
  getModelFallbackChain,
  isGeneralComputeConfigured,
  isRateLimitError,
} from "./generalcompute";

const ALL_MODELS: GeneralComputeModel[] = [
  "minimax-m2.7",
  "deepseek-v3.2",
  "deepseek-v3.1",
  "gpt-oss-120b",
];

describe("getModelFallbackChain", () => {
  it("starts with the primary model", () => {
    const chain = getModelFallbackChain("deepseek-v3.2");
    expect(chain[0]).toBe("deepseek-v3.2");
  });

  it("defaults to DEFAULT_PRIMARY_MODEL when no argument given", () => {
    const chain = getModelFallbackChain();
    expect(chain[0]).toBe(DEFAULT_PRIMARY_MODEL);
  });

  it("never duplicates the primary model in the chain", () => {
    for (const primary of ALL_MODELS) {
      const chain = getModelFallbackChain(primary);
      const occurrences = chain.filter((m) => m === primary).length;
      expect(occurrences).toBe(1);
    }
  });

  it("contains all models (primary + remaining fallbacks)", () => {
    const chain = getModelFallbackChain(DEFAULT_PRIMARY_MODEL);
    expect(chain).toHaveLength(ALL_MODELS.length);
    expect(chain[0]).toBe(DEFAULT_PRIMARY_MODEL);
    expect(chain).toContain("deepseek-v3.1");
    expect(chain).toContain("minimax-m2.7");
  });

  it("includes remaining FALLBACK_MODELS when primary is already in FALLBACK_MODELS", () => {
    const primary: GeneralComputeModel = "deepseek-v3.1";
    const chain = getModelFallbackChain(primary);
    const remaining = FALLBACK_MODELS.filter((model) => model !== primary);
    expect(chain).toHaveLength(1 + remaining.length);
    for (const fb of remaining) {
      expect(chain).toContain(fb);
    }
  });

  it("chain length is 1 + (fallbackModels minus primary) for all primaries", () => {
    for (const primary of ALL_MODELS) {
      const chain = getModelFallbackChain(primary);
      const expectedFallbacks = FALLBACK_MODELS.filter(
        (model) => model !== primary
      );
      expect(chain).toHaveLength(1 + expectedFallbacks.length);
    }
  });

  it("FAST_MODEL is one of the supported models", () => {
    expect(ALL_MODELS).toContain(FAST_MODEL);
  });
});

describe("isRateLimitError", () => {
  it("returns true for HTTP 429 in message", () => {
    expect(isRateLimitError(new Error("HTTP 429 Too Many Requests"))).toBe(
      true
    );
  });

  it("returns true for 'rate limit' substring", () => {
    expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
  });

  it("returns true for 'too many requests'", () => {
    expect(isRateLimitError(new Error("Too many requests"))).toBe(true);
  });

  it("returns true for 'quota' in message", () => {
    expect(isRateLimitError(new Error("Quota exceeded for this model"))).toBe(
      true
    );
  });

  it("returns true for 'resource_exhausted'", () => {
    expect(isRateLimitError(new Error("RESOURCE_EXHAUSTED: model limit"))).toBe(
      true
    );
  });

  it("is case-insensitive", () => {
    expect(isRateLimitError(new Error("RATE LIMIT"))).toBe(true);
    expect(isRateLimitError(new Error("429 Error"))).toBe(true);
  });

  it("returns false for non-Error values", () => {
    expect(isRateLimitError("rate limit")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(429)).toBe(false);
  });

  it("returns false for unrelated Error messages", () => {
    expect(isRateLimitError(new Error("Network timeout"))).toBe(false);
    expect(isRateLimitError(new Error("Unauthorized"))).toBe(false);
  });
});

describe("isGeneralComputeConfigured", () => {
  it("returns true for a non-empty string", () => {
    expect(isGeneralComputeConfigured("gc-abc123")).toBe(true);
  });

  it("returns false for undefined", () => {
    expect(isGeneralComputeConfigured(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGeneralComputeConfigured("")).toBe(false);
  });
});

describe("createJsonSchemaFormat", () => {
  it("returns type 'json_schema' with the provided name and schema", () => {
    const schema = { type: "object" as const, properties: {} };
    const format = createJsonSchemaFormat("test-tool", schema);
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.name).toBe("test-tool");
    expect(format.json_schema.schema).toBe(schema);
  });

  it("defaults strict to true", () => {
    const schema = { type: "object" as const };
    const format = createJsonSchemaFormat("t", schema);
    expect(format.json_schema.strict).toBe(true);
  });

  it("respects explicit strict=false", () => {
    const schema = { type: "object" as const };
    const format = createJsonSchemaFormat("t", schema, false);
    expect(format.json_schema.strict).toBe(false);
  });
});

describe("createJsonModeFormat", () => {
  it("returns type 'json_object'", () => {
    const format = createJsonModeFormat();
    expect(format).toEqual({ type: "json_object" });
  });
});

describe("createGeneralComputeProvider", () => {
  it("returns a provider with chatModel method", () => {
    const provider = createGeneralComputeProvider({ apiKey: "test-key" });
    expect(provider).toBeDefined();
    expect(typeof provider.chatModel).toBe("function");
  });

  it("provider can create a model instance", () => {
    const provider = createGeneralComputeProvider({ apiKey: "test-key" });
    const model = provider.chatModel("deepseek-v3.1");
    expect(model).toBeDefined();
    expect(typeof model).toBe("object");
  });

  it("creates different providers for different API keys", () => {
    const provider1 = createGeneralComputeProvider({ apiKey: "key-1" });
    const provider2 = createGeneralComputeProvider({ apiKey: "key-2" });
    expect(provider1).not.toBe(provider2);
  });
});

describe("getGeneralComputeModel", () => {
  it("returns a LanguageModel with default model", () => {
    const model = getGeneralComputeModel("test-key");
    expect(model).toBeDefined();
    expect(typeof model).toBe("object");
  });

  it("returns a LanguageModel with specified model", () => {
    const model = getGeneralComputeModel("test-key", "deepseek-v3.2");
    expect(model).toBeDefined();
  });

  it("accepts all valid GeneralComputeModel values", () => {
    for (const modelName of ALL_MODELS) {
      const model = getGeneralComputeModel("test-key", modelName);
      expect(model).toBeDefined();
    }
  });

  it("uses DEFAULT_PRIMARY_MODEL when no model specified", () => {
    const model = getGeneralComputeModel("test-key");
    expect(model).toBeDefined();
  });
});
