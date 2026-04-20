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

import { afterAll, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/db", () => ({
  prisma: {
    aiConversation: {
      findUnique: mock(() => null),
      create: mock(() => ({})),
      update: mock(() => ({})),
    },
    aiMessage: { create: mock(() => ({})), findMany: mock(() => []) },
    $transaction: mock((fn: any) =>
      fn({
        aiMessage: {
          create: mock(() => ({})),
          delete: mock(() => ({})),
          deleteMany: mock(() => ({})),
          findUnique: mock(() => null),
        },
        aiConversation: {
          update: mock(() => ({})),
          findUnique: mock(() => null),
        },
      })
    ),
  },
}));

mock.module("../lib/encryption", () => ({
  encryptContent: mock((content: string) => Promise.resolve(content)),
  decryptContent: mock((content: string) => Promise.resolve(content)),
  isEncryptionEnabled: mock(() => false),
}));

mock.module("./title-generator", () => ({
  generateConversationTitle: mock(() => Promise.resolve("Test Title")),
  shouldGenerateTitle: mock(() => false),
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startSpan: () => ({
      setAttribute: mock(() => undefined),
      setAttributes: mock(() => undefined),
      setStatus: mock(() => undefined),
      end: mock(() => undefined),
    }),
  }),
  recordSpanError: mock(() => undefined),
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

import { onTitleGenerated, toApiMessages } from "./conversation-service";

describe("onTitleGenerated", () => {
  it("registers a callback and returns an unsubscribe function", () => {
    const callback = ((_title: string | null) => undefined) as (
      title: string | null
    ) => void;
    const unsubscribe = onTitleGenerated("conv-1", callback);

    expect(typeof unsubscribe).toBe("function");
    // Returns void per type signature
    unsubscribe();
  });

  it("removes callback on unsubscribe", () => {
    const callback = ((_title: string | null) => undefined) as (
      title: string | null
    ) => void;
    const unsubscribe = onTitleGenerated("conv-2", callback);

    // First unsubscribe works
    unsubscribe();
    // Second unsubscribe is safe (no-op)
    unsubscribe();
  });

  it("allows registering different callbacks for different conversation IDs", () => {
    const cb1 = ((_title: string | null) => undefined) as (
      title: string | null
    ) => void;
    const cb2 = ((_title: string | null) => undefined) as (
      title: string | null
    ) => void;

    const unsub1 = onTitleGenerated("conv-a", cb1);
    const unsub2 = onTitleGenerated("conv-b", cb2);

    unsub1();
    unsub2();
  });
});

describe("toApiMessages", () => {
  it("converts DB messages to API format", async () => {
    const dbMessages = [
      {
        id: "msg-1",
        role: "user",
        content: "Hello",
        toolCalls: null,
        toolCallId: null,
        toolName: null,
        contextSnapshot: null,
        requiresConfirmation: false,
        pendingAction: null,
        metadata: null,
        confirmedAt: null,
        createdAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];

    const result = await toApiMessages(dbMessages);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg-1");
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("Hello");
    expect(result[0].createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("handles null confirmedAt", async () => {
    const dbMessages = [
      {
        id: "msg-2",
        role: "assistant",
        content: "Hi there",
        toolCalls: null,
        toolCallId: null,
        toolName: null,
        contextSnapshot: null,
        requiresConfirmation: false,
        pendingAction: null,
        metadata: null,
        confirmedAt: null,
        createdAt: new Date("2025-06-15T12:00:00Z"),
      },
    ];

    const result = await toApiMessages(dbMessages);

    expect(result).toHaveLength(1);
    expect(result[0].confirmedAt).toBeUndefined();
    expect(result[0].role).toBe("assistant");
  });

  it("passes through tool role messages", async () => {
    const dbMessages = [
      {
        id: "msg-3",
        role: "tool",
        content: '{"result": "ok"}',
        toolCalls: null,
        toolCallId: "tc-1",
        toolName: "get_weather",
        contextSnapshot: null,
        requiresConfirmation: false,
        pendingAction: null,
        metadata: null,
        confirmedAt: null,
        createdAt: new Date("2025-03-10T08:30:00Z"),
      },
    ];

    const result = await toApiMessages(dbMessages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("tool");
    expect(result[0].toolCallId).toBe("tc-1");
    expect(result[0].toolName).toBe("get_weather");
    expect(result[0].content).toBe('{"result": "ok"}');
  });

  it("handles empty message array", async () => {
    const result = await toApiMessages([]);
    expect(result).toEqual([]);
  });
});

afterAll(() => {
  mock.restore();
});
