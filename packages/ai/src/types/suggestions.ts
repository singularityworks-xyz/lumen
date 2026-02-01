export type SuggestionCategory = "workspace" | "board" | "task" | "general";

export interface ContextualSuggestion {
  id: string;
  label: string;
  prompt: string;
  category: SuggestionCategory;
  icon?: string;
}

export const WORKSPACE_SUGGESTIONS: ContextualSuggestion[] = [
  {
    id: "workspace-overview",
    label: "Summarize workspace",
    prompt:
      "Give me an overview of this workspace - how many boards, tasks, and what's the overall progress?",
    category: "workspace",
  },
  {
    id: "workspace-overdue",
    label: "Find overdue tasks",
    prompt: "Show me all overdue tasks across all boards in this workspace",
    category: "workspace",
  },
  {
    id: "workspace-recent",
    label: "Recent activity",
    prompt: "What are the most recent changes in this workspace?",
    category: "workspace",
  },
];

export const BOARD_SUGGESTIONS: ContextualSuggestion[] = [
  {
    id: "board-summary",
    label: "Summarize this board",
    prompt:
      "Summarize the current board - what tasks are in progress, blocked, or completed?",
    category: "board",
  },
  {
    id: "board-blocked",
    label: "Find blocked tasks",
    prompt: "Are there any blocked or stalled tasks on this board?",
    category: "board",
  },
  {
    id: "board-priorities",
    label: "High priority tasks",
    prompt: "What are the high priority tasks on this board?",
    category: "board",
  },
];

export const TASK_SUGGESTIONS: ContextualSuggestion[] = [
  {
    id: "task-details",
    label: "Task details",
    prompt: "Tell me about the selected task(s)",
    category: "task",
  },
  {
    id: "task-similar",
    label: "Find similar tasks",
    prompt: "Find tasks similar to the selected one(s)",
    category: "task",
  },
];

export const GENERAL_SUGGESTIONS: ContextualSuggestion[] = [
  {
    id: "help",
    label: "What can you do?",
    prompt: "What can you help me with in this workspace?",
    category: "general",
  },
  {
    id: "create-task",
    label: "Create a task",
    prompt: "Help me create a new task",
    category: "general",
  },
];

export function getSuggestionsForContext(context: {
  currentBoardId: string | null;
  selectedTaskIds: string[];
}): ContextualSuggestion[] {
  const suggestions: ContextualSuggestion[] = [];

  suggestions.push(...GENERAL_SUGGESTIONS);

  if (!context.currentBoardId && context.selectedTaskIds.length === 0) {
    suggestions.push(...WORKSPACE_SUGGESTIONS);
  }

  if (context.currentBoardId) {
    suggestions.push(...BOARD_SUGGESTIONS);
  }

  if (context.selectedTaskIds.length > 0) {
    suggestions.push(...TASK_SUGGESTIONS);
  }

  return suggestions.slice(0, 4);
}
