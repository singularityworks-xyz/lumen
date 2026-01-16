import { type actionTools, allTools, queryTools } from "./definitions";

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

export type ToolIntent = "none" | "query" | "action" | "both";

export type ToolSelection = {
  intent: ToolIntent;
  tools: typeof allTools | typeof queryTools | typeof actionTools | null;
  reason: string;
};

// Analyzes message to determine if tools are needed
export function detectToolIntent(message: string): ToolSelection {
  const lower = message.toLowerCase();

  const hasActionKeyword = ACTION_KEYWORDS.some((k) => lower.includes(k));
  const hasQueryKeyword = QUERY_KEYWORDS.some((k) => lower.includes(k));
  const hasEntityKeyword = [
    ...BOARD_KEYWORDS,
    ...TASK_KEYWORDS,
    ...COLUMN_KEYWORDS,
  ].some((k) => lower.includes(k));

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
    const isDestructive = ["delete", "remove", "clear"].some((k) =>
      lower.includes(k)
    );

    if (isDestructive) {
      return {
        intent: "both",
        tools: allTools,
        reason: "Destructive action detected",
      };
    }

    return {
      intent: "both",
      tools: allTools,
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
