import type {
  AiSdkMessage,
  HistoryMessage,
  TextPart,
  ToolCallPart,
} from "./types";

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
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const assistantContent: Array<TextPart | ToolCallPart> = [];

        // Add text content if any
        if (msg.content) {
          assistantContent.push({
            type: "text" as const,
            text: msg.content,
          });
        }

        // Add tool calls
        for (const tc of msg.toolCalls) {
          assistantContent.push({
            type: "tool-call" as const,
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.arguments as Record<string, unknown>,
          });
        }

        messages.push({
          role: "assistant",
          content: assistantContent,
        });
      } else {
        messages.push({
          role: "assistant",
          content: msg.content,
        });
      }
    } else if (msg.role === "tool") {
      // Tool result message
      if (msg.toolCallId && msg.toolName) {
        messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result" as const,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              output: { type: "json" as const, value: msg.toolResult },
            },
          ],
        });
      } else {
        messages.push({
          role: "tool",
          content: msg.content,
        });
      }
    }
  }

  return messages;
}
