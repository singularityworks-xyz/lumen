import { beforeEach, describe, expect, it } from "bun:test";
import type { ChatMessage } from "@lumen/yjs-shared";
import { createFreshState } from "@tests/helpers/store-harness";
import type { KanbanStore } from "../types";
import { type ChatMention, createChatSlice } from "./chat-slice";

let state: KanbanStore;
let actions: ReturnType<typeof createChatSlice>;

beforeEach(() => {
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createChatSlice(set, get);
});

describe("initial state", () => {
  it("has empty chat messages byId and allIds", () => {
    expect(state.chatMessages.byId).toEqual({});
    expect(state.chatMessages.allIds).toEqual([]);
  });
});

describe("sendChatMessage", () => {
  it("creates a new chat message with correct data", () => {
    const workspaceId = "test-workspace-1";
    state.currentWorkspaceId = workspaceId;

    const author = { id: "user-1", name: "Test User", image: "avatar.png" };
    const content = "Hello, world!";

    actions.sendChatMessage(content, author);

    const messageId = state.chatMessages.allIds[0];
    expect(messageId).toBeDefined();

    const message = state.chatMessages.byId[messageId!];
    expect(message).toBeDefined();
    expect(message?.content).toBe(content);
    expect(message?.authorId).toBe(author.id);
    expect(message?.authorName).toBe(author.name);
    expect(message?.authorImage).toBe(author.image);
    expect(message?.workspaceId).toBe(workspaceId);
    expect(message?.isEdited).toBeUndefined();
    expect(message?.lastEditedAt).toBeUndefined();
  });

  it("returns early if no current workspace", () => {
    state.currentWorkspaceId = null;

    const author = { id: "user-1", name: "Test User" };
    const content = "Hello!";

    actions.sendChatMessage(content, author);

    expect(state.chatMessages.allIds).toHaveLength(0);
    expect(Object.keys(state.chatMessages.byId)).toHaveLength(0);
  });

  it("returns early if content is empty or whitespace-only", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("", author);
    actions.sendChatMessage("   ", author);
    actions.sendChatMessage("\t\n", author);

    expect(state.chatMessages.allIds).toHaveLength(0);
  });

  it("supports reply options", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const options = {
      replyToId: "original-msg-id",
      replyToContent: "Original message",
      replyToAuthorName: "Other User",
    };

    actions.sendChatMessage("Reply message", author, options);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.replyToId).toBe(options.replyToId);
    expect(message?.replyToContent).toBe(options.replyToContent);
    expect(message?.replyToAuthorName).toBe(options.replyToAuthorName);
  });

  it("supports mentions in message", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const mentions: ChatMention[] = [
      {
        userId: "user-2",
        userName: "Mentioned User",
        startIndex: 0,
        endIndex: 14,
      },
    ];

    actions.sendChatMessage("@Mentioned User hello", author, { mentions });

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.mentions).toEqual(mentions);
  });

  it("appends messages in order", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("First message", author);
    actions.sendChatMessage("Second message", author);
    actions.sendChatMessage("Third message", author);

    expect(state.chatMessages.allIds).toHaveLength(3);

    const messages = state.chatMessages.allIds.map(
      (id) => state.chatMessages.byId[id]?.content
    );
    expect(messages).toEqual([
      "First message",
      "Second message",
      "Third message",
    ]);
  });

  it("generates unique IDs for each message", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      actions.sendChatMessage(`Message ${i}`, author);
      ids.add(state.chatMessages.allIds[i]!);
    }

    expect(ids.size).toBe(10);
  });
});

