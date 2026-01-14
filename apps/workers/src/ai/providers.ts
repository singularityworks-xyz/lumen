import {
  type CerebrasModel,
  isRateLimitError as checkRateLimitError,
  DEFAULT_PRIMARY_MODEL,
  getCerebrasModel,
  getModelFallbackChain,
} from "@lumen/ai";
import type { LanguageModel } from "ai";
import { env } from "../env";

export function getModel(
  modelName: CerebrasModel = DEFAULT_PRIMARY_MODEL
): LanguageModel {
  if (!env.CEREBRAS_API_KEY) {
    throw new Error("CEREBRAS_API_KEY is not configured");
  }
  return getCerebrasModel(env.CEREBRAS_API_KEY, modelName);
}

export function getModelChain(): CerebrasModel[] {
  return getModelFallbackChain(DEFAULT_PRIMARY_MODEL);
}

export function isRateLimitError(error: unknown): boolean {
  return checkRateLimitError(error);
}

export function isAiEnabled(): boolean {
  return !!env.CEREBRAS_API_KEY;
}
