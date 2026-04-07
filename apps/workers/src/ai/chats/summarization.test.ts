import { beforeEach, describe, expect, it, mock } from "bun:test";

let mockConversation: Record<string, unknown> | null = null;

const mockPrismaTransaction = mock(
  async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
    const tx = {
      aiConversation: {
        update: mock(() => Promise.resolve({})),
      },
      aiMessage: {
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
      },
    };
    await fn(tx);
  }
);

mock.module("@lumen/db", () => ({
  prisma: {
    aiConversation: {
      findUnique: mock(() => Promise.resolve(mockConversation)),
      findMany: mock(() => Promise.resolve([])),
      update: mock(() => Promise.resolve({})),
      deleteMany: mock(() => Promise.resolve({ count: 0 })),
    },
    aiMessage: {
      deleteMany: mock(() => Promise.resolve({ count: 0 })),
    },
    $transaction: mockPrismaTransaction,
  },
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    error: mock(),
    warn: mock(),
    debug: mock(),
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startSpan: () => ({
      setAttribute: mock(),
      setAttributes: mock(),
      setStatus: mock(),
      end: mock(),
    }),
  }),
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

mock.module("../lib/encryption", () => ({
  decryptContent: mock((content: string) => Promise.resolve(content)),
  encryptContent: mock((content: string) => Promise.resolve(content)),
}));

mock.module("../lib/request-queue", () => ({
  aiRequestQueue: {
    enqueue: mock(async (fn: () => Promise<unknown>) => {
      const result = await fn();
      return { result, wasQueued: false };
    }),
  },
}));

mock.module("../providers", () => ({
  getModel: mock(() => ({})),
}));

mock.module("ai", () => ({
  generateText: mock(() => Promise.resolve({ text: "Generated summary text" })),
}));

import {
  cleanupOldConversations,
  needsSummarization,
  summarizeConversation,
} from "./summarization";

beforeEach(() => {
  mockConversation = null;
});

describe("needsSummarization", () => {
  it("returns false when conversation not found", async () => {
    mockConversation = null;
    const result = await needsSummarization("nonexistent");
    expect(result).toBe(false);
  });

  it("returns true when unsummarized messages >= threshold", async () => {
    mockConversation = {
      messageCount: 60,
      summaryUpToIndex: 5,
    };
    const result = await needsSummarization("conv-1");
    expect(result).toBe(true);
  });

  it("returns false when unsummarized messages < threshold", async () => {
    mockConversation = {
      messageCount: 30,
      summaryUpToIndex: 0,
    };
    const result = await needsSummarization("conv-1");
    expect(result).toBe(false);
  });

  it("returns false when all messages already summarized", async () => {
    mockConversation = {
      messageCount: 50,
      summaryUpToIndex: 50,
    };
    const result = await needsSummarization("conv-1");
    expect(result).toBe(false);
  });

  it("returns true when unsummarized messages equals threshold (boundary)", async () => {
    mockConversation = {
      messageCount: 50,
      summaryUpToIndex: 0,
    };
    const result = await needsSummarization("conv-1");
    expect(result).toBe(true);
  });
});

describe("summarizeConversation", () => {
  it("returns success false when conversation not found", async () => {
    mockConversation = null;
    const result = await summarizeConversation("nonexistent");
    expect(result.success).toBe(false);
  });

  it("returns success when no messages to summarize", async () => {
    mockConversation = {
      id: "conv-1",
      messageCount: 5,
      summaryUpToIndex: 0,
      summary: null,
      messages: Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
        createdAt: new Date(),
      })),
    };
    const result = await summarizeConversation("conv-1");
    expect(result.success).toBe(true);
    expect(result.messagesArchived).toBe(0);
  });

  it("returns success with messagesArchived count", async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message content ${i}`,
      createdAt: new Date(),
    }));

    mockConversation = {
      id: "conv-1",
      messageCount: 30,
      summaryUpToIndex: 0,
      summary: null,
      messages,
    };

    const result = await summarizeConversation("conv-1");
    expect(result.success).toBe(true);
    expect(result.messagesArchived).toBe(10); // 30 - 20 (MESSAGES_TO_KEEP)
  });

  it("respects deleteOldMessages option", async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: `msg-${i}`,
      role: "user",
      content: `Message ${i}`,
      createdAt: new Date(),
    }));

    mockConversation = {
      id: "conv-1",
      messageCount: 30,
      summaryUpToIndex: 0,
      summary: null,
      messages,
    };

    const { prisma } = require("@lumen/db");
    prisma.aiMessage.deleteMany.mockClear();

    const result = await summarizeConversation("conv-1", {
      deleteOldMessages: false,
    });
    expect(result.success).toBe(true);
    expect(prisma.aiMessage.deleteMany).not.toHaveBeenCalled();
  });
});

describe("cleanupOldConversations", () => {
  it("returns zero counts when no old conversations", async () => {
    const result = await cleanupOldConversations();
    expect(result.conversationsDeleted).toBe(0);
    expect(result.messagesDeleted).toBe(0);
  });

  it("returns non-zero counts when old conversations exist", async () => {
    const { prisma } = require("@lumen/db");
    prisma.aiConversation.findMany.mockImplementationOnce(() =>
      Promise.resolve([
        {
          id: "conv-1",
          messageCount: 5,
          lastActiveAt: new Date(Date.now() - 100_000),
        },
      ])
    );
    prisma.aiConversation.deleteMany.mockImplementationOnce(() =>
      Promise.resolve({ count: 1 })
    );

    const result = await cleanupOldConversations();
    expect(result.conversationsDeleted).toBe(1);
    expect(result.messagesDeleted).toBe(5);
  });
});
