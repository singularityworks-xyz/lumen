export type AiMessageRole = "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
};

export type ToolResult = {
  toolCallId: string;
  result: unknown;
  error?: string;
};

export type PendingAction = {
  tool: string;
  params: Record<string, unknown>;
  description: string;
};

export type ContextSnapshot = {
  currentBoardId: string | null;
  selectedTaskIds: string[];
  selectedBoardIds: string[];
  viewportCenter: { x: number; y: number };
  viewportZoom: number;
};

export type AiMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
  contextSnapshot?: ContextSnapshot;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
  confirmedAt?: string;
  isStreaming?: boolean;
  error?: string;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  workspaceId: string;
  title?: string;
  messages: AiMessage[];
  summary?: string;
  summaryUpToIndex?: number;
  messageCount: number;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
};

export type StreamEventType =
  | "message_start"
  | "content_delta"
  | "tool_call_start"
  | "tool_call_result"
  | "action_instruction"
  | "confirmation_required"
  | "message_complete"
  | "title_generated"
  | "error";

export type StreamEvent =
  | { type: "message_start"; messageId: string }
  | { type: "content_delta"; content: string }
  | { type: "tool_call_start"; toolName: string; toolCallId: string }
  | { type: "tool_call_result"; toolCallId: string; result: unknown }
  | {
      type: "action_instruction";
      toolCallId: string;
      instruction: ActionInstructionData;
      message: string;
    }
  | { type: "confirmation_required"; messageId: string; action: PendingAction }
  | { type: "message_complete"; message: AiMessage }
  | { type: "title_generated"; title: string }
  | { type: "error"; error: string };

// Action instruction data returned from server for local workspace execution.
// These instructions are executed client-side because the server can't access local Yjs state.
export type ActionInstructionData = {
  type:
    | "createTask"
    | "updateTask"
    | "deleteTask"
    | "moveTask"
    | "createBoard"
    | "updateBoard"
    | "deleteBoard"
    | "createColumn"
    | "bulkUpdateTasks"
    | "bulkDeleteTasks";
  [key: string]: unknown;
};

export type ChatRequest = {
  workspaceId: string;
  message: string;
  context: ContextSnapshot;
};

export type ChatResponse = {
  messageId: string;
  conversationId: string;
};