describe("editChatMessage", () => {
  it("updates message content and marks as edited", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Original content", author);
    const messageId = state.chatMessages.allIds[0]!;

    const beforeEdit = state.chatMessages.byId[messageId]?.updatedAt;

    // Small delay to ensure timestamp changes
    const start = Date.now();
    while (Date.now() - start < 2) {
      // Busy wait for at least 2ms
    }

    actions.editChatMessage(messageId, "Updated content");

    const message = state.chatMessages.byId[messageId!];
    expect(message?.content).toBe("Updated content");
    expect(message?.isEdited).toBe(true);
    expect(message?.lastEditedAt).toBeDefined();
    expect(message?.updatedAt).not.toBe(beforeEdit);
  });

  it("updates mentions when provided", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const originalMentions: ChatMention[] = [
      { userId: "user-2", userName: "Old User", startIndex: 0, endIndex: 8 },
    ];

    actions.sendChatMessage("Hello", author, { mentions: originalMentions });
    const messageId = state.chatMessages.allIds[0]!;

    const newMentions: ChatMention[] = [
      { userId: "user-3", userName: "New User", startIndex: 0, endIndex: 8 },
    ];

    actions.editChatMessage(messageId, "Hello", newMentions);

    const message = state.chatMessages.byId[messageId];
    expect(message?.mentions).toEqual(newMentions);
  });

  it("preserves mentions when not provided", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const mentions: ChatMention[] = [
      { userId: "user-2", userName: "Mentioned", startIndex: 0, endIndex: 9 },
    ];

    actions.sendChatMessage("Hello", author, { mentions });
    const messageId = state.chatMessages.allIds[0]!;

    actions.editChatMessage(messageId, "Updated");

    const message = state.chatMessages.byId[messageId];
    expect(message?.mentions).toEqual(mentions);
  });

  it("does nothing for non-existent message ID", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Original", author);
    const messageId = state.chatMessages.allIds[0]!;

    actions.editChatMessage("non-existent-id", "Updated");

    const message = state.chatMessages.byId[messageId];
    expect(message?.content).toBe("Original");
    expect(message?.isEdited).toBeUndefined();
  });
});

describe("deleteChatMessage", () => {
  it("removes message from byId and allIds", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Message 1", author);
    actions.sendChatMessage("Message 2", author);
    const messageId = state.chatMessages.allIds[0]!;

    actions.deleteChatMessage(messageId);

    expect(state.chatMessages.byId[messageId]).toBeUndefined();
    expect(state.chatMessages.allIds).not.toContain(messageId);
  });

  it("preserves other messages when deleting", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Message 1", author);
    actions.sendChatMessage("Message 2", author);
    actions.sendChatMessage("Message 3", author);

    const middleId = state.chatMessages.allIds[1]!;

    actions.deleteChatMessage(middleId);

    expect(state.chatMessages.allIds).toHaveLength(2);
    expect(state.chatMessages.allIds).not.toContain(middleId);
    expect(
      state.chatMessages.byId[state.chatMessages.allIds[0]!]?.content
    ).toBe("Message 1");
    expect(
      state.chatMessages.byId[state.chatMessages.allIds[1]!]?.content
    ).toBe("Message 3");
  });

  it("handles deletion of non-existent ID gracefully", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Message", author);
    const messageId = state.chatMessages.allIds[0]!;

    actions.deleteChatMessage("non-existent-id");

    expect(state.chatMessages.byId[messageId]).toBeDefined();
    expect(state.chatMessages.allIds).toContain(messageId);
  });
});

