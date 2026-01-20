import { actionTools, allTools, queryTools } from "./definitions";
import {
  type ClassificationResult,
  classifyToolIntentSync,
  classifyToolIntent as llmClassifyToolIntent,
  type QueueStatus,
} from "./tool-classifier";
import type { ToolSelection } from "./types";

// biome-ignore lint/performance/noBarrelFile: Re-export queue stats function
export { getClassifierQueueStats } from "./tool-classifier";
// Re-export types from shared types
export type {
  ClassificationResult,
  QueueStatus,
  ToolIntent,
  ToolSelection,
} from "./types";

const ACTION_KEYWORDS = [
  "create",
  "add",
  "new",
  "make",
  "update",
  "edit",
  "change",
  "modify",
  "set",
  "rename",
  "delete",
  "remove",
  "clear",
  "move",
  "transfer",
  "bulk",
  "all",
  "multiple",
];

const QUERY_KEYWORDS = [
  "show",
  "list",
  "get",
  "find",
  "search",
  "what",
  "which",
  "how many",
  "overview",
  "summary",
  "details",
  "info",
  "status",
  "recent",
  "activity",
  "changes",
  "name",
  "workspace",
  "tell",
  "give",
];

const BOARD_KEYWORDS = ["board", "boards", "kanban"];
const TASK_KEYWORDS = [
  "task",
  "tasks",
  "item",
  "items",
  "card",
  "cards",
  "todo",
  "todos",
];
const COLUMN_KEYWORDS = ["column", "columns", "lane", "lanes", "list", "lists"];

// Analyzes message to determine if tools are needed
export function detectToolIntent(message: string): ToolSelection {
  const lower = message.toLowerCase();

  // Helper function to check if message contains keyword with word boundaries
  const hasKeyword = (keywords: string[]) =>
    keywords.some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(lower);
    });

  const hasActionKeyword = hasKeyword(ACTION_KEYWORDS);
  const hasQueryKeyword = hasKeyword(QUERY_KEYWORDS);
  const hasEntityKeyword = hasKeyword([
    ...BOARD_KEYWORDS,
    ...TASK_KEYWORDS,
    ...COLUMN_KEYWORDS,
  ]);

  // No entity keywords = probably just chat, no tools needed
  if (!(hasEntityKeyword || hasActionKeyword || hasQueryKeyword)) {
    return {
      intent: "none",
      tools: null,
      reason: "No workspace-related keywords detected",
    };
  }

  // Action keywords with entity = action tools
  if (hasActionKeyword && hasEntityKeyword) {
    // Check for destructive intent
    const isDestructive = hasKeyword(["delete", "remove", "clear"]);

    if (isDestructive) {
      return {
        intent: "both",
        tools: allTools,
        reason: "Destructive action detected",
      };
    }

    return {
      intent: "action",
      tools: actionTools,
      reason: "Action intent with workspace entity",
    };
  }

  // Query keywords with entity = query tools
  if (hasQueryKeyword && hasEntityKeyword) {
    return {
      intent: "query",
      tools: queryTools,
      reason: "Query intent with workspace entity",
    };
  }

  // Entity keywords alone = might need both
  if (hasEntityKeyword) {
    return {
      intent: "both",
      tools: allTools,
      reason: "Workspace entity mentioned, unclear intent",
    };
  }

  // Action keywords without entity = might be general action
  if (hasActionKeyword) {
    return {
      intent: "both",
      tools: allTools,
      reason: "Action keyword detected",
    };
  }

  // Query keywords without entity = might be general query
  if (hasQueryKeyword) {
    return {
      intent: "query",
      tools: queryTools,
      reason: "Query keyword detected",
    };
  }

  return {
    intent: "none",
    tools: null,
    reason: "No tool intent detected",
  };
}

// Returns tools based on selection, or null if none needed
export function getToolsForMessage(message: string) {
  const selection = detectToolIntent(message);
  return selection.tools;
}

// Check if message likely needs tools
export function needsTools(message: string): boolean {
  const selection = detectToolIntent(message);
  return selection.intent !== "none";
}

// Async tool selection using LLM classifier with keyword fallback.
// This is the recommended way to select tools for a message.
export async function getToolsForMessageAsync(
  message: string,
  apiKey: string
): Promise<{
  tools: typeof allTools | typeof queryTools | typeof actionTools | null;
  classification: ClassificationResult;
  queueStatus: QueueStatus;
}> {
  const { selection, classification, queueStatus } =
    await llmClassifyToolIntent(message, apiKey);
  return {
    tools: selection.tools,
    classification,
    queueStatus,
  };
}

// Sync tool selection using keyword matching only.
// Use this as a fallback when LLM classification is not available.
export function getToolsForMessageSync(message: string) {
  return classifyToolIntentSync(message).tools;
}
