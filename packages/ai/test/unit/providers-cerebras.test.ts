import { describe, expect, it } from "bun:test";
import {
  type CerebrasModel,
  createJsonModeFormat,
  createJsonSchemaFormat,
  DEFAULT_PRIMARY_MODEL,
  FALLBACK_MODELS,
  getModelFallbackChain,
  isCerebrasConfigured,
  isRateLimitError,
} from "../../src/providers/cerebras";

describe("getModelFallbackChain", () => {
  it("starts with the primary model", () => {
    const chain = getModelFallbackChain("llama-3.3-70b");
    expect(chain[0]).toBe("llama-3.3-70b");
  });

  it("defaults to DEFAULT_PRIMARY_MODEL when no argument given", () => {
    const chain = getModelFallbackChain();
    expect(chain[0]).toBe(DEFAULT_PRIMARY_MODEL);
  });

  it("never duplicates the primary model in the chain", () => {
    const models: CerebrasModel[] = [
      "gpt-oss-120b",
      "llama-3.3-70b",
      "llama3.1-8b",
      "qwen-3-32b",
    ];
    for (const primary of models) {
      const chain = getModelFallbackChain(primary);
      const occurrences = chain.filter((m) => m === primary).length;
      expect(occurrences).toBe(1);
    }
  });

  it("contains all 4 models (primary + remaining fallbacks)", () => {
    const chain = getModelFallbackChain("qwen-3-32b");
    expect(chain).toHaveLength(4);
    expect(chain[0]).toBe("qwen-3-32b");
    expect(chain).toContain("gpt-oss-120b");
    expect(chain).toContain("llama-3.3-70b");
    expect(chain).toContain("llama3.1-8b");
  });

  it("includes remaining FALLBACK_MODELS when primary is already in FALLBACK_MODELS", () => {
    const primary: CerebrasModel = "llama3.1-8b";
    const chain = getModelFallbackChain(primary);
    const remaining = FALLBACK_MODELS.filter((m) => m !== primary);
    expect(chain).toHaveLength(1 + remaining.length);
    for (const fb of remaining) {
      expect(chain).toContain(fb);
    }
  });

  it("chain length is 1 + (fallbackModels minus primary) for all primaries", () => {
    const models: CerebrasModel[] = [
      "gpt-oss-120b",
      "llama-3.3-70b",
      "llama3.1-8b",
      "qwen-3-32b",
    ];
    for (const primary of models) {
      const chain = getModelFallbackChain(primary);
      const expectedFallbacks = FALLBACK_MODELS.filter((m) => m !== primary);
      expect(chain).toHaveLength(1 + expectedFallbacks.length);
    }
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

describe("isCerebrasConfigured", () => {
  it("returns true for a non-empty string", () => {
    expect(isCerebrasConfigured("sk-abc123")).toBe(true);
  });

  it("returns false for undefined", () => {
    expect(isCerebrasConfigured(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCerebrasConfigured("")).toBe(false);
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
