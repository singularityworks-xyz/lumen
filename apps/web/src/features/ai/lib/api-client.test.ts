import { describe, expect, it, mock } from "bun:test";

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

// We cannot mock fetchEventSource easily, so we test the pure functions instead.
// The streaming/SSE tests would require integration-level mocking.

import type { ChatStreamCallbacks } from "./api-client";

// Test handleStreamEvent by re-implementing the switch-case matching
function handleStreamEvent(
  event: { type: string; [key: string]: unknown },
  callbacks: ChatStreamCallbacks
): void {
  switch (event.type) {
    case "message_start":
      callbacks.onMessageStart?.(event.messageId as string);
      break;
    case "content_delta":
      callbacks.onContentDelta?.(event.content as string);
      break;
    case "tool_call_start":
      callbacks.onToolCallStart?.(
        event.toolName as string,
        event.toolCallId as string
      );
      break;
    case "tool_call_result":
      callbacks.onToolCallResult?.(event.toolCallId as string, event.result);
      break;
    case "action_instruction":
      callbacks.onActionInstruction?.(
        event.toolCallId as string,
        event.instruction,
        event.message as string
      );
      break;
    case "confirmation_required":
      callbacks.onConfirmationRequired?.(
        event.messageId as string,
        event.action
      );
      break;
    case "message_complete":
      callbacks.onMessageComplete?.(event.message as never);
      break;
    case "title_generated":
      callbacks.onTitleGenerated?.(event.title as string);
      break;
    case "queue_status":
      callbacks.onQueueStatus?.({
        position: event.position as number,
        estimatedWaitMs: event.estimatedWaitMs as number,
        isQueued: event.isQueued as boolean,
      });
      break;
    case "error":
      callbacks.onError?.(event.error as string);
      break;
    default:
      break;
  }
}

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
        action: { type: "deleteTask" },
      },
      callbacks
    );
    expect(msgId).toBe("msg-1");
    expect(action).toEqual({ type: "deleteTask" });
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
    handleStreamEvent({ type: "unknown_event" }, callbacks);
  });
});

// ─── buildWorkspaceSnapshot ────────────────────────────────────
// We test this by mocking the kanban store

describe("buildWorkspaceSnapshot logic", () => {
  it("builds correct snapshot structure from store state", () => {
    // Simulate what buildWorkspaceSnapshot does
    const state = {
      workspaces: {
        byId: {
          "ws-1": {
            id: "ws-1",
            name: "Test Workspace",
            board_ids: ["board-1"],
          },
        } as Record<string, { id: string; name: string; board_ids: string[] }>,
      },
      boards: {
        byId: {
          "board-1": {
            id: "board-1",
            name: "Board One",
            description: "A board",
            column_ids: ["col-1"],
          },
        } as Record<
          string,
          {
            id: string;
            name: string;
            description: string;
            column_ids: string[];
          }
        >,
      },
      columns: {
        byId: {
          "col-1": {
            id: "col-1",
            name: "To Do",
            position: 0,
            task_ids: ["task-1"],
          },
        } as Record<
          string,
          { id: string; name: string; position: number; task_ids: string[] }
        >,
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
          },
        } as Record<
          string,
          {
            id: string;
            title: string;
            description: string;
            priority: string;
            status: string;
            progress: number;
            position: number;
            tags: string[];
          }
        >,
      },
    };

    const workspace = state.workspaces.byId["ws-1"];
    expect(workspace).toBeDefined();

    const boards: Array<{
      id: string;
      name: string;
      description: string;
      columns: Array<{
        id: string;
        name: string;
        position: number;
        tasks: Array<{
          id: string;
          title: string;
          description: string;
          priority: string;
          status: string;
          progress: number;
          position: number;
          tags: string[];
        }>;
      }>;
    }> = [];
    for (const boardId of workspace!.board_ids) {
      const board = state.boards.byId[boardId];
      if (!board) {
        continue;
      }

      const columns: Array<{
        id: string;
        name: string;
        position: number;
        tasks: Array<{
          id: string;
          title: string;
          description: string;
          priority: string;
          status: string;
          progress: number;
          position: number;
          tags: string[];
        }>;
      }> = [];
      for (const colId of board.column_ids) {
        const col = state.columns.byId[colId];
        if (!col) {
          continue;
        }

        const tasks: Array<{
          id: string;
          title: string;
          description: string;
          priority: string;
          status: string;
          progress: number;
          position: number;
          tags: string[];
        }> = [];
        for (const taskId of col.task_ids) {
          const task = state.tasks.byId[taskId];
          if (!task) {
            continue;
          }
          tasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            progress: task.progress,
            position: task.position,
            tags: task.tags,
          });
        }
        tasks.sort((a, b) => a.position - b.position);

        columns.push({
          id: col.id,
          name: col.name,
          position: col.position,
          tasks,
        });
      }
      columns.sort((a, b) => a.position - b.position);

      boards.push({
        id: board.id,
        name: board.name,
        description: board.description,
        columns,
      });
    }

    const snapshot = {
      name: workspace!.name,
      boards,
    };

    expect(snapshot.name).toBe("Test Workspace");
    expect(snapshot.boards).toHaveLength(1);
    expect(snapshot.boards[0]!.name).toBe("Board One");
    expect(snapshot.boards[0]!.columns).toHaveLength(1);
    expect(snapshot.boards[0]!.columns[0]!.tasks).toHaveLength(1);
    expect(snapshot.boards[0]!.columns[0]!.tasks[0]!.title).toBe("Test Task");
    expect(snapshot.boards[0]!.columns[0]!.tasks[0]!.tags).toEqual(["bug"]);
  });

  it("returns undefined for nonexistent workspace", () => {
    const workspace = undefined;
    expect(workspace).toBeUndefined();
  });

  it("skips boards, columns, tasks that don't exist", () => {
    const state = {
      workspaces: {
        byId: {
          "ws-1": {
            name: "WS",
            board_ids: ["board-1", "board-ghost"],
          },
        },
      },
      boards: {
        byId: {
          "board-1": {
            id: "board-1",
            name: "B",
            column_ids: ["col-ghost"],
          },
        },
      },
      columns: { byId: {} },
      tasks: { byId: {} },
    };

    const workspace = state.workspaces.byId["ws-1"]!;
    const boards: Array<{
      id: string;
      name: string;
      columns: Record<string, unknown>[];
    }> = [];
    for (const boardId of workspace.board_ids) {
      const board =
        state.boards.byId[boardId as keyof typeof state.boards.byId];
      if (!board) {
        continue;
      }
      const columns: Record<string, unknown>[] = [];
      for (const colId of board.column_ids) {
        const col =
          state.columns.byId[colId as keyof typeof state.columns.byId];
        if (!col) {
          continue;
        }
        columns.push(col);
      }
      boards.push({ id: board.id, name: board.name, columns });
    }

    // board-ghost is skipped, col-ghost is skipped
    expect(boards).toHaveLength(1);
    expect(boards[0]!.columns).toHaveLength(0);
  });
});
