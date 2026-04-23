import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock env
mock.module("@/src/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "http://localhost:3002" },
}));

// Mock logger
mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

// Mutable mock state for the kanban store
let mockKanbanState: Record<string, unknown> = {
  workspaces: { byId: {}, allIds: [] },
  boards: { byId: {}, allIds: [] },
  columns: { byId: {}, allIds: [] },
  tasks: { byId: {}, allIds: [] },
  boardPositions: { byId: {}, allIds: [] },
  boardConnections: { byId: {}, allIds: [] },
  areas: { byId: {}, allIds: [] },
  areaPositions: { byId: {}, allIds: [] },
  comments: { byId: {}, allIds: [] },
  chatMessages: { byId: {}, allIds: [] },
};

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: {
    getState: () => mockKanbanState,
  },
}));

// Import after all mocks
import type { ChatStreamCallbacks } from "./api-client";
import { buildWorkspaceSnapshot, handleStreamEvent } from "./api-client";

describe("handleStreamEvent", () => {
  it("dispatches message_start event", () => {
    let receivedId: string | null = null;
    const callbacks: ChatStreamCallbacks = {
      onMessageStart: (id) => {
        receivedId = id;
      },
    };

    handleStreamEvent({ type: "message_start", messageId: "msg-1" }, callbacks);
    expect(receivedId).not.toBeNull();
    expect(receivedId!).toBe("msg-1");
  });

  it("dispatches content_delta event", () => {
    let received = "";
    const callbacks: ChatStreamCallbacks = {
      onContentDelta: (content) => {
        received = content;
      },
    };

    handleStreamEvent({ type: "content_delta", content: "Hello" }, callbacks);
    expect(received).toBe("Hello");
  });

  it("dispatches tool_call_start event", () => {
    let toolName = "";
    let toolCallId = "";
    const callbacks: ChatStreamCallbacks = {
      onToolCallStart: (name, id) => {
        toolName = name;
        toolCallId = id;
      },
    };

    handleStreamEvent(
      { type: "tool_call_start", toolName: "createTask", toolCallId: "tc-1" },
      callbacks
    );
    expect(toolName).toBe("createTask");
    expect(toolCallId).toBe("tc-1");
  });

  it("dispatches tool_call_result event", () => {
    let result: unknown = null;
    const callbacks: ChatStreamCallbacks = {
      onToolCallResult: (_id, r) => {
        result = r;
      },
    };

    handleStreamEvent(
      {
        type: "tool_call_result",
        toolCallId: "tc-1",
        result: { taskId: "new-task" },
      },
      callbacks
    );
    expect(result).toEqual({ taskId: "new-task" });
  });

  it("dispatches confirmation_required event", () => {
    let msgId = "";
    let action: unknown = null;
    const callbacks: ChatStreamCallbacks = {
      onConfirmationRequired: (id, a) => {
        msgId = id;
        action = a;
      },
    };

    handleStreamEvent(
      {
        type: "confirmation_required",
        messageId: "msg-1",
        action: { tool: "deleteTask", params: {}, description: "Delete task" },
      },
      callbacks
    );
    expect(msgId).toBe("msg-1");
    expect(action).toEqual({
      tool: "deleteTask",
      params: {},
      description: "Delete task",
    });
  });

  it("dispatches message_complete event", () => {
    let receivedMessage: unknown = null;
    const callbacks: ChatStreamCallbacks = {
      onMessageComplete: (message) => {
        receivedMessage = message;
      },
    };

    handleStreamEvent(
      {
        type: "message_complete",
        message: {
          id: "msg-1",
          content: "Done",
          createdAt: "2024-01-01T00:00:00Z",
          role: "assistant",
        },
      },
      callbacks
    );
    expect(receivedMessage).toEqual({
      id: "msg-1",
      content: "Done",
      createdAt: "2024-01-01T00:00:00Z",
      role: "assistant",
    });
  });

  it("dispatches title_generated event", () => {
    let title = "";
    const callbacks: ChatStreamCallbacks = {
      onTitleGenerated: (t) => {
        title = t;
      },
    };

    handleStreamEvent({ type: "title_generated", title: "My Chat" }, callbacks);
    expect(title).toBe("My Chat");
  });

  it("dispatches queue_status event", () => {
    let status: {
      position: number;
      estimatedWaitMs: number;
      isQueued: boolean;
    } | null = null;
    const callbacks: ChatStreamCallbacks = {
      onQueueStatus: (s) => {
        status = s;
      },
    };

    handleStreamEvent(
      {
        type: "queue_status",
        position: 3,
        estimatedWaitMs: 5000,
        isQueued: true,
      },
      callbacks
    );
    expect(status).not.toBeNull();
    expect(status!.position).toBe(3);
    expect(status!.estimatedWaitMs).toBe(5000);
    expect(status!.isQueued).toBe(true);
  });

  it("dispatches error event", () => {
    let error = "";
    const callbacks: ChatStreamCallbacks = {
      onError: (e) => {
        error = e;
      },
    };

    handleStreamEvent({ type: "error", error: "Server error" }, callbacks);
    expect(error).toBe("Server error");
  });

  it("dispatches action_instruction event", () => {
    let toolCallId = "";
    let instruction: unknown = null;
    let message = "";
    const callbacks: ChatStreamCallbacks = {
      onActionInstruction: (id, inst, msg) => {
        toolCallId = id;
        instruction = inst;
        message = msg;
      },
    };

    handleStreamEvent(
      {
        type: "action_instruction",
        toolCallId: "tc-1",
        instruction: { type: "createTask", title: "New Task" },
        message: "Creating task...",
      },
      callbacks
    );
    expect(toolCallId).toBe("tc-1");
    expect(instruction).toEqual({ type: "createTask", title: "New Task" });
    expect(message).toBe("Creating task...");
  });

  it("ignores unknown event types", () => {
    const callbacks: ChatStreamCallbacks = {};
    // Should not throw
    handleStreamEvent(
      { type: "unknown_event" } as unknown as Parameters<
        typeof handleStreamEvent
      >[0],
      callbacks
    );
  });
});

