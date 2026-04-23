import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock crypto.randomUUID for deterministic test IDs
// We use a module-scoped counter and bind it in beforeEach.
// The mock is applied once and persists, using the mutable counter.
let uuidCounter = 0;
const _originalRandomUUID = crypto.randomUUID.bind(crypto);
crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
  `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`;

afterAll(() => {
  crypto.randomUUID = _originalRandomUUID;
  uuidCounter = 0;
});

// Mock logger and tracer to no-op
mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startActiveSpan: (
      _name: string,
      fn: (span: {
        setAttributes: () => void;
        setAttribute: () => void;
        end: () => void;
      }) => unknown
    ) =>
      fn({
        setAttributes: () => undefined,
        setAttribute: () => undefined,
        end: () => undefined,
      }),
  }),
  addSpanEvent: () => undefined,
}));

import type { AiMessage, ContextSnapshot } from "@lumen/ai/types";
import { useAiStore } from "./ai-store";

const WS_ID = "ws-test-1";

const DEFAULT_CONTEXT: ContextSnapshot = {
  currentBoardId: null,
  selectedBoardIds: [],
  selectedTaskIds: [],
  viewportCenter: { x: 0, y: 0 },
  viewportZoom: 1,
};

function makeMessage(
  overrides: Partial<AiMessage> & { id: string; createdAt: string }
): AiMessage {
  return {
    role: "user",
    content: "Hello",
    ...overrides,
  };
}

beforeEach(() => {
  uuidCounter = 0;
  // Reset store between tests
  useAiStore.setState({
    conversations: {},
    isDrawerOpen: false,
    isOffline: false,
    pendingSyncQueue: [],
    currentStreamId: null,
  });
});

// ─── Drawer ────────────────────────────────────────────────────

describe("drawer actions", () => {
  it("opens drawer", () => {
    useAiStore.getState().openDrawer();
    expect(useAiStore.getState().isDrawerOpen).toBe(true);
  });

  it("closes drawer", () => {
    useAiStore.getState().openDrawer();
    useAiStore.getState().closeDrawer();
    expect(useAiStore.getState().isDrawerOpen).toBe(false);
  });

  it("toggles drawer", () => {
    expect(useAiStore.getState().isDrawerOpen).toBe(false);
    useAiStore.getState().toggleDrawer();
    expect(useAiStore.getState().isDrawerOpen).toBe(true);
    useAiStore.getState().toggleDrawer();
    expect(useAiStore.getState().isDrawerOpen).toBe(false);
  });
});

// ─── sendMessage ───────────────────────────────────────────────

describe("sendMessage", () => {
  it("adds a user message to the conversation", () => {
    const msgId = useAiStore.getState().sendMessage(WS_ID, "Hello AI", {
      ...DEFAULT_CONTEXT,
      currentBoardId: "board-1",
    });

    expect(msgId).toBeDefined();
    expect(typeof msgId).toBe("string");
    const msgs = useAiStore.getState().getMessages(WS_ID);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.role).toBe("user");
    expect(msgs[0]!.content).toBe("Hello AI");
    expect(msgs[0]!.contextSnapshot?.currentBoardId).toBe("board-1");
  });

  it("creates conversation if it doesn't exist", () => {
    useAiStore
      .getState()
      .sendMessage(WS_ID, "New conversation", DEFAULT_CONTEXT);
    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.messages).toHaveLength(1);
  });

  it("appends to existing conversation", () => {
    useAiStore.getState().sendMessage(WS_ID, "First", DEFAULT_CONTEXT);
    useAiStore.getState().sendMessage(WS_ID, "Second", DEFAULT_CONTEXT);
    const msgs = useAiStore.getState().getMessages(WS_ID);
    expect(msgs).toHaveLength(2);
  });
});

// ─── addAssistantMessage ───────────────────────────────────────

describe("addAssistantMessage", () => {
  it("adds an assistant message with streaming flag", () => {
    const msgId = useAiStore
      .getState()
      .addAssistantMessage(WS_ID, "AI response");

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]!.role).toBe("assistant");
    expect(conv.messages[0]!.isStreaming).toBe(true);
    expect(conv.isStreaming).toBe(true);
    expect(conv.streamingMessageId).toBe(msgId);
  });

  it("supports tool calls and confirmation options", () => {
    useAiStore.getState().addAssistantMessage(WS_ID, "Action needed", {
      requiresConfirmation: true,
      pendingAction: {
        tool: "createTask",
        params: {},
        description: "Create a task",
      },
    });

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.requiresConfirmation).toBe(true);
    expect(msg.pendingAction).toBeDefined();
  });
});

