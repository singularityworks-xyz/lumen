import type { ChatMessage } from "@lumen/yjs-shared";
import type { KanbanStore } from "../types";

export type ChatMention = {
  userId: string;
  userName: string;
  startIndex: number;
  endIndex: number;
};

export type ChatSlice = {
  chatMessages: {
    byId: Record<string, ChatMessage>;
    allIds: string[];
  };
  sendChatMessage: (
    content: string,
    author: { id: string; name: string; image?: string },
    options?: {
      replyToId?: string;
      replyToContent?: string;
      replyToAuthorName?: string;
      mentions?: ChatMention[];
    }
  ) => void;
  editChatMessage: (
    id: string,
    content: string,
    mentions?: ChatMention[]
  ) => void;
  deleteChatMessage: (id: string) => void;
  getChatMessagesForWorkspace: (workspaceId: string) => ChatMessage[];
};

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => ChatSlice;

export const createChatSlice: SliceCreator = (set, get) => ({
  chatMessages: {
    byId: {},
    allIds: [],
  },

  sendChatMessage: (content, author, options) => {
    const currentState = get();
    if (!currentState.currentWorkspaceId) {
      return;
    }

    const now = new Date().toISOString();
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      authorId: author.id,
      authorName: author.name,
      authorImage: author.image,
      workspaceId: currentState.currentWorkspaceId,
      createdAt: now,
      updatedAt: now,
      replyToId: options?.replyToId,
      replyToContent: options?.replyToContent,
      replyToAuthorName: options?.replyToAuthorName,
      mentions: options?.mentions,
    };

    set((state) => {
      state.chatMessages.byId[newMessage.id] = newMessage;
      state.chatMessages.allIds.push(newMessage.id);
    });
  },

  editChatMessage: (id, content, mentions) => {
    set((state) => {
      const message = state.chatMessages.byId[id];
      if (message) {
        message.content = content;
        message.isEdited = true;
        message.lastEditedAt = new Date().toISOString();
        message.updatedAt = new Date().toISOString();
        if (mentions !== undefined) {
          message.mentions = mentions;
        }
      }
    });
  },

  deleteChatMessage: (id) => {
    set((state) => {
      delete state.chatMessages.byId[id];
      state.chatMessages.allIds = state.chatMessages.allIds.filter(
        (msgId) => msgId !== id
      );
    });
  },

  getChatMessagesForWorkspace: (workspaceId) => {
    const state = get();
    return state.chatMessages.allIds
      .map((id) => state.chatMessages.byId[id])
      .filter((m): m is ChatMessage => !!m && m.workspaceId === workspaceId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  },
});