// ─── buildWorkspaceSnapshot ────────────────────────────────────
// We test this by mocking the kanban store

describe("buildWorkspaceSnapshot logic", () => {
  beforeEach(() => {
    mockKanbanState = {
      workspaces: { byId: {}, allIds: [] },
      boards: { byId: {}, allIds: [] },
      columns: { byId: {}, allIds: [] },
      tasks: { byId: {}, allIds: [] },
      boardPositions: { byId: {}, allIds: [] },
      boardConnections: { byId: {}, allIds: [] },
      areas: { byId: {}, allIds: [] },
      areaPositions: { byId: {}, allIds: [] },
      comments: { byId: {}, allIds: [] },
      chatMessages: { byId: {}, allIds: [] },
    };
  });

  it("builds correct snapshot structure from store state", () => {
    mockKanbanState = {
      workspaces: {
        byId: {
          "ws-1": {
            id: "ws-1",
            name: "Test Workspace",
            board_ids: ["board-1"],
          },
        },
        allIds: ["ws-1"],
      },
      boards: {
        byId: {
          "board-1": {
            id: "board-1",
            name: "Board One",
            description: "A board",
            column_ids: ["col-1"],
            workspace_id: "ws-1",
            accentColor: null,
            icon: null,
          },
        },
        allIds: ["board-1"],
      },
      columns: {
        byId: {
          "col-1": {
            id: "col-1",
            name: "To Do",
            position: 0,
            task_ids: ["task-1"],
            description: null,
            accentColor: null,
            icon: null,
            board_id: "board-1",
          },
        },
        allIds: ["col-1"],
      },
      tasks: {
        byId: {
          "task-1": {
            id: "task-1",
            title: "Test Task",
            description: "A task",
            priority: "medium",
            status: "todo",
            progress: 50,
            position: 0,
            tags: ["bug"],
            due_date: null,
            assigned_to: null,
            board_id: "board-1",
            column_id: "col-1",
          },
        },
        allIds: ["task-1"],
      },
      boardPositions: { byId: {}, allIds: [] },
      boardConnections: { byId: {}, allIds: [] },
      areas: { byId: {}, allIds: [] },
      areaPositions: { byId: {}, allIds: [] },
      comments: { byId: {}, allIds: [] },
      chatMessages: { byId: {}, allIds: [] },
    };

    const snapshot = buildWorkspaceSnapshot("ws-1");

    expect(snapshot).toBeDefined();
    expect(snapshot!.name).toBe("Test Workspace");
    expect(snapshot!.boards).toHaveLength(1);
    expect(snapshot!.boards[0]!.name).toBe("Board One");
    expect(snapshot!.boards[0]!.columns).toHaveLength(1);
    expect(snapshot!.boards[0]!.columns[0]!.tasks).toHaveLength(1);
    expect(snapshot!.boards[0]!.columns[0]!.tasks[0]!.title).toBe("Test Task");
    expect(snapshot!.boards[0]!.columns[0]!.tasks[0]!.tags).toEqual(["bug"]);
  });

  it("returns undefined for nonexistent workspace", () => {
    mockKanbanState = {
      workspaces: { byId: {}, allIds: [] },
      boards: { byId: {}, allIds: [] },
      columns: { byId: {}, allIds: [] },
      tasks: { byId: {}, allIds: [] },
      boardPositions: { byId: {}, allIds: [] },
      boardConnections: { byId: {}, allIds: [] },
      areas: { byId: {}, allIds: [] },
      areaPositions: { byId: {}, allIds: [] },
      comments: { byId: {}, allIds: [] },
      chatMessages: { byId: {}, allIds: [] },
    };

    const snapshot = buildWorkspaceSnapshot("nonexistent");
    expect(snapshot).toBeUndefined();
  });

  it("skips boards, columns, tasks that don't exist", () => {
    mockKanbanState = {
      workspaces: {
        byId: {
          "ws-1": {
            id: "ws-1",
            name: "WS",
            board_ids: ["board-1", "board-ghost"],
          },
        },
        allIds: ["ws-1"],
      },
      boards: {
        byId: {
          "board-1": {
            id: "board-1",
            name: "B",
            description: null,
            column_ids: ["col-ghost"],
            workspace_id: "ws-1",
            accentColor: null,
            icon: null,
          },
        },
        allIds: ["board-1"],
      },
      columns: { byId: {}, allIds: [] },
      tasks: { byId: {}, allIds: [] },
      boardPositions: { byId: {}, allIds: [] },
      boardConnections: { byId: {}, allIds: [] },
      areas: { byId: {}, allIds: [] },
      areaPositions: { byId: {}, allIds: [] },
      comments: { byId: {}, allIds: [] },
      chatMessages: { byId: {}, allIds: [] },
    };

    const snapshot = buildWorkspaceSnapshot("ws-1");

    expect(snapshot).toBeDefined();
    expect(snapshot!.boards).toHaveLength(1);
    expect(snapshot!.boards[0]!.columns).toHaveLength(0);
  });
});
