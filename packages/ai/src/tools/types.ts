import type { actionTools, allTools, queryTools } from "./definitions";

export type ToolIntent = "none" | "query" | "action" | "both";

export type ToolSelection = {
  intent: ToolIntent;
  tools: typeof allTools | typeof queryTools | typeof actionTools | null;
  reason: string;
};

export type ClassificationResult = {
  intent: ToolIntent;
  confidence: "high" | "medium" | "low";
  reason: string;
  suggestedTools?: string[];
};

export type QueueStatus = {
  position: number;
  estimatedWaitMs: number;
  isQueued: boolean;
};
