import {
  isRateLimitError as checkRateLimitError,
  DEFAULT_PRIMARY_MODEL,
  FAST_MODEL,
  type GeneralComputeModel,
  getGeneralComputeModel,
  getModelFallbackChain,
} from "@lumen/ai";
import type { LanguageModel } from "ai";
import { env } from "../env";

export function getModel(
  modelName: GeneralComputeModel = DEFAULT_PRIMARY_MODEL
): LanguageModel {
  if (!env.GENERALCOMPUTE_API_KEY) {
    throw new Error("GENERALCOMPUTE_API_KEY is not configured");
  }
  return getGeneralComputeModel(env.GENERALCOMPUTE_API_KEY, modelName);
}

// Fast/cheap model for classification, titles, and summarization
export function getFastModel(): LanguageModel {
  return getModel(FAST_MODEL);
}

export function getModelChain(): GeneralComputeModel[] {
  return getModelFallbackChain(DEFAULT_PRIMARY_MODEL);
}

export function isRateLimitError(error: unknown): boolean {
  return checkRateLimitError(error);
}

export function isAiEnabled(): boolean {
  return !!env.GENERALCOMPUTE_API_KEY;
}