describe("getChatMessagesForWorkspace", () => {
  it("returns messages only for specified workspace", () => {
    const workspace1 = "workspace-1";
    const workspace2 = "workspace-2";

    state.currentWorkspaceId = workspace1;
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Workspace 1 message", author);

    state.currentWorkspaceId = workspace2;
    actions.sendChatMessage("Workspace 2 message", author);
    actions.sendChatMessage("Another workspace 2 message", author);

    const workspace1Messages = actions.getChatMessagesForWorkspace(workspace1);
    const workspace2Messages = actions.getChatMessagesForWorkspace(workspace2);

    expect(workspace1Messages).toHaveLength(1);
    expect(workspace1Messages[0]?.content).toBe("Workspace 1 message");

    expect(workspace2Messages).toHaveLength(2);
    expect(workspace2Messages[0]?.content).toBe("Workspace 2 message");
    expect(workspace2Messages[1]?.content).toBe("Another workspace 2 message");
  });

  it("returns empty array for workspace with no messages", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Message", author);

    const emptyMessages = actions.getChatMessagesForWorkspace(
      "non-existent-workspace"
    );
    expect(emptyMessages).toEqual([]);
  });

  it("sorts messages by createdAt ascending", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    // Manually insert messages with specific dates to test sorting
    const now = new Date();
    const messages: ChatMessage[] = [
      {
        id: "msg-2",
        content: "Second",
        authorId: author.id,
        authorName: author.name,
        workspaceId: "workspace-1",
        createdAt: new Date(now.getTime() + 2000).toISOString(),
        updatedAt: new Date(now.getTime() + 2000).toISOString(),
      },
      {
        id: "msg-1",
        content: "First",
        authorId: author.id,
        authorName: author.name,
        workspaceId: "workspace-1",
        createdAt: new Date(now.getTime() + 1000).toISOString(),
        updatedAt: new Date(now.getTime() + 1000).toISOString(),
      },
      {
        id: "msg-3",
        content: "Third",
        authorId: author.id,
        authorName: author.name,
        workspaceId: "workspace-1",
        createdAt: new Date(now.getTime() + 3000).toISOString(),
        updatedAt: new Date(now.getTime() + 3000).toISOString(),
      },
    ];

    // Insert in reverse order
    for (const msg of messages) {
      state.chatMessages.byId[msg.id] = msg;
      state.chatMessages.allIds.push(msg.id);
    }

    const result = actions.getChatMessagesForWorkspace("workspace-1");

    expect(result.map((m) => m.content)).toEqual(["First", "Second", "Third"]);
  });

  it("filters out orphaned allIds references", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Valid message", author);

    // Add an orphaned ID reference
    state.chatMessages.allIds.push("orphaned-id");

    const messages = actions.getChatMessagesForWorkspace("workspace-1");

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("Valid message");
  });

  it("includes all message properties in returned messages", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User", image: "avatar.png" };

    const mentions: ChatMention[] = [
      { userId: "user-2", userName: "Mentioned", startIndex: 0, endIndex: 5 },
    ];

    actions.sendChatMessage("Hello @user", author, {
      replyToId: "original-id",
      replyToContent: "Original",
      replyToAuthorName: "Other User",
      mentions,
    });

    const messages = actions.getChatMessagesForWorkspace("workspace-1");
    const message = messages[0];

    expect(message?.authorImage).toBe("avatar.png");
    expect(message?.replyToId).toBe("original-id");
    expect(message?.replyToContent).toBe("Original");
    expect(message?.replyToAuthorName).toBe("Other User");
    expect(message?.mentions).toEqual(mentions);
  });
});

describe("message data integrity", () => {
  it("maintains correct timestamps", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const beforeSend = new Date().toISOString();
    actions.sendChatMessage("Test message", author);
    const afterSend = new Date().toISOString();

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.createdAt).toBeDefined();
    expect(message?.updatedAt).toBeDefined();
    const createdAt = message?.createdAt!;
    expect(createdAt >= beforeSend || createdAt <= afterSend).toBe(true);
  });

  it("handles messages without optional author image", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" }; // No image

    actions.sendChatMessage("Test", author);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.authorImage).toBeUndefined();
  });

  it("handles messages without reply data", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Test", author);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.replyToId).toBeUndefined();
    expect(message?.replyToContent).toBeUndefined();
    expect(message?.replyToAuthorName).toBeUndefined();
  });

  it("handles messages without mentions", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Test", author);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.mentions).toBeUndefined();
  });
});

describe("edge cases", () => {
  it("handles special characters in message content", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const specialContent = "Hello! 🎉 <script>alert('test')</script> 🌍 émojis";

    actions.sendChatMessage(specialContent, author);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.content).toBe(specialContent);
  });

  it("handles very long message content", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    const longContent = "a".repeat(10_000);

    actions.sendChatMessage(longContent, author);

    const messageId = state.chatMessages.allIds[0]!;
    const message = state.chatMessages.byId[messageId];

    expect(message?.content).toHaveLength(10_000);
  });

  it("handles multiple edits to same message", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    actions.sendChatMessage("Original", author);
    const messageId = state.chatMessages.allIds[0]!;

    actions.editChatMessage(messageId, "Edit 1");
    actions.editChatMessage(messageId, "Edit 2");
    actions.editChatMessage(messageId, "Edit 3");

    const message = state.chatMessages.byId[messageId];
    expect(message?.content).toBe("Edit 3");
    expect(message?.isEdited).toBe(true);
  });

  it("handles rapid consecutive message sends", () => {
    state.currentWorkspaceId = "workspace-1";
    const author = { id: "user-1", name: "Test User" };

    for (let i = 0; i < 100; i++) {
      actions.sendChatMessage(`Message ${i}`, author);
    }

    expect(state.chatMessages.allIds).toHaveLength(100);
    expect(Object.keys(state.chatMessages.byId)).toHaveLength(100);
  });
});
