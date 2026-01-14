import type { AiMessage, ContextSnapshot, StreamEvent } from "@lumen/ai/types";
import { env } from "@/src/env";

const API_BASE = env.NEXT_PUBLIC_API_URL;

export type ChatStreamCallbacks = {
  onMessageStart?: (messageId: string) => void;
  onContentDelta?: (content: string) => void;
  onToolCallStart?: (toolName: string, toolCallId: string) => void;
  onToolCallResult?: (toolCallId: string, result: unknown) => void;
  onConfirmationRequired?: (messageId: string, action: unknown) => void;
  onMessageComplete?: (message: AiMessage) => void;
  onError?: (error: string) => void;
};

export type ChatRequest = {
  workspaceId: string;
  message: string;
  context?: ContextSnapshot;
  history?: Array<{ role: "user" | "assistant" | "tool"; content: string }>;
};

export async function streamChat(
  request: ChatRequest,
  callbacks: ChatStreamCallbacks
): Promise<AbortController> {
  const controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || errorData.message || `HTTP error ${response.status}`;
      callbacks.onError?.(errorMessage);
      return controller;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.("No response body");
      return controller;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // SSE messages are separated by double newlines
          const messages = buffer.split("\n\n");
          // Keep the last incomplete message in the buffer
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (!message.trim()) {
              continue;
            }

            // Parse SSE format: can have event:, data:, id: lines
            const lines = message.split("\n");
            let eventType = "message";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                eventData = line.slice(5).trim();
              }
            }

            if (!eventData) {
              continue;
            }

            // Handle done event
            if (eventType === "done" || eventData === "[DONE]") {
              continue;
            }

            try {
              const data = JSON.parse(eventData) as StreamEvent;
              handleStreamEvent(data, callbacks);
            } catch {
              // Failed to parse SSE data - skip
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Stream was cancelled, this is expected
          return;
        }
        callbacks.onError?.(
          error instanceof Error ? error.message : "Stream error"
        );
      }
    };

    // Start processing without awaiting (fire and forget)
    processStream();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Request was cancelled, this is expected
      return controller;
    }
    callbacks.onError?.(
      error instanceof Error ? error.message : "Request failed"
    );
  }

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
    case "confirmation_required":
      callbacks.onConfirmationRequired?.(event.messageId, event.action);
      break;
    case "message_complete":
      callbacks.onMessageComplete?.(event.message);
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
