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

export interface ChatStreamCallbacks {
  onActionInstruction?: (
    toolCallId: string,
    instruction: unknown,
    message: string
  ) => void;
  onClose?: () => void;
  onConfirmationRequired?: (messageId: string, action: unknown) => void;
  onContentDelta?: (content: string) => void;
  onError?: (error: string) => void;
  onMessageComplete?: (message: AiMessage) => void;
  onMessageStart?: (messageId: string) => void;
  onQueueStatus?: (status: {
    position: number;
    estimatedWaitMs: number;
    isQueued: boolean;
  }) => void;
  onTitleGenerated?: (title: string) => void;
  onToolCallResult?: (toolCallId: string, result: unknown) => void;
  onToolCallStart?: (toolName: string, toolCallId: string) => void;
}

export interface TaskSnapshot {
  assignedTo?: string;
  description?: string;
  dueDate?: string;
  id: string;
  position: number;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "todo" | "done" | "trash";
  tags?: string[];
  title: string;
}

export interface ColumnSnapshot {
  accentColor?: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  position: number;
  tasks: TaskSnapshot[];
}

export interface BoardSnapshot {
  accentColor?: string;
  columns: ColumnSnapshot[];
  description?: string;
  icon?: string;
  id: string;
  name: string;
}

export interface TextBoardSnapshot {
  createdAt?: string;
  description?: string;
  id: string;
  name: string;
  // Plain-text rendering of the TipTap document for AI consumption
  text?: string;
  updatedAt?: string;
}

export interface WorkspaceSnapshot {
  boards: BoardSnapshot[];
  name: string;
  textBoards?: TextBoardSnapshot[];
}

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

  const textBoards: TextBoardSnapshot[] = [];

  for (const textBoardId of workspace.text_board_ids ?? []) {
    const textBoard = state.textBoards.byId[textBoardId];
    if (!textBoard) {
      continue;
    }

    textBoards.push({
      id: textBoard.id,
      name: textBoard.name,
      description: textBoard.description,
      text: textBoard.content ? tiptapJsonToPlainText(textBoard.content) : "",
      createdAt: textBoard.created_at,
      updatedAt: textBoard.updated_at,
    });
  }

  return {
    name: workspace.name,
    boards,
    textBoards,
  };
}

// Extract readable plain text from a serialized TipTap JSON document.
// Falls back to returning the raw string when it is not valid TipTap JSON.
function tiptapJsonToPlainText(content: string): string {
  let doc: {
    content?: Array<{ type: string; content?: unknown; text?: string }>;
  };
  try {
    doc = JSON.parse(content) as typeof doc;
  } catch {
    return content;
  }

  const lines: string[] = [];

  const renderNodes = (
    nodes: Array<{ type: string; content?: unknown; text?: string }> | undefined
  ): string[] => {
    const result: string[] = [];
    for (const node of nodes ?? []) {
      if (node.type === "text") {
        result.push(node.text ?? "");
        continue;
      }
      if (node.type === "paragraph") {
        const text = renderNodes(node.content as typeof nodes).join("");
        result.push(text);
        continue;
      }
      if (node.type === "taskList") {
        for (const item of (node.content as typeof nodes) ?? []) {
          const checked =
            (item as { attrs?: { checked?: boolean } }).attrs?.checked === true;
          const text = renderNodes(
            (item as { content?: unknown }).content as typeof nodes
          ).join("");
          result.push(`- [${checked ? "x" : " "}] ${text}`);
        }
        continue;
      }
      if (node.type === "bulletList" || node.type === "orderedList") {
        for (const item of (node.content as typeof nodes) ?? []) {
          const text = renderNodes(
            (item as { content?: unknown }).content as typeof nodes
          ).join("");
          result.push(`- ${text}`);
        }
        continue;
      }
      if (node.type === "heading") {
        result.push(renderNodes(node.content as typeof nodes).join(""));
        continue;
      }
      if (node.type === "codeBlock") {
        const text = renderNodes(node.content as typeof nodes).join("");
        result.push("```", text, "```");
        continue;
      }
      // Fallback: recurse into any other container node
      result.push(
        ...renderNodes((node as { content?: unknown }).content as typeof nodes)
      );
    }
    return result;
  };

  lines.push(...renderNodes(doc.content));
  return lines.join("\n").trim();
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

export interface ChatRequest {
  assistantMessageId?: string;
  context?: ContextSnapshot;
  // If true, don't persist conversation to database (for local workspaces)
  ephemeral?: boolean;
  guestToken?: string;
  history?: Array<{ role: "user" | "assistant" | "tool"; content: string }>;
  message: string;
  workspaceId: string;
  workspaceSnapshot?: WorkspaceSnapshot;
}

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
  const guestToken = request.guestToken || useKanbanStore.getState().guestToken;
  const isGuestMode = useKanbanStore.getState().isGuestMode;

  // Fire and forget - the promise is handled internally via callbacks
  fetchEventSource(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.assistantMessageId
        ? { "x-assistant-message-id": request.assistantMessageId }
        : {}),
      ...(guestToken ? { "x-guest-token": guestToken } : {}),
    },
    credentials: "include",
    body: JSON.stringify({
      ...request,
      ephemeral: isGuestMode || request.ephemeral,
      guestToken: guestToken || undefined,
    }),
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

export function handleStreamEvent(
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
    case "queue_status":
      callbacks.onQueueStatus?.({
        position: event.position,
        estimatedWaitMs: event.estimatedWaitMs,
        isQueued: event.isQueued,
      });
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

export interface ConversationResponse {
  createdAt: string;
  id: string;
  lastActiveAt: string;
  messageCount: number;
  messages: AiMessage[];
  title: string | null;
  workspaceId: string;
}

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
