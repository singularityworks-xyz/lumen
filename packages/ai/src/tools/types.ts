import type { actionTools, allTools, queryTools } from "./definitions";

export type ToolIntent = "none" | "query" | "action" | "both";

export interface ToolSelection {
  intent: ToolIntent;
  tools: typeof allTools | typeof queryTools | typeof actionTools | null;
  reason: string;
}

export interface ClassificationResult {
  intent: ToolIntent;
  confidence: "high" | "medium" | "low";
  reason: string;
  suggestedTools?: string[];
}

export interface QueueStatus {
  position: number;
  estimatedWaitMs: number;
  isQueued: boolean;
}