// ─── appendStreamChunk ─────────────────────────────────────────

describe("appendStreamChunk", () => {
  it("appends content to a streaming message", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore.getState().appendStreamChunk(WS_ID, msgId, "Hello ");
    useAiStore.getState().appendStreamChunk(WS_ID, msgId, "World");

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.content).toBe("Hello World");
  });

  it("increments stream version on each chunk", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    const v1 = useAiStore.getState().getConversation(WS_ID).streamVersion;
    useAiStore.getState().appendStreamChunk(WS_ID, msgId, "chunk");
    const v2 = useAiStore.getState().getConversation(WS_ID).streamVersion;
    expect(v2).toBeGreaterThan(v1);
  });

  it("no-ops if conversation doesn't exist", () => {
    // Should not throw
    useAiStore.getState().appendStreamChunk("nonexistent", "msg-1", "chunk");
  });
});

// ─── appendToolCall ────────────────────────────────────────────

describe("appendToolCall", () => {
  it("appends a tool call to a message", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore.getState().appendToolCall(WS_ID, msgId, "createTask", "tc-1");

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.toolCalls).toHaveLength(1);
    expect(msg.toolCalls![0]!.name).toBe("createTask");
    expect(msg.toolCalls![0]!.id).toBe("tc-1");
    expect(msg.toolName).toBe("createTask");
    expect(msg.toolCallId).toBe("tc-1");
  });

  it("prevents duplicate tool calls with same id", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore.getState().appendToolCall(WS_ID, msgId, "createTask", "tc-1");
    useAiStore.getState().appendToolCall(WS_ID, msgId, "createTask", "tc-1");

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.toolCalls).toHaveLength(1);
  });
});

// ─── updateToolResult ──────────────────────────────────────────

describe("updateToolResult", () => {
  it("sets result on a matching tool call", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore.getState().appendToolCall(WS_ID, msgId, "createTask", "tc-1");
    useAiStore
      .getState()
      .updateToolResult(WS_ID, msgId, "tc-1", { taskId: "new-task" });

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.toolCalls![0]!.result).toEqual({ taskId: "new-task" });
  });

  it("falls back to legacy toolResult when no matching tool call", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore
      .getState()
      .updateToolResult(WS_ID, msgId, "nonexistent-tc", { data: "fallback" });

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.toolResult).toEqual({ data: "fallback" });
  });
});

// ─── completeStream ────────────────────────────────────────────

describe("completeStream", () => {
  it("marks message and conversation as not streaming", () => {
    const msgId = useAiStore
      .getState()
      .addAssistantMessage(WS_ID, "streaming...");
    useAiStore.getState().completeStream(WS_ID, msgId);

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.isStreaming).toBe(false);

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.isStreaming).toBe(false);
    expect(conv.streamingMessageId).toBeNull();
    expect(conv.isClassifying).toBe(false);
    expect(useAiStore.getState().currentStreamId).toBeNull();
  });

  it("merges finalMessage properties", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "partial");
    useAiStore.getState().completeStream(WS_ID, msgId, {
      content: "full response",
    });

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.content).toBe("full response");
  });
});

// ─── setStreamError ────────────────────────────────────────────

describe("setStreamError", () => {
  it("sets error on the message and stops streaming", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "");
    useAiStore.getState().setStreamError(WS_ID, msgId, "Server error");

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.error).toBe("Server error");
    expect(msg.isStreaming).toBe(false);

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.isStreaming).toBe(false);
    expect(conv.streamingMessageId).toBeNull();
  });
});

// ─── confirmAction / resolveAction / setRequiresConfirmation ───

