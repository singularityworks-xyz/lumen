import { google } from "@ai-sdk/google";
import { env } from "../env";

export function getModel() {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }
  return google("gemini-3-flash-preview");
}

export function isAiEnabled(): boolean {
  return !!env.GOOGLE_GENERATIVE_AI_API_KEY;
}
