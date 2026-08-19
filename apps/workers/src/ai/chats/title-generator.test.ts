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

import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(() => undefined),
    warn: mock(() => undefined),
    error: mock(() => undefined),
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startSpan: () => ({
      end: mock(() => undefined),
      setAttribute: mock(() => undefined),
      setAttributes: mock(() => undefined),
      setStatus: mock(() => undefined),
    }),
  }),
  recordSpanError: mock(() => undefined),
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

const mockGenerateText = mock(() => Promise.resolve({ text: "Test Title" }));
const mockGetFastModel = mock(() => ({}));
const mockIsRateLimitError = mock(() => false);

mock.module("ai", () => ({
  generateText: mockGenerateText,
}));

mock.module("../providers", () => ({
  getFastModel: mockGetFastModel,
  isRateLimitError: mockIsRateLimitError,
}));

mock.module("../lib/request-queue", () => ({
  aiRequestQueue: {
    enqueue: mock(async (fn: () => Promise<unknown>) => {
      const result = await fn();
      return {
        result,
        wasQueued: false,
        releaseTokens: mock(() => Promise.resolve()),
      };
    }),
  },
}));

// Use a cache-busting query to get the real implementation
// This bypasses any mocks set up by other test files
const { shouldGenerateTitle, generateConversationTitle } = await import(
  `./title-generator?${Date.now()}`
);

beforeEach(() => {
  mockGenerateText.mockClear();
  mockGetFastModel.mockClear();
  mockIsRateLimitError.mockClear();
  mockGenerateText.mockImplementation(() =>
    Promise.resolve({ text: "Test Title", usage: { totalTokens: 100 } })
  );
  mockGetFastModel.mockImplementation(() => ({}));
});

describe("shouldGenerateTitle", () => {
  it("returns true when messageCount >= 4 and no existing title", () => {
    expect(shouldGenerateTitle(4, false)).toBe(true);
    expect(shouldGenerateTitle(5, false)).toBe(true);
    expect(shouldGenerateTitle(10, false)).toBe(true);
  });

  it("returns false when messageCount < 4", () => {
    expect(shouldGenerateTitle(0, false)).toBe(false);
    expect(shouldGenerateTitle(1, false)).toBe(false);
    expect(shouldGenerateTitle(2, false)).toBe(false);
    expect(shouldGenerateTitle(3, false)).toBe(false);
  });

  it("returns false when has existing title", () => {
    expect(shouldGenerateTitle(4, true)).toBe(false);
    expect(shouldGenerateTitle(10, true)).toBe(false);
    expect(shouldGenerateTitle(0, true)).toBe(false);
  });

  it("handles edge cases", () => {
    expect(shouldGenerateTitle(0, false)).toBe(false);
    expect(shouldGenerateTitle(-1, false)).toBe(false);
    expect(shouldGenerateTitle(4, true)).toBe(false);
    expect(shouldGenerateTitle(100, false)).toBe(true);
  });
});

describe("generateConversationTitle", () => {
  it("returns generated title on success", async () => {
    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toBe("Test Title");
  });

  it("returns null when generated title is empty", async () => {
    mockGenerateText.mockImplementation(() => Promise.resolve({ text: "" }));

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toBeNull();
  });

  it("returns null when generated title is too short", async () => {
    mockGenerateText.mockImplementation(() => Promise.resolve({ text: "A" }));

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toBeNull();
  });

  it("returns null when generated title is too long", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "A".repeat(101) })
    );

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toBeNull();
  });

  it("returns null when generated title is whitespace only", async () => {
    mockGenerateText.mockImplementation(() => Promise.resolve({ text: " " }));

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(result).toBeNull();
  });

  it("formats messages correctly with User and Larity prefixes", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Test Title" })
    );

    await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "Help me" },
        { role: "assistant", content: "Sure" },
      ],
    });

    expect(mockGenerateText).toHaveBeenCalled();
    const callArgs = (mockGenerateText.mock as { calls: unknown[][] })
      .calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArgs.messages[0]?.role).toBe("user");
    expect(callArgs.messages[0]?.content).toContain("User: Hello world");
    expect(callArgs.messages[0]?.content).toContain("Larity: Hi there!");
    expect(callArgs.messages[0]?.content).toContain("User: Help me");
    expect(callArgs.messages[0]?.content).toContain("Larity: Sure");
  });

  it("truncates message content to 500 characters", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Test Title" })
    );

    await generateConversationTitle({
      messages: [
        { role: "user", content: "A".repeat(600) },
        { role: "assistant", content: "B".repeat(600) },
      ],
    });

    const callArgs = (mockGenerateText.mock as { calls: unknown[][] })
      .calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userContent = callArgs.messages[0]?.content;
    expect(userContent).toContain("A".repeat(500));
    expect(userContent).not.toContain("A".repeat(501));
  });

  it("limits conversation to first 6 messages", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Test Title" })
    );

    await generateConversationTitle({
      messages: [
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Message 2" },
        { role: "user", content: "Message 3" },
        { role: "assistant", content: "Message 4" },
        { role: "user", content: "Message 5" },
        { role: "assistant", content: "Message 6" },
        { role: "user", content: "Message 7" },
        { role: "assistant", content: "Message 8" },
      ],
    });

    const callArgs = (mockGenerateText.mock as { calls: unknown[][] })
      .calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const content = callArgs.messages[0]?.content;
    expect(content).toContain("Message 6");
    expect(content).not.toContain("Message 7");
  });

  it("calls getFastModel for title generation", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Test Title", usage: { totalTokens: 100 } })
    );

    await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    expect(mockGetFastModel).toHaveBeenCalledTimes(1);
  });

  it("sets generation options correctly", async () => {
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Test Title" })
    );

    await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    const callArgs = (mockGenerateText.mock as { calls: unknown[][] })
      .calls[0][0] as {
      maxOutputTokens: number;
      temperature: number;
      system: string;
    };
    expect(callArgs.maxOutputTokens).toBe(50);
    expect(callArgs.temperature).toBe(0.3);
    expect(callArgs.system).toContain("title generator");
  });

  it("returns null on non-rate-limit error", async () => {
    mockIsRateLimitError.mockImplementation(() => false);
    mockGenerateText.mockImplementation(() =>
      Promise.reject(new Error("API Error"))
    );

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    expect(result).toBeNull();
  });

  it("retries on rate limit errors and returns null after exhausting retries", async () => {
    mockIsRateLimitError.mockImplementation(() => true);
    mockGenerateText.mockImplementation(() =>
      Promise.reject(new Error("Rate limited"))
    );

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    expect(result).toBeNull();
  });

  it("recovers from rate limit on retry", async () => {
    let callCount = 0;
    mockIsRateLimitError.mockImplementation(() => true);
    mockGenerateText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Rate limited"));
      }
      return Promise.resolve({ text: "Recovered Title" });
    });

    const result = await generateConversationTitle({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    });

    expect(result).toBe("Recovered Title");
  });
});

afterAll(() => {
  mock.restore();
});
