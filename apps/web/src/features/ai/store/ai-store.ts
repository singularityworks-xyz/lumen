import type {
  AiMessage,
  ContextSnapshot,
  PendingAction,
} from "@lumen/ai/types";
import { addSpanEvent, getTracer } from "@lumen/logger/tracer";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const tracer = getTracer("lumen-ai");

export type WorkspaceAiState = {
  messages: AiMessage[];
  title: string | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamVersion: number;
  lastActiveAt: string;
};

export type AiState = {
  conversations: Record<string, WorkspaceAiState>;
  isDrawerOpen: boolean;
  isOffline: boolean;
  pendingSyncQueue: Array<{
    id: string;
    workspaceId: string;
    content: string;
    context: ContextSnapshot;
    createdAt: string;
    retryCount: number;
  }>;

  currentStreamId: string | null;
};

export type AiActions = {
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  sendMessage: (
    workspaceId: string,
    content: string,
    context: ContextSnapshot
  ) => string;

  appendStreamChunk: (
    workspaceId: string,
    messageId: string,
    chunk: string
  ) => void;

  completeStream: (workspaceId: string, messageId: string) => void;

  setStreamError: (
    workspaceId: string,
    messageId: string,
    error: string
  ) => void;

  addAssistantMessage: (
    workspaceId: string,
    content: string,
    options?: {
      toolCalls?: AiMessage["toolCalls"];
      requiresConfirmation?: boolean;
      pendingAction?: PendingAction;
    }
  ) => string;

  confirmAction: (
    workspaceId: string,
    messageId: string,
    confirmed: boolean
  ) => void;

  clearConversation: (workspaceId: string) => void;
  deleteMessage: (workspaceId: string, messageId: string) => void;

  startStream: (workspaceId: string) => string;
  cancelStream: () => void;

  setOffline: (offline: boolean) => void;
  queueMessageForSync: (
    workspaceId: string,
    content: string,
    context: ContextSnapshot
  ) => void;
  removeFromSyncQueue: (id: string) => void;
  getConversation: (workspaceId: string) => WorkspaceAiState;
  getMessages: (workspaceId: string) => AiMessage[];
  setTitle: (workspaceId: string, title: string) => void;
  loadServerConversation: (
    workspaceId: string,
    messages: AiMessage[],
    title: string | null
  ) => void;
};

export type AiStore = AiState & AiActions;

const createEmptyConversation = (): WorkspaceAiState => ({
  messages: [],
  title: null,
  isStreaming: false,
  streamingMessageId: null,
  streamVersion: 0,
  lastActiveAt: new Date().toISOString(),
});

const initialState: AiState = {
  conversations: {},
  isDrawerOpen: false,
  isOffline: false,
  pendingSyncQueue: [],
  currentStreamId: null,
};

