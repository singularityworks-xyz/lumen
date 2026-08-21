import type {
  ActionInstructionData,
  PendingAction,
  WorkspaceSnapshot,
} from "@lumen/ai/types";

export interface TextPart {
  text: string;
  type: "text";
}

export interface ToolCallPart {
  args: Record<string, unknown>;
  // NOTE: Despite AI SDK docs saying 'args', openai-compatible provider reads 'input'
  input?: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
  type: "tool-call";
}

export interface ToolResultPart {
  isError?: boolean;
  output: { type: "json"; value: unknown } | { type: "text"; text: string };
  toolCallId: string;
  toolName: string;
  type: "tool-result";
}

export type ContentPart = TextPart | ToolCallPart | ToolResultPart;

export interface AiSdkMessage {
  content: string | ContentPart[];
  role: "user" | "assistant" | "tool";
}

export type StreamResult =
  | {
      type: "chunk";
      chunk: string;
      modelUsed: string;
    }
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
      modelUsed: string;
    }
  | {
      type: "tool_result";
      toolCallId: string;
      output: unknown;
      modelUsed: string;
    }
  | {
      type: "action_instruction";
      toolCallId: string;
      instruction: ActionInstructionData;
      message: string;
      modelUsed: string;
    }
  | {
      type: "confirmation_required";
      messageId: string;
      action: PendingAction;
      modelUsed: string;
    }
  | {
      type: "usage";
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      modelUsed: string;
    };

export interface StreamContext {
  // If true, action tools return instructions instead of executing (for local workspaces)
  ephemeral?: boolean;
  snapshot?: WorkspaceSnapshot;
  userId: string;
  workspaceId: string;
}

export interface StreamOptions {
  ctx: StreamContext;
  messageId: string;
  messages: AiSdkMessage[];
  systemPrompt: string;
  tools: Record<string, unknown> | null;
}

export interface ToolCallInfo {
  input: Record<string, unknown>; // From stream event (uses 'input')
  output?: unknown;
  toolCallId: string;
  toolName: string;
}

export interface HistoryMessage {
  content: string;
  role: "user" | "assistant" | "tool";
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
  toolName?: string;
  toolResult?: unknown;
}
