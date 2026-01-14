import type { AiMessage, ContextSnapshot, StreamEvent } from "@lumen/ai/types";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
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
  onClose?: () => void;
};

export type ChatRequest = {
  workspaceId: string;
  message: string;
  context?: ContextSnapshot;
  history?: Array<{ role: "user" | "assistant" | "tool"; content: string }>;
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
