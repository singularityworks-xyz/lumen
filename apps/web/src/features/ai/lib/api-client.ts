import { needsTools } from "@lumen/ai/tools";
import type { AiMessage, ContextSnapshot, StreamEvent } from "@lumen/ai/types";
import { createLogger } from "@lumen/logger";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { env } from "@/src/env";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";

const logger = createLogger({ name: "[client] ai/api-client" });
const API_BASE = env.NEXT_PUBLIC_API_URL;

export type ChatStreamCallbacks = {
  onMessageStart?: (messageId: string) => void;
  onContentDelta?: (content: string) => void;
  onToolCallStart?: (toolName: string, toolCallId: string) => void;
  onToolCallResult?: (toolCallId: string, result: unknown) => void;
  onActionInstruction?: (
    toolCallId: string,
    instruction: unknown,
    message: string
  ) => void;
  onConfirmationRequired?: (messageId: string, action: unknown) => void;
  onMessageComplete?: (message: AiMessage) => void;
  onTitleGenerated?: (title: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
};

export type TaskSnapshot = {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "done" | "trash";
  progress: number;
  position: number;
  dueDate?: string;
  tags?: string[];
  assignedTo?: string;
};

export type ColumnSnapshot = {
  id: string;
  name: string;
  description?: string;
  position: number;
  accentColor?: string;
  icon?: string;
  tasks: TaskSnapshot[];
};

export type BoardSnapshot = {
  id: string;
  name: string;
  description?: string;
  accentColor?: string;
  icon?: string;
  columns: ColumnSnapshot[];
};

export type WorkspaceSnapshot = {
  name: string;
  boards: BoardSnapshot[];
};

export function buildWorkspaceSnapshot(
  workspaceId: string
): WorkspaceSnapshot | undefined {
  const state = useKanbanStore.getState();
  const workspace = state.workspaces.byId[workspaceId];

  if (!workspace) {
    return;
  }

  const boards: BoardSnapshot[] = [];

  for (const boardId of workspace.board_ids) {
    const board = state.boards.byId[boardId];
    if (!board) {
      continue;
    }

    const columns: ColumnSnapshot[] = [];

    for (const columnId of board.column_ids) {
      const column = state.columns.byId[columnId];
      if (!column) {
        continue;
      }

      const tasks: TaskSnapshot[] = [];

      for (const taskId of column.task_ids) {
        const task = state.tasks.byId[taskId];
        if (!task) {
          continue;
        }

        tasks.push({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
          position: task.position,
          dueDate: task.due_date,
          tags: task.tags,
          assignedTo: task.assigned_to,
        });
      }

      tasks.sort((a, b) => a.position - b.position);

      columns.push({
        id: column.id,
        name: column.name,
        description: column.description,
        position: column.position,
        accentColor: column.accentColor,
        icon: column.icon,
        tasks,
      });
    }

    columns.sort((a, b) => a.position - b.position);

    boards.push({
      id: board.id,
      name: board.name,
      description: board.description,
      accentColor: board.accentColor,
      icon: board.icon,
      columns,
    });
  }

  return {
    name: workspace.name,
    boards,
  };
}

// Builds workspace snapshot only if the message might need tools.
// This optimizes bandwidth for simple chat messages that don't need workspace context.
export function buildWorkspaceSnapshotIfNeeded(
  workspaceId: string,
  message: string
): WorkspaceSnapshot | undefined {
  // Use AI router to detect if tools might be needed
  if (!needsTools(message)) {
    return;
  }

  return buildWorkspaceSnapshot(workspaceId);
}

export type ChatRequest = {
  workspaceId: string;
  message: string;
  context?: ContextSnapshot;
  workspaceSnapshot?: WorkspaceSnapshot;
  history?: Array<{ role: "user" | "assistant" | "tool"; content: string }>;
  // If true, don't persist conversation to database (for local workspaces)
  ephemeral?: boolean;
};

class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

export function streamChat(
  request: ChatRequest,
  callbacks: ChatStreamCallbacks
): AbortController {
  const controller = new AbortController();

  // Fire and forget - the promise is handled internally via callbacks
  fetchEventSource(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(request),
    signal: controller.signal,

    async onopen(response) {
      // Check for successful SSE response
      if (
        response.ok &&
        response.headers.get("content-type")?.includes(EventStreamContentType)
      ) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          (errorData as { error?: string; message?: string }).error ||
          (errorData as { error?: string; message?: string }).message ||
          `HTTP error ${response.status}`;
        callbacks.onError?.(errorMessage);
        throw new FatalError(errorMessage);
      }

      // Non-SSE response (shouldn't happen, but handle it)
      throw new FatalError("Server did not return an event stream");
    },

    onmessage(event) {
      // Skip done events
      if (event.event === "done" || event.data === "[DONE]") {
        return;
      }

      // Skip empty data
      if (!event.data) {
        return;
      }

      try {
        const data = JSON.parse(event.data) as StreamEvent;
        handleStreamEvent(data, callbacks);
      } catch {
        // Failed to parse SSE data - skip malformed messages
      }
    },

    onclose() {
      // Server closed the connection normally
      callbacks.onClose?.();
    },

    onerror(error) {
      // Don't report abort errors - they're expected when user cancels
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      // Fatal errors should not be retried
      if (error instanceof FatalError) {
        throw error;
      }

      // Report the error to the callback
      callbacks.onError?.(
        error instanceof Error ? error.message : "Stream error"
      );

      // Throw to stop retrying - we don't want automatic retries
      throw error;
    },

    // Keep connection open even when tab is hidden (for long responses)
    openWhenHidden: true,
  }).catch((error) => {
    if (
      error instanceof Error &&
      error.name !== "AbortError" &&
      !(error instanceof FatalError)
    ) {
      callbacks.onError?.(error.message || "Request failed");
    }
  });

  return controller;
}

