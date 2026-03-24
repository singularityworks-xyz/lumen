import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type CerebrasModel =
  | "gpt-oss-120b"
  | "llama-3.3-70b"
  | "llama3.1-8b"
  | "qwen-3-32b";

export const DEFAULT_PRIMARY_MODEL: CerebrasModel = "gpt-oss-120b";

export const FALLBACK_MODELS: CerebrasModel[] = [
  "llama-3.3-70b",
  "qwen-3-32b",
  "llama3.1-8b",
];

export function getModelFallbackChain(
  primary: CerebrasModel = DEFAULT_PRIMARY_MODEL
): CerebrasModel[] {
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

export interface CerebrasProviderOptions {
  apiKey: string;
}

export function createCerebrasProvider(options: CerebrasProviderOptions) {
  const provider = createOpenAICompatible({
    name: "cerebras",
    apiKey: options.apiKey,
    baseURL: "https://api.cerebras.ai/v1",
  });

  return provider;
}

export function getCerebrasModel(
  apiKey: string,
  model: CerebrasModel = DEFAULT_PRIMARY_MODEL
): LanguageModel {
  const provider = createCerebrasProvider({ apiKey });
  return provider.chatModel(model);
}

export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted")
  );
}

export function isCerebrasConfigured(apiKey: string | undefined): boolean {
  return !!apiKey && apiKey.length > 0;
}

export interface JsonSchema {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  additionalProperties?: false;
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
}

export interface StructuredOutputFormat {
  json_schema: {
    name: string;
    strict: boolean;
    schema: JsonSchema;
  };
  type: "json_schema";
}

export function createJsonSchemaFormat(
  name: string,
  schema: JsonSchema,
  strict = true
): StructuredOutputFormat {
  return {
    type: "json_schema",
    json_schema: {
      name,
      strict,
      schema,
    },
  };
}

export function createJsonModeFormat(): { type: "json_object" } {
  return { type: "json_object" };
}
