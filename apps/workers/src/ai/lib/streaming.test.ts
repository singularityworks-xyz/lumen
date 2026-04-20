// Set environment variables BEFORE any imports that use env.ts
process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";
process.env.CEREBRAS_API_KEY = "test-cerebras-api-key";

import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startSpan: () => ({
      addEvent: mock(),
      setStatus: mock(),
      setAttribute: mock(),
      end: mock(),
    }),
  }),
  recordSpanError: mock(),
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

const mockGetModel = mock(() => ({}));
const mockGetModelChain = mock(() => ["model-1"]);
const mockIsRateLimitError = mock(() => false);

mock.module("../providers", () => ({
  getModel: mockGetModel,
  getModelChain: mockGetModelChain,
  isRateLimitError: mockIsRateLimitError,
}));

const mockExecuteTool = mock(() =>
  Promise.resolve({ success: true, data: {} })
);

mock.module("../tools/tool-executor", () => ({
  executeTool: mockExecuteTool,
}));

const mockRecordAiError = mock();
const mockRecordModelFallback = mock();
const mockRecordRateLimitHit = mock();

mock.module("./metrics", () => ({
  recordAiError: mockRecordAiError,
  recordModelFallback: mockRecordModelFallback,
  recordRateLimitHit: mockRecordRateLimitHit,
}));

const mockStreamText = mock(() => ({
  fullStream: createMockStream([]),
  usage: Promise.resolve({
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
  }),
}));

mock.module("ai", () => ({
  streamText: mockStreamText,
  ModelMessage: {},
}));

import { streamWithFallback } from "./streaming";
import type { StreamOptions, StreamResult } from "./types";

function makeOpts(overrides: Partial<StreamOptions> = {}): StreamOptions {
  return {
    systemPrompt: "You are a helpful assistant.",
    messageId: "msg_123",
    messages: [{ role: "user", content: "Hello" }],
    tools: null,
    ctx: {
      workspaceId: "ws_1",
      userId: "user_1",
    },
    ...overrides,
  };
}

