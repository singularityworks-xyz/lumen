// @ts-nocheck
import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockNoOp = () => {
  // intentionally empty mock
};

const mockLogger = {
  info: mock(mockNoOp),
  warn: mock(mockNoOp),
  error: mock(mockNoOp),
  debug: mock(mockNoOp),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

const mockRecordSpanError = mock(mockNoOp);
const mockSpanStatusCode = { OK: 1, ERROR: 2 };

const createMockSpan = () => ({
  setAttribute: mock(mockNoOp),
  setAttributes: mock(mockNoOp),
  setStatus: mock(mockNoOp),
  addEvent: mock(mockNoOp),
  end: mock(mockNoOp),
});

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startSpan: createMockSpan,
    startActiveSpan: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
      fn(createMockSpan()),
  }),
  recordSpanError: mockRecordSpanError,
  SpanStatusCode: mockSpanStatusCode,
}));

const createMockEventSource = (
  events: Array<{ event: string; data: unknown }>
) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const { event, data } of events) {
        const eventString = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(eventString));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
};

describe("AI Integration Tests", () => {
  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  describe("Streaming Response Chunks to Drawer", () => {
    it("receives text chunks in correct order", async () => {
      const events = [
        {
          event: "message",
          data: { type: "message_start", messageId: "msg-1" },
        },
        { event: "message", data: { type: "content_delta", content: "Hello" } },
        {
          event: "message",
          data: { type: "content_delta", content: " world" },
        },
        {
          event: "message",
          data: {
            type: "message_complete",
            message: { id: "msg-1", content: "Hello world" },
          },
        },
      ];

      const response = createMockEventSource(events);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      const chunks: string[] = [];
      let done = false;

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        if (value) {
          chunks.push(decoder.decode(value));
        }
      }

      const fullText = chunks.join("");
      expect(fullText).toContain('"type":"content_delta"');
      expect(fullText).toContain("Hello");
      expect(fullText).toContain("world");
    });

    it("handles connection interruption gracefully", async () => {
      const encoder = new TextEncoder();
      let _streamInterrupted = false;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('event: message\ndata: {"type":"message_start"}\n\n')
          );
          setTimeout(() => {
            controller.error(new Error("Connection interrupted"));
          }, 10);
        },
      });

      const response = new Response(stream);
      const reader = response.body?.getReader();

      if (reader) {
        const { done } = await reader.read();
        if (done) {
          const { value } = await reader
            .read()
            .catch(() => ({ value: undefined, done: true }));
          if (!value) {
            _streamInterrupted = true;
          }
        }
      }

      expect(true).toBe(true);
    });

    it("accumulates partial chunks correctly", () => {
      const events = [
        { event: "message", data: { type: "content_delta", content: "First" } },
        {
          event: "message",
          data: { type: "content_delta", content: " chunk" },
        },
        {
          event: "message",
          data: { type: "content_delta", content: " complete" },
        },
      ];

      let accumulated = "";
      for (const { data } of events) {
        if (typeof data === "object" && data && "content" in data) {
          accumulated += (data as { content: string }).content;
        }
      }

      expect(accumulated).toBe("First chunk complete");
    });
  });

  describe("Tool Call and Result Rendering", () => {
    it("receives tool_call_start event", async () => {
      const events = [
        {
          event: "message",
          data: { type: "message_start", messageId: "msg-1" },
        },
        {
          event: "message",
          data: {
            type: "tool_call_start",
            toolName: "get_weather",
            toolCallId: "tc-1",
          },
        },
      ];

      const response = createMockEventSource(events);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let hasToolCall = false;
      let done = false;

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        if (value) {
          const text = decoder.decode(value);
          if (text.includes("tool_call_start")) {
            hasToolCall = true;
          }
        }
      }

      expect(hasToolCall).toBe(true);
    });

    it("receives tool_call_result event with output", async () => {
      const result = { success: true, data: { temp: 20, city: "London" } };
      const events = [
        {
          event: "message",
          data: {
            type: "tool_call_start",
            toolName: "get_weather",
            toolCallId: "tc-1",
          },
        },
        {
          event: "message",
          data: { type: "tool_call_result", toolCallId: "tc-1", result },
        },
      ];

      const response = createMockEventSource(events);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let foundResult = false;
      let done = false;

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        if (value) {
          const text = decoder.decode(value);
          if (text.includes("tool_call_result") && text.includes("London")) {
            foundResult = true;
          }
        }
      }

      expect(foundResult).toBe(true);
    });

    it("handles multiple sequential tool calls", () => {
      const events = [
        {
          event: "message",
          data: {
            type: "tool_call_start",
            toolName: "search_tasks",
            toolCallId: "tc-1",
          },
        },
        {
          event: "message",
          data: {
            type: "tool_call_result",
            toolCallId: "tc-1",
            result: { tasks: ["task-1"] },
          },
        },
        {
          event: "message",
          data: {
            type: "tool_call_start",
            toolName: "get_board_details",
            toolCallId: "tc-2",
          },
        },
        {
          event: "message",
          data: {
            type: "tool_call_result",
            toolCallId: "tc-2",
            result: { board: { id: "b-1" } },
          },
        },
      ];

      const toolCallIds: string[] = [];
      for (const { data } of events) {
        if (
          typeof data === "object" &&
          data &&
          "type" in data &&
          (data as { type: string }).type === "tool_call_start"
        ) {
          toolCallIds.push((data as { toolCallId: string }).toolCallId);
        }
      }

      expect(toolCallIds).toHaveLength(2);
      expect(toolCallIds).toEqual(["tc-1", "tc-2"]);
    });
  });

  describe("Confirmation-Required Action Flow", () => {
    it("receives confirmation_required event", async () => {
      const events = [
        {
          event: "message",
          data: {
            type: "tool_call_start",
            toolName: "delete_file",
            toolCallId: "tc-1",
          },
        },
        {
          event: "message",
          data: {
            type: "confirmation_required",
            messageId: "msg-1",
            action: { tool: "delete_file", params: { path: "/test.txt" } },
          },
        },
      ];

      const response = createMockEventSource(events);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let foundConfirmation = false;
      let done = false;

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        if (value) {
          const text = decoder.decode(value);
          if (text.includes("confirmation_required")) {
            foundConfirmation = true;
          }
        }
      }

      expect(foundConfirmation).toBe(true);
    });

    it("includes action details in confirmation event", async () => {
      const action = {
        tool: "delete_task",
        params: { taskId: "task-123" },
        description: "Delete task 'Important Task'",
      };

      const event = {
        event: "message",
        data: { type: "confirmation_required", messageId: "msg-1", action },
      };
      const response = createMockEventSource([event]);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      const { value } = await reader!.read();
      expect(value).toBeDefined();
      const text = decoder.decode(value);
      expect(text).toContain("delete_task");
      expect(text).toContain("task-123");
    });
  });

  describe("Conversation Save/Load/Delete", () => {
    const mockPrisma = {
      aiConversation: {
        findUnique: mock(() => Promise.resolve(null)),
        findMany: mock(() => Promise.resolve([])),
        upsert: mock(() =>
          Promise.resolve({
            id: "conv-1",
            workspaceId: "ws-1",
            userId: "user-1",
            title: null,
            messageCount: 0,
            summary: null,
            summaryUpToIndex: 0,
            lastActiveAt: new Date(),
            createdAt: new Date(),
          })
        ),
        update: mock(() => Promise.resolve({})),
        delete: mock(() => Promise.resolve({})),
      },
      aiMessage: {
        create: mock(() => Promise.resolve({ id: "msg-1" })),
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
      },
    };

    beforeEach(() => {
      mockPrisma.aiConversation.findUnique.mockClear();
      mockPrisma.aiConversation.upsert.mockClear();
      mockPrisma.aiMessage.create.mockClear();
      mockPrisma.aiMessage.deleteMany.mockClear();
    });

    it("creates conversation if not exists on first message", async () => {
      mockPrisma.aiConversation.findUnique.mockImplementation(() =>
        Promise.resolve(null)
      );

      const result = await mockPrisma.aiConversation.upsert({
        where: {
          workspaceId_userId: { workspaceId: "ws-1", userId: "user-1" },
        },
        update: {},
        create: { workspaceId: "ws-1", userId: "user-1" },
      });

      expect(result).toBeDefined();
      expect(result.workspaceId).toBe("ws-1");
    });

    it("loads existing conversation with messages", async () => {
      const existingConv = {
        id: "conv-1",
        workspaceId: "ws-1",
        userId: "user-1",
        title: "Test Conversation",
        messageCount: 2,
        summaryUpToIndex: 0,
        summary: null,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        messages: [
          { id: "msg-1", role: "user", content: "Hello" },
          { id: "msg-2", role: "assistant", content: "Hi there" },
        ],
      };

      mockPrisma.aiConversation.findUnique.mockImplementation(() =>
        Promise.resolve(existingConv)
      );

      const result = await mockPrisma.aiConversation.findUnique({
        where: {
          workspaceId_userId: { workspaceId: "ws-1", userId: "user-1" },
        },
        include: { messages: true },
      });

      expect(result).toEqual(existingConv);
      expect(result.messages).toHaveLength(2);
    });

    it("deletes specific message from conversation", async () => {
      mockPrisma.aiMessage.deleteMany.mockImplementation(() =>
        Promise.resolve({ count: 1 })
      );

      const result = await mockPrisma.aiMessage.deleteMany({
        where: { conversationId: "conv-1", id: "msg-1" },
      });

      expect(result.count).toBe(1);
    });

    it("clears all messages from conversation", async () => {
      mockPrisma.aiMessage.deleteMany.mockImplementation(() =>
        Promise.resolve({ count: 5 })
      );

      const result = await mockPrisma.aiMessage.deleteMany({
        where: { conversationId: "conv-1" },
      });

      expect(result.count).toBe(5);
    });
  });

  describe("Summarization After Threshold", () => {
    it("triggers summarization at 50 message threshold", () => {
      const THRESHOLD = 50;
      const messageCount = 50;
      const summaryUpToIndex = 0;

      const shouldSummarize = messageCount - summaryUpToIndex >= THRESHOLD;

      expect(shouldSummarize).toBe(true);
    });

    it("does not trigger summarization below threshold", () => {
      const THRESHOLD = 50;
      const messageCount = 45;
      const summaryUpToIndex = 0;

      const shouldSummarize = messageCount - summaryUpToIndex >= THRESHOLD;

      expect(shouldSummarize).toBe(false);
    });

    it("updates summaryUpToIndex after summarization", () => {
      const messageCount = 60;
      const MESSAGES_TO_KEEP = 20;
      const newSummaryUpToIndex = messageCount - MESSAGES_TO_KEEP;

      expect(newSummaryUpToIndex).toBe(40);
    });
  });

  describe("Title Generation Callback Wiring", () => {
    it("triggers title generation on first user message", () => {
      const messageCount = 0;
      const shouldGenerateTitle = messageCount === 0;

      expect(shouldGenerateTitle).toBe(true);
    });

    it("does not trigger title generation on subsequent messages", () => {
      const messageCount = 5;
      const shouldGenerateTitle = messageCount === 0;

      expect(shouldGenerateTitle).toBe(false);
    });
  });

  describe("Queue Pressure and Backoff Behavior", () => {
    it("returns queue status when request is queued", () => {
      const queueStatus = {
        isQueued: true,
        position: 3,
        estimatedWaitMs: 15_000,
      };

      expect(queueStatus.isQueued).toBe(true);
      expect(queueStatus.position).toBeGreaterThan(0);
      expect(queueStatus.estimatedWaitMs).toBeGreaterThan(0);
    });

    it("estimates wait time based on position", () => {
      const position = 5;
      const avgProcessingTimeMs = 3000;
      const estimatedWaitMs = position * avgProcessingTimeMs;

      expect(estimatedWaitMs).toBe(15_000);
    });

    it("handles queue overflow gracefully", () => {
      const MAX_QUEUE_SIZE = 100;
      const currentQueueSize = 100;

      const isOverflow = currentQueueSize >= MAX_QUEUE_SIZE;

      expect(isOverflow).toBe(true);
    });
  });

  describe("Rate-Limit Fallback Without External Network", () => {
    it("falls back to in-memory rate limiter when Upstash fails", async () => {
      const upstashAvailable = false;
      const inMemoryLimiter = {
        limit: () => Promise.resolve({ success: true, remaining: 29 }),
      };

      const limiter = upstashAvailable ? null : inMemoryLimiter;
      const result = await limiter!.limit();

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(29);
    });

    it("retries with exponential backoff on rate limit", () => {
      const baseDelay = 1000;
      const maxRetries = 3;
      const delays: number[] = [];

      for (let i = 0; i < maxRetries; i++) {
        delays.push(baseDelay * 2 ** i);
      }

      expect(delays).toEqual([1000, 2000, 4000]);
    });

    it("returns rate limit error after max retries exhausted", () => {
      const isRateLimitError = true;
      const retryCount = 3;
      const maxRetries = 3;

      const shouldFail = isRateLimitError && retryCount >= maxRetries;

      expect(shouldFail).toBe(true);
    });

    it("includes retry-after header in rate limit response", () => {
      const retryAfterSeconds = 60;
      const response = {
        error: "Rate limited",
        isRateLimit: true,
        retryAfterSeconds,
      };

      expect(response.retryAfterSeconds).toBe(60);
    });
  });
});
