import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type GeneralComputeModel =
  | "minimax-m2.7"
  | "deepseek-v3.2"
  | "deepseek-v3.1"
  | "gpt-oss-120b";

export const DEFAULT_PRIMARY_MODEL: GeneralComputeModel = "deepseek-v3.2";

// Fast/cheap model for classification, titles, and summarization
export const FAST_MODEL: GeneralComputeModel = "deepseek-v3.1";

export const FALLBACK_MODELS: GeneralComputeModel[] = [
  "gpt-oss-120b",
  "deepseek-v3.1",
  "minimax-m2.7",
];

export function getModelFallbackChain(
  primary: GeneralComputeModel = DEFAULT_PRIMARY_MODEL
): GeneralComputeModel[] {
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

export interface GeneralComputeProviderOptions {
  apiKey: string;
}

export function createGeneralComputeProvider(
  options: GeneralComputeProviderOptions
) {
  const provider = createOpenAICompatible({
    name: "generalcompute",
    apiKey: options.apiKey,
    baseURL: "https://api.generalcompute.com/v1",
  });

  return provider;
}

export function getGeneralComputeModel(
  apiKey: string,
  model: GeneralComputeModel = DEFAULT_PRIMARY_MODEL
): LanguageModel {
  const provider = createGeneralComputeProvider({ apiKey });
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

export function isGeneralComputeConfigured(
  apiKey: string | undefined
): boolean {
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