function createMockStream(
  events: Array<{ type: string; text?: string; [key: string]: unknown }>
): AsyncGenerator {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next() {
          if (index < events.length) {
            return Promise.resolve({ value: events[index++], done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  } as AsyncGenerator;
}

function setMockStream(
  events: Array<{ type: string; text?: string; [key: string]: unknown }>,
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
) {
  mockStreamText.mockImplementation(() => ({
    fullStream: createMockStream(events),
    usage: Promise.resolve(
      usage ?? { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
    ),
  }));
}

beforeEach(() => {
  mockGetModelChain.mockImplementation(() => ["model-1"]);
  mockIsRateLimitError.mockImplementation(() => false);
  mockExecuteTool.mockImplementation(() =>
    Promise.resolve({ success: true, data: {} })
  );
  mockRecordAiError.mockClear();
  mockRecordModelFallback.mockClear();
  mockRecordRateLimitHit.mockClear();
});

describe("streamWithFallback", () => {
  it("yields text chunks correctly", async () => {
    setMockStream([
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " world" },
    ]);

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const chunks = results.filter((r) => r.type === "chunk");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({
      type: "chunk",
      chunk: "Hello",
      modelUsed: "model-1",
    });
    expect(chunks[1]).toEqual({
      type: "chunk",
      chunk: " world",
      modelUsed: "model-1",
    });
  });

  it("returns usage stats at end", async () => {
    setMockStream([{ type: "text-delta", text: "Hi" }]);

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const usageResult = results.find((r) => r.type === "usage");
    expect(usageResult).toBeDefined();
    expect(usageResult).toEqual({
      type: "usage",
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      modelUsed: "model-1",
    });
  });

  it("handles empty model chain (throws 'All models exhausted')", async () => {
    mockGetModelChain.mockImplementation(() => []);

    setMockStream([]);

    await expect(async () => {
      for await (const _result of streamWithFallback(makeOpts())) {
        // consume
      }
    }).toThrow("All models exhausted");
  });

  it("yields tool_call and tool_result for tool invocations", async () => {
    setMockStream([
      {
        type: "tool-call",
        toolCallId: "tc_1",
        toolName: "get_weather",
        input: { city: "London" },
      },
    ]);

    mockExecuteTool.mockImplementation(() =>
      Promise.resolve({ success: true, data: { temp: 20 } })
    );

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const toolCall = results.find((r) => r.type === "tool_call");
    expect(toolCall).toBeDefined();
    expect(toolCall).toEqual({
      type: "tool_call",
      toolCallId: "tc_1",
      toolName: "get_weather",
      input: { city: "London" },
      modelUsed: "model-1",
    });

    const toolResult = results.find((r) => r.type === "tool_result");
    expect(toolResult).toBeDefined();
    expect(toolResult).toEqual({
      type: "tool_result",
      toolCallId: "tc_1",
      output: { success: true, data: { temp: 20 } },
      modelUsed: "model-1",
    });
  });

  it("falls back to next model on rate limit error", async () => {
    mockGetModelChain.mockImplementation(() => ["model-1", "model-2"]);

    let callCount = 0;
    mockStreamText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Rate limited");
      }
      return {
        fullStream: createMockStream([
          { type: "text-delta", text: "Fallback response" },
        ]),
        usage: Promise.resolve({
          inputTokens: 5,
          outputTokens: 3,
          totalTokens: 8,
        }),
      };
    });

    (mockIsRateLimitError as ReturnType<typeof mock>).mockImplementation(
      (error?: unknown) => {
        if (error instanceof Error && error.message === "Rate limited") {
          return true;
        }
        return false;
      }
    );

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const chunks = results.filter((r) => r.type === "chunk");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: "chunk",
      chunk: "Fallback response",
      modelUsed: "model-2",
    });
  });

  it("handles tool execution errors gracefully", async () => {
    setMockStream([
      {
        type: "tool-call",
        toolCallId: "tc_err",
        toolName: "failing_tool",
        input: {},
      },
    ]);

    mockExecuteTool.mockImplementation(() => {
      throw new Error("Tool crash");
    });

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const toolResult = results.find((r) => r.type === "tool_result");
    expect(toolResult).toBeDefined();
    expect(toolResult).toEqual({
      type: "tool_result",
      toolCallId: "tc_err",
      output: {
        success: false,
        error: "Tool crash",
        data: null,
      },
      modelUsed: "model-1",
    });
  });

  it("yields confirmation_required when tool requires confirmation", async () => {
    setMockStream([
      {
        type: "tool-call",
        toolCallId: "tc_confirm",
        toolName: "delete_file",
        input: { path: "/tmp/test.txt" },
      },
    ]);

    mockExecuteTool.mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: {},
        requiresConfirmation: true,
      })
    );

    const results: StreamResult[] = [];
    for await (const result of streamWithFallback(makeOpts())) {
      results.push(result);
    }

    const confirmation = results.find(
      (r) => r.type === "confirmation_required"
    );
    expect(confirmation).toBeDefined();
    expect(confirmation).toEqual({
      type: "confirmation_required",
      messageId: "msg_123",
      action: {
        tool: "delete_file",
        params: { path: "/tmp/test.txt" },
        description: "Confirm delete_file",
      },
      modelUsed: "model-1",
    });
  });

  it("handles non-rate-limit errors by throwing immediately", async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error("API error");
    });

    mockIsRateLimitError.mockImplementation(() => false);

    await expect(async () => {
      for await (const _result of streamWithFallback(makeOpts())) {
        // consume
      }
    }).toThrow("API error");
  });

  it("throws when all models are rate limited", async () => {
    mockGetModelChain.mockImplementation(() => ["model-1", "model-2"]);
    mockIsRateLimitError.mockImplementation(() => true);

    mockStreamText.mockImplementation(() => {
      throw new Error("Rate limited");
    });

    await expect(async () => {
      for await (const _result of streamWithFallback(makeOpts())) {
        // consume
      }
    }).toThrow("Rate limited");
  });
});

afterAll(() => {
  mock.restore();
});
