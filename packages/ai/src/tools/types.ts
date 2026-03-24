import type { actionTools, allTools, queryTools } from "./definitions";

export type ToolIntent = "none" | "query" | "action" | "both";

export interface ToolSelection {
  intent: ToolIntent;
  reason: string;
  tools: typeof allTools | typeof queryTools | typeof actionTools | null;
}

export interface ClassificationResult {
  confidence: "high" | "medium" | "low";
  intent: ToolIntent;
  reason: string;
  suggestedTools?: string[];
}

export interface QueueStatus {
  estimatedWaitMs: number;
  isQueued: boolean;
  position: number;
}