function handleStreamEvent(
  event: StreamEvent,
  callbacks: ChatStreamCallbacks
): void {
  switch (event.type) {
    case "message_start":
      callbacks.onMessageStart?.(event.messageId);
      break;
    case "content_delta":
      callbacks.onContentDelta?.(event.content);
      break;
    case "tool_call_start":
      callbacks.onToolCallStart?.(event.toolName, event.toolCallId);
      break;
    case "tool_call_result":
      callbacks.onToolCallResult?.(event.toolCallId, event.result);
      break;
    case "action_instruction":
      callbacks.onActionInstruction?.(
        event.toolCallId,
        event.instruction,
        event.message
      );
      break;
    case "confirmation_required":
      callbacks.onConfirmationRequired?.(event.messageId, event.action);
      break;
    case "message_complete":
      callbacks.onMessageComplete?.(event.message);
      break;
    case "title_generated":
      callbacks.onTitleGenerated?.(event.title);
      break;
    case "error":
      callbacks.onError?.(event.error);
      break;
    default:
      // Unknown event type - ignore
      break;
  }
}

export async function checkAiHealth(): Promise<{
  enabled: boolean;
  status: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/ai/health`, {
      credentials: "include",
    });
    if (!response.ok) {
      return { enabled: false, status: "unavailable" };
    }
    return await response.json();
  } catch {
    return { enabled: false, status: "error" };
  }
}

export type ConversationResponse = {
  id: string;
  workspaceId: string;
  title: string | null;
  messageCount: number;
  messages: AiMessage[];
  lastActiveAt: string;
  createdAt: string;
};

export async function fetchConversation(
  workspaceId: string
): Promise<ConversationResponse | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/ai/conversation/${workspaceId}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return null;
      }
      throw new Error(`Failed to fetch conversation: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error({ error }, "Failed to fetch conversation");
    return null;
  }
}

export async function deleteServerMessage(
  workspaceId: string,
  messageId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE}/api/ai/conversation/${workspaceId}/messages/${messageId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    return response.ok;
  } catch (error) {
    logger.error({ error }, "Failed to delete message");
    return false;
  }
}

export async function clearServerConversation(
  workspaceId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE}/api/ai/conversation/${workspaceId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    return response.ok;
  } catch (error) {
    logger.error({ error }, "Failed to clear conversation");
    return false;
  }
}