describe("action confirmation flow", () => {
  it("confirms an action", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "Delete?", {
      requiresConfirmation: true,
      pendingAction: {
        tool: "deleteTask",
        params: { taskId: "t1" },
        description: "Delete task",
      },
    });

    useAiStore.getState().confirmAction(WS_ID, msgId, true);

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.confirmedAt).toBeDefined();
  });

  it("rejects an action", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "Delete?", {
      requiresConfirmation: true,
      pendingAction: {
        tool: "deleteTask",
        params: {},
        description: "Delete task",
      },
    });

    useAiStore.getState().confirmAction(WS_ID, msgId, false);

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.confirmedAt).toBeUndefined();
    expect(msg.requiresConfirmation).toBe(false);
    expect(msg.pendingAction).toBeUndefined();
  });

  it("resolves a pending action", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "Action", {
      requiresConfirmation: true,
      pendingAction: {
        tool: "createTask",
        params: {},
        description: "Create task",
      },
    });

    useAiStore.getState().resolveAction(WS_ID, msgId);

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.pendingAction).toBeUndefined();
    expect(msg.requiresConfirmation).toBe(false);
  });

  it("setRequiresConfirmation sets pending state", () => {
    const msgId = useAiStore.getState().addAssistantMessage(WS_ID, "Result");

    useAiStore.getState().setRequiresConfirmation(WS_ID, msgId, {
      tool: "moveTask",
      params: { taskId: "t1", columnId: "col-2" },
      description: "Move task",
    });

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.requiresConfirmation).toBe(true);
    expect(msg.pendingAction!.tool).toBe("moveTask");
  });
});

// ─── clearConversation ─────────────────────────────────────────

describe("clearConversation", () => {
  it("resets conversation to empty state", () => {
    useAiStore.getState().sendMessage(WS_ID, "Msg 1", DEFAULT_CONTEXT);
    useAiStore.getState().sendMessage(WS_ID, "Msg 2", DEFAULT_CONTEXT);
    expect(useAiStore.getState().getMessages(WS_ID)).toHaveLength(2);

    useAiStore.getState().clearConversation(WS_ID);

    expect(useAiStore.getState().getMessages(WS_ID)).toHaveLength(0);
    expect(useAiStore.getState().getConversation(WS_ID).title).toBeNull();
  });
});

// ─── deleteMessage ─────────────────────────────────────────────

describe("deleteMessage", () => {
  it("removes a specific message", () => {
    const id1 = useAiStore
      .getState()
      .sendMessage(WS_ID, "Keep", DEFAULT_CONTEXT);
    const id2 = useAiStore
      .getState()
      .sendMessage(WS_ID, "Delete", DEFAULT_CONTEXT);

    useAiStore.getState().deleteMessage(WS_ID, id2);

    const msgs = useAiStore.getState().getMessages(WS_ID);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.id).toBe(id1);
  });
});

// ─── startStream / cancelStream ────────────────────────────────

describe("stream control", () => {
  it("startStream returns a unique stream id", () => {
    const streamId = useAiStore.getState().startStream(WS_ID);
    expect(streamId).toBeDefined();
    expect(useAiStore.getState().currentStreamId).toBe(streamId);
    expect(useAiStore.getState().getConversation(WS_ID).isStreaming).toBe(true);
  });

  it("cancelStream appends cancelled marker and resets state", () => {
    useAiStore.getState().startStream(WS_ID);
    const _msgId = useAiStore
      .getState()
      .addAssistantMessage(WS_ID, "Streaming...");

    useAiStore.getState().cancelStream();

    const msg = useAiStore.getState().getMessages(WS_ID)[0]!;
    expect(msg.content).toContain("*(Cancelled)*");
    expect(msg.isStreaming).toBe(false);
    expect(useAiStore.getState().currentStreamId).toBeNull();
  });

  it("cancelStream no-ops when no active stream", () => {
    // Should not throw
    useAiStore.getState().cancelStream();
    expect(useAiStore.getState().currentStreamId).toBeNull();
  });
});

// ─── offline / sync queue ──────────────────────────────────────

describe("offline and sync queue", () => {
  it("setOffline toggles offline state", () => {
    useAiStore.getState().setOffline(true);
    expect(useAiStore.getState().isOffline).toBe(true);
    useAiStore.getState().setOffline(false);
    expect(useAiStore.getState().isOffline).toBe(false);
  });

  it("queueMessageForSync adds to pending queue", () => {
    useAiStore.getState().queueMessageForSync(WS_ID, "Queued msg", {
      ...DEFAULT_CONTEXT,
      currentBoardId: "b1",
    });

    const queue = useAiStore.getState().pendingSyncQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0]!.content).toBe("Queued msg");
    expect(queue[0]!.workspaceId).toBe(WS_ID);
    expect(queue[0]!.retryCount).toBe(0);
  });

  it("removeFromSyncQueue removes by id", () => {
    useAiStore.getState().queueMessageForSync(WS_ID, "Msg", DEFAULT_CONTEXT);
    const id = useAiStore.getState().pendingSyncQueue[0]!.id;

    useAiStore.getState().removeFromSyncQueue(id);

    expect(useAiStore.getState().pendingSyncQueue).toHaveLength(0);
  });
});

// ─── getConversation / getMessages ─────────────────────────────

