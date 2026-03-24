import { createLogger } from "@lumen/logger";
import type {
  AiSdkMessage,
  HistoryMessage,
  TextPart,
  ToolCallPart,
} from "./types";

const logger = createLogger({ name: "ai:message-builder" });

function parseToolResult(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

export function buildMessagesFromHistory(
  history: HistoryMessage[]
): AiSdkMessage[] {
  const messages: AiSdkMessage[] = [];

  for (const msg of history) {
    if (msg.role === "user") {
      messages.push({
        role: "user",
        content: msg.content,
      });
    } else if (msg.role === "assistant") {
      // Check if toolCalls exists and has valid entries with id and name
      const validToolCalls = msg.toolCalls?.filter((tc) => tc?.id && tc?.name);

      if (validToolCalls && validToolCalls.length > 0) {
        const assistantContent: Array<TextPart | ToolCallPart> = [];

        // Add text content if any
        if (msg.content) {
          assistantContent.push({
            type: "text" as const,
            text: msg.content,
          });
        }

        // Add tool calls
        for (const tc of validToolCalls) {
          assistantContent.push({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments ?? {},
            input: tc.arguments ?? {},
          });
        }

        messages.push({
          role: "assistant",
          content: assistantContent,
        });
      } else {
        // No valid tool calls, just use content
        messages.push({
          role: "assistant",
          content: msg.content,
        });
      }
    } else if (msg.role === "tool") {
      // Tool result message
      if (msg.toolCallId && msg.toolName) {
        // Get the result from toolResult if available, otherwise parse from content
        // (Server stores tool results in content as JSON string)
        const resultValue = msg.toolResult ?? parseToolResult(msg.content);

        messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result" as const,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              output: { type: "json" as const, value: resultValue },
            },
          ],
        });
      } else {
        // Missing toolCallId or toolName - log warning and skip this message
        // This prevents malformed tool messages from corrupting the conversation
        logger.warn(
          {
            role: msg.role,
            hasToolCallId: !!msg.toolCallId,
            hasToolName: !!msg.toolName,
          },
          "Skipping tool message with missing toolCallId or toolName"
        );
      }
    }
  }

  return messages;
}
