import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryConversationStore } from "@tests/helpers/in-memory-conversation-store";

// ──────────────────────────────────────────────────────────────
// Integration test: AI conversation persistence
//
// Tests the message → save → fetch → verify round-trip for AI
// conversations. Uses in-memory storage to simulate the
// database layer without requiring a real Prisma connection.
// ──────────────────────────────────────────────────────────────

// ─── Tests ─────────────────────────────────────────────────────

describe("AI-PERSIST: Conversation persistence round-trip", () => {
  let store: InMemoryConversationStore;

  beforeEach(() => {
    store = new InMemoryConversationStore();
  });

  describe("conversation lifecycle", () => {
    it("creates conversation on first message", () => {
      const conv = store.upsert("ws-1", "user-1", "conv-1");
      expect(conv.id).toBe("conv-1");
      expect(conv.workspaceId).toBe("ws-1");
      expect(conv.userId).toBe("user-1");
      expect(conv.messageCount).toBe(0);
      expect(conv.title).toBeNull();
    });

    it("returns existing conversation on duplicate upsert", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      const conv2 = store.upsert("ws-1", "user-1", "conv-1");
      expect(conv2.id).toBe("conv-1");
    });

    it("deletes conversation and all messages", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      store.addMessage("conv-1", {
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      });

      const deleted = store.deleteConversation("conv-1");
      expect(deleted).toBe(true);
      expect(store.getConversation("conv-1")).toBeNull();
    });
  });

  describe("message CRUD round-trip", () => {
    it("adds messages and fetches them back", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      store.addMessage("conv-1", {
        id: "msg-1",
        role: "user",
        content: "What tasks are due today?",
        createdAt: new Date(),
      });
      store.addMessage("conv-1", {
        id: "msg-2",
        role: "assistant",
        content: "You have 3 tasks due today.",
        createdAt: new Date(),
      });

      const messages = store.getMessages("conv-1");
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe("What tasks are due today?");
      expect(messages[1]?.content).toBe("You have 3 tasks due today.");
    });

    it("preserves message order across fetches", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      for (let i = 0; i < 5; i++) {
        store.addMessage("conv-1", {
          id: `msg-${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          createdAt: new Date(),
        });
      }

      const messages = store.getMessages("conv-1");
      expect(messages).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(messages[i]?.content).toBe(`Message ${i}`);
      }
    });

    it("stores tool calls in messages", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      store.addMessage("conv-1", {
        id: "msg-tool",
        role: "assistant",
        content: "I'll create that task for you.",
        toolCalls: [
          {
            id: "tc-1",
            name: "create_task",
            args: { title: "New task", boardId: "board-1" },
          },
        ],
        createdAt: new Date(),
      });

      const messages = store.getMessages("conv-1");
      expect(messages[0]?.toolCalls).toHaveLength(1);
      expect(messages[0]?.toolCalls?.[0]?.name).toBe("create_task");
      expect(messages[0]?.toolCalls?.[0]?.args.title).toBe("New task");
    });

    it("deletes specific message by ID", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      store.addMessage("conv-1", {
        id: "keep-1",
        role: "user",
        content: "Keep me",
        createdAt: new Date(),
      });
      store.addMessage("conv-1", {
        id: "delete-me",
        role: "assistant",
        content: "Delete me",
        createdAt: new Date(),
      });
      store.addMessage("conv-1", {
        id: "keep-2",
        role: "user",
        content: "Keep me too",
        createdAt: new Date(),
      });

      const deleted = store.deleteMessage("conv-1", "delete-me");
      expect(deleted).toBe(true);

      const messages = store.getMessages("conv-1");
      expect(messages).toHaveLength(2);
      expect(messages.find((m) => m.id === "delete-me")).toBeUndefined();
      expect(messages.find((m) => m.id === "keep-1")).toBeDefined();
    });

    it("clears all messages from conversation", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      for (let i = 0; i < 10; i++) {
        store.addMessage("conv-1", {
          id: `msg-${i}`,
          role: "user",
          content: `Msg ${i}`,
          createdAt: new Date(),
        });
      }

      const cleared = store.clearMessages("conv-1");
      expect(cleared).toBe(10);
      expect(store.getMessages("conv-1")).toHaveLength(0);

      const conv = store.getConversation("conv-1");
      expect(conv?.messageCount).toBe(0);
    });
  });

  describe("title generation", () => {
    it("updates title after first user message", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      store.addMessage("conv-1", {
        id: "msg-1",
        role: "user",
        content: "How do I deploy to production?",
        createdAt: new Date(),
      });

      // Simulate title generation callback
      const shouldGenerateTitle =
        store.getConversation("conv-1")?.messageCount === 1;
      expect(shouldGenerateTitle).toBe(true);

      store.updateTitle("conv-1", "Production Deployment Help");

      const conv = store.getConversation("conv-1");
      expect(conv?.title).toBe("Production Deployment Help");
    });

    it("does not regenerate title on subsequent messages", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      store.addMessage("conv-1", {
        id: "msg-1",
        role: "user",
        content: "First",
        createdAt: new Date(),
      });
      store.updateTitle("conv-1", "First Title");

      store.addMessage("conv-1", {
        id: "msg-2",
        role: "user",
        content: "Second",
        createdAt: new Date(),
      });

      const shouldGenerateTitle =
        store.getConversation("conv-1")?.messageCount === 1;
      expect(shouldGenerateTitle).toBe(false);

      // Title should remain unchanged
      expect(store.getConversation("conv-1")?.title).toBe("First Title");
    });
  });

  describe("summarization", () => {
    const THRESHOLD = 50;

    it("triggers summarization when threshold exceeded", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      for (let i = 0; i < 50; i++) {
        store.addMessage("conv-1", {
          id: `msg-${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i}`,
          createdAt: new Date(),
        });
      }

      const conv = store.getConversation("conv-1")!;
      const shouldSummarize =
        conv.messageCount - conv.summaryUpToIndex >= THRESHOLD;
      expect(shouldSummarize).toBe(true);
    });

    it("updates summary and summaryUpToIndex", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      for (let i = 0; i < 50; i++) {
        store.addMessage("conv-1", {
          id: `msg-${i}`,
          role: "user",
          content: `Msg ${i}`,
          createdAt: new Date(),
        });
      }

      const MESSAGES_TO_KEEP = 20;
      const summaryUpToIndex = 50 - MESSAGES_TO_KEEP;
      store.updateSummary(
        "conv-1",
        "User discussed deployment, task management, and bug fixes.",
        summaryUpToIndex
      );

      const conv = store.getConversation("conv-1")!;
      expect(conv.summary).toBe(
        "User discussed deployment, task management, and bug fixes."
      );
      expect(conv.summaryUpToIndex).toBe(30);
    });

    it("does not re-summarize when below threshold after previous summary", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      for (let i = 0; i < 60; i++) {
        store.addMessage("conv-1", {
          id: `msg-${i}`,
          role: "user",
          content: `Msg ${i}`,
          createdAt: new Date(),
        });
      }

      // First summarization at index 40
      store.updateSummary("conv-1", "Summary 1", 40);

      const conv = store.getConversation("conv-1")!;
      // 60 messages - 40 summarized = 20 unsummarized (below threshold)
      const shouldSummarize =
        conv.messageCount - conv.summaryUpToIndex >= THRESHOLD;
      expect(shouldSummarize).toBe(false);
    });
  });

  describe("conversation listing", () => {
    it("lists conversations for specific workspace and user", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      store.upsert("ws-1", "user-1", "conv-2");
      store.upsert("ws-2", "user-1", "conv-3"); // Different workspace
      store.upsert("ws-1", "user-2", "conv-4"); // Different user

      const convs = store.listConversations("ws-1", "user-1");
      expect(convs).toHaveLength(2);
      expect(convs.map((c) => c.id).sort()).toEqual(["conv-1", "conv-2"]);
    });

    it("returns empty array when no conversations exist", () => {
      const convs = store.listConversations("ws-nonexistent", "user-1");
      expect(convs).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("throws when adding message to non-existent conversation", () => {
      expect(() =>
        store.addMessage("conv-nonexistent", {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        })
      ).toThrow("Conversation conv-nonexistent not found");
    });

    it("returns false when deleting non-existent message", () => {
      store.upsert("ws-1", "user-1", "conv-1");
      expect(store.deleteMessage("conv-1", "msg-nonexistent")).toBe(false);
    });

    it("returns false when deleting non-existent conversation", () => {
      expect(store.deleteConversation("conv-nonexistent")).toBe(false);
    });

    it("messageCount stays in sync after all operations", () => {
      store.upsert("ws-1", "user-1", "conv-1");

      store.addMessage("conv-1", {
        id: "m1",
        role: "user",
        content: "1",
        createdAt: new Date(),
      });
      store.addMessage("conv-1", {
        id: "m2",
        role: "user",
        content: "2",
        createdAt: new Date(),
      });
      store.addMessage("conv-1", {
        id: "m3",
        role: "user",
        content: "3",
        createdAt: new Date(),
      });
      expect(store.getConversation("conv-1")?.messageCount).toBe(3);

      store.deleteMessage("conv-1", "m2");
      expect(store.getConversation("conv-1")?.messageCount).toBe(2);

      store.clearMessages("conv-1");
      expect(store.getConversation("conv-1")?.messageCount).toBe(0);
    });
  });
});