describe("getConversation / getMessages", () => {
  it("returns empty conversation for unknown workspace", () => {
    const conv = useAiStore.getState().getConversation("unknown");
    expect(conv.messages).toHaveLength(0);
    expect(conv.isStreaming).toBe(false);
  });

  it("returns empty array for unknown workspace messages", () => {
    const msgs = useAiStore.getState().getMessages("unknown");
    expect(msgs).toHaveLength(0);
  });
});

// ─── setTitle / setClassifying ─────────────────────────────────

describe("setTitle / setClassifying", () => {
  it("sets conversation title", () => {
    useAiStore.getState().setTitle(WS_ID, "My Chat");
    expect(useAiStore.getState().getConversation(WS_ID).title).toBe("My Chat");
  });

  it("creates conversation if needed when setting title", () => {
    useAiStore.getState().setTitle("new-ws", "New Chat");
    expect(useAiStore.getState().getConversation("new-ws").title).toBe(
      "New Chat"
    );
  });

  it("sets classifying state", () => {
    useAiStore.getState().setClassifying(WS_ID, true);
    expect(useAiStore.getState().getConversation(WS_ID).isClassifying).toBe(
      true
    );
  });
});

// ─── loadServerConversation (complex merge logic) ──────────────

describe("loadServerConversation", () => {
  it("loads into empty conversation", () => {
    const messages: AiMessage[] = [
      makeMessage({
        id: "m1",
        createdAt: "2024-01-01T00:00:00Z",
        content: "Hello",
      }),
      makeMessage({
        id: "m2",
        createdAt: "2024-01-01T00:01:00Z",
        role: "assistant",
        content: "Hi!",
      }),
    ];

    useAiStore
      .getState()
      .loadServerConversation(WS_ID, messages, "Server Chat", null);

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.messages).toHaveLength(2);
    expect(conv.title).toBe("Server Chat");
  });

  it("prefers incoming when incoming is newer", () => {
    // Seed with old message
    useAiStore.getState().sendMessage(WS_ID, "Old msg", DEFAULT_CONTEXT);
    const _existingMsg = useAiStore.getState().getMessages(WS_ID)[0]!;

    const newerMessages: AiMessage[] = [
      makeMessage({
        id: "new-1",
        createdAt: "2099-01-01T00:00:00Z",
        content: "Newer",
      }),
    ];

    useAiStore
      .getState()
      .loadServerConversation(
        WS_ID,
        newerMessages,
        "New Title",
        "2099-01-01T00:00:00Z"
      );

    const msgs = useAiStore.getState().getMessages(WS_ID);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe("Newer");
    expect(useAiStore.getState().getConversation(WS_ID).title).toBe(
      "New Title"
    );
  });

  it("uses lastActiveAt from server when provided", () => {
    const messages: AiMessage[] = [
      makeMessage({
        id: "m1",
        createdAt: "2024-06-01T00:00:00Z",
        content: "Test",
      }),
    ];

    useAiStore
      .getState()
      .loadServerConversation(WS_ID, messages, null, "2024-06-01T12:00:00Z");

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.lastActiveAt).toBe("2024-06-01T12:00:00Z");
  });

  it("falls back to last message createdAt when lastActiveAt not provided", () => {
    const messages: AiMessage[] = [
      makeMessage({
        id: "m1",
        createdAt: "2024-01-01T00:00:00Z",
        content: "First",
      }),
      makeMessage({
        id: "m2",
        createdAt: "2024-01-01T01:00:00Z",
        content: "Last",
      }),
    ];

    useAiStore
      .getState()
      .loadServerConversation(WS_ID, messages, "Title", null);

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.lastActiveAt).toBe("2024-01-01T01:00:00Z");
  });

  it("does not overwrite existing title when incoming title is null", () => {
    useAiStore.getState().setTitle(WS_ID, "Existing Title");

    const messages: AiMessage[] = [
      makeMessage({
        id: "m1",
        createdAt: "2099-01-01T00:00:00Z",
        content: "Msg",
      }),
    ];

    useAiStore.getState().loadServerConversation(WS_ID, messages, null, null);

    expect(useAiStore.getState().getConversation(WS_ID).title).toBe(
      "Existing Title"
    );
  });

  it("handles empty incoming messages", () => {
    useAiStore.getState().loadServerConversation(WS_ID, [], "Empty Chat", null);

    const conv = useAiStore.getState().getConversation(WS_ID);
    expect(conv.messages).toHaveLength(0);
    expect(conv.title).toBe("Empty Chat");
  });
});
