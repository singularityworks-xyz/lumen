export type AiMessageRole = "user" | "assistant" | "tool";

export interface ToolCall {
  arguments: Record<string, unknown>;
  id: string;
  name: string;
  result?: unknown;
}

export interface ToolResult {
  error?: string;
  result: unknown;
  toolCallId: string;
}

export interface PendingAction {
  description: string;
  params: Record<string, unknown>;
  tool: string;
}

export interface ContextSnapshot {
  currentBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  viewportCenter: { x: number; y: number };
  viewportZoom: number;
}

export interface AiMessage {
  confirmedAt?: string;
  content: string;
  contextSnapshot?: ContextSnapshot;
  createdAt: string;
  error?: string;
  id: string;
  isStreaming?: boolean;
  metadata?: {
    usage?: {
      tokens?: number;
      totalTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
    duration?: number;
    model?: string;
    classifier?: {
      intent: string;
      confidence: string;
      model: string;
    };
  };
  pendingAction?: PendingAction;
  requiresConfirmation?: boolean;
  role: AiMessageRole;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  toolName?: string;
  toolResult?: unknown;
}

export interface AiConversation {
  createdAt: string;
  id: string;
  lastActiveAt: string;
  messageCount: number;
  messages: AiMessage[];
  summary?: string;
  summaryUpToIndex?: number;
  title?: string;
  updatedAt: string;
  workspaceId: string;
}

export type StreamEventType =
  | "message_start"
  | "content_delta"
  | "tool_call_start"
  | "tool_call_result"
  | "action_instruction"
  | "confirmation_required"
  | "message_complete"
  | "title_generated"
  | "queue_status"
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
  | {
      type: "queue_status";
      position: number;
      estimatedWaitMs: number;
      isQueued: boolean;
    }
  | { type: "error"; error: string };

// Action instruction data returned from server for local workspace execution.
// These instructions are executed client-side because the server can't access local Yjs state.
export interface ActionInstructionData {
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
}

export interface ChatRequest {
  context: ContextSnapshot;
  message: string;
  workspaceId: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
}
