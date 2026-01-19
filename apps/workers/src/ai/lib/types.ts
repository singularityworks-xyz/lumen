import type { ActionInstructionData, WorkspaceSnapshot } from "@lumen/ai/types";

export type TextPart = {
  type: "text";
  text: string;
};

export type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export type ToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: { type: "json"; value: unknown };
};

export type ContentPart = TextPart | ToolCallPart | ToolResultPart;

export type AiSdkMessage = {
  role: "user" | "assistant" | "tool";
  content: string | ContentPart[];
};

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
    };

export type StreamContext = {
  workspaceId: string;
  userId: string;
  snapshot?: WorkspaceSnapshot;
  // If true, action tools return instructions instead of executing (for local workspaces)
  ephemeral?: boolean;
};

export type StreamOptions = {
  systemPrompt: string;
  messages: AiSdkMessage[];
  messageId: string;
  tools: Record<string, unknown> | null;
  ctx: StreamContext;
};

export type ToolCallInfo = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
};

export type HistoryMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
};