export const useAiStore = create<AiStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      openDrawer: () =>
        set((state) => {
          state.isDrawerOpen = true;
        }),
      closeDrawer: () =>
        set((state) => {
          state.isDrawerOpen = false;
        }),
      toggleDrawer: () =>
        set((state) => {
          state.isDrawerOpen = !state.isDrawerOpen;
        }),

      sendMessage: (workspaceId, content, context) =>
        tracer.startActiveSpan("ai.sendMessage", (span) => {
          const messageId = crypto.randomUUID();
          const now = new Date().toISOString();

          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.message_id": messageId,
            "ai.content_length": content.length,
            "ai.has_context": !!context.currentBoardId,
          });

          const userMessage: AiMessage = {
            id: messageId,
            role: "user",
            content,
            contextSnapshot: context,
            createdAt: now,
          };

          set((state) => {
            if (!state.conversations[workspaceId]) {
              state.conversations[workspaceId] = createEmptyConversation();
            }
            state.conversations[workspaceId].messages.push(userMessage);
            state.conversations[workspaceId].lastActiveAt = now;
          });

          addSpanEvent("message_added", { message_id: messageId });
          span.end();
          return messageId;
        }),

      appendStreamChunk: (workspaceId, messageId, chunk) => {
        set((state) => {
          const conv = state.conversations[workspaceId];
          if (conv) {
            const message = conv.messages.find((m) => m.id === messageId);
            if (message) {
              message.content += chunk;
            }
            // Increment version to force re-renders on each chunk
            conv.streamVersion += 1;
          }
        });
      },

      completeStream: (workspaceId, messageId) => {
        tracer.startActiveSpan("ai.completeStream", (span) => {
          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.message_id": messageId,
          });

          set((state) => {
            const conv = state.conversations[workspaceId];
            if (conv) {
              const message = conv.messages.find((m) => m.id === messageId);
              if (message) {
                message.isStreaming = false;
                span.setAttribute("ai.content_length", message.content.length);
              }
              conv.isStreaming = false;
              conv.streamingMessageId = null;
              state.currentStreamId = null;
            }
          });

          addSpanEvent("stream_completed");
          span.end();
        });
      },

      setStreamError: (workspaceId, messageId, error) => {
        tracer.startActiveSpan("ai.streamError", (span) => {
          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.message_id": messageId,
            "ai.error": error,
          });

          set((state) => {
            const conv = state.conversations[workspaceId];
            if (conv) {
              const message = conv.messages.find((m) => m.id === messageId);
              if (message) {
                message.error = error;
                message.isStreaming = false;
              }
              conv.isStreaming = false;
              conv.streamingMessageId = null;
              conv.streamVersion += 1;
              state.currentStreamId = null;
            }
          });

          span.end();
        });
      },

      addAssistantMessage: (workspaceId, content, options) =>
        tracer.startActiveSpan("ai.addAssistantMessage", (span) => {
          const messageId = crypto.randomUUID();
          const now = new Date().toISOString();

          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.message_id": messageId,
            "ai.has_tool_calls": !!options?.toolCalls,
            "ai.requires_confirmation": !!options?.requiresConfirmation,
          });

          const assistantMessage: AiMessage = {
            id: messageId,
            role: "assistant",
            content,
            toolCalls: options?.toolCalls,
            requiresConfirmation: options?.requiresConfirmation,
            pendingAction: options?.pendingAction,
            isStreaming: true,
            createdAt: now,
          };

          set((state) => {
            if (!state.conversations[workspaceId]) {
              state.conversations[workspaceId] = createEmptyConversation();
            }
            state.conversations[workspaceId].messages.push(assistantMessage);
            state.conversations[workspaceId].isStreaming = true;
            state.conversations[workspaceId].streamingMessageId = messageId;
            state.conversations[workspaceId].lastActiveAt = now;
          });

          addSpanEvent("assistant_message_started", { message_id: messageId });
          span.end();
          return messageId;
        }),

      confirmAction: (workspaceId, messageId, _confirmed) => {
        tracer.startActiveSpan("ai.confirmAction", (span) => {
          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.message_id": messageId,
            "ai.confirmed": _confirmed,
          });

          set((state) => {
            const conv = state.conversations[workspaceId];
            if (conv) {
              const message = conv.messages.find((m) => m.id === messageId);
              if (message?.requiresConfirmation) {
                if (_confirmed) {
                  message.confirmedAt = new Date().toISOString();
                  // The actual action execution will be handled by the hook
                } else {
                  message.confirmedAt = undefined;
                }
              }
            }
          });

          span.end();
        });
      },

      clearConversation: (workspaceId) => {
        tracer.startActiveSpan("ai.clearConversation", (span) => {
          const messageCount =
            get().conversations[workspaceId]?.messages.length ?? 0;
          span.setAttributes({
            "ai.workspace_id": workspaceId,
            "ai.messages_cleared": messageCount,
          });

          set((state) => {
            state.conversations[workspaceId] = createEmptyConversation();
          });

          addSpanEvent("conversation_cleared");
          span.end();
        });
      },

      deleteMessage: (workspaceId, messageId) => {
        set((state) => {
          const conv = state.conversations[workspaceId];
          if (conv) {
            conv.messages = conv.messages.filter((m) => m.id !== messageId);
          }
        });
      },

      // Stream control
      startStream: (workspaceId) => {
        const streamId = crypto.randomUUID();
        set((state) => {
          if (!state.conversations[workspaceId]) {
            state.conversations[workspaceId] = createEmptyConversation();
          }
          state.conversations[workspaceId].isStreaming = true;
          state.currentStreamId = streamId;
        });
        return streamId;
      },

      cancelStream: () => {
        set((state) => {
          if (!state.currentStreamId) {
            return;
          }

          for (const [workspaceId, conv] of Object.entries(
            state.conversations
          )) {
            if (conv.isStreaming && conv.streamingMessageId) {
              const c = state.conversations[workspaceId];
              if (c) {
                const msg = c.messages.find(
                  (m) => m.id === conv.streamingMessageId
                );
                if (msg) {
                  msg.isStreaming = false;
                  msg.content += "\n\n*(Cancelled)*";
                }
                c.isStreaming = false;
                c.streamingMessageId = null;
              }
              break;
            }
          }
          state.currentStreamId = null;
        });
      },

      setOffline: (offline) =>
        set((state) => {
          state.isOffline = offline;
        }),

      queueMessageForSync: (workspaceId, content, context) => {
        set((state) => {
          state.pendingSyncQueue.push({
            id: crypto.randomUUID(),
            workspaceId,
            content,
            context,
            createdAt: new Date().toISOString(),
            retryCount: 0,
          });
        });
      },

      removeFromSyncQueue: (id) => {
        set((state) => {
          state.pendingSyncQueue = state.pendingSyncQueue.filter(
            (m) => m.id !== id
          );
        });
      },

      getConversation: (workspaceId) => {
        const state = get();
        return state.conversations[workspaceId] || createEmptyConversation();
      },

      getMessages: (workspaceId) => {
        const state = get();
        return state.conversations[workspaceId]?.messages || [];
      },

      setTitle: (workspaceId, title) => {
        set((state) => {
          if (!state.conversations[workspaceId]) {
            state.conversations[workspaceId] = createEmptyConversation();
          }
          state.conversations[workspaceId].title = title;
        });
      },

      loadServerConversation: (workspaceId, messages, title) => {
        set((state) => {
          if (!state.conversations[workspaceId]) {
            state.conversations[workspaceId] = createEmptyConversation();
          }
          const conv = state.conversations[workspaceId];
          if (
            conv.messages.length === 0 ||
            messages.length > conv.messages.length
          ) {
            conv.messages = messages;
            conv.title = title;
            conv.lastActiveAt = new Date().toISOString();
          } else if (title && !conv.title) {
            conv.title = title;
          }
        });
      },
    })),
    {
      name: "lumen-ai-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        pendingSyncQueue: state.pendingSyncQueue,
      }),
    }
  )
);
