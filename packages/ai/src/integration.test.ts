import { describe, expect, it } from "bun:test";
import {
  buildActionInstruction,
  buildCreateTaskInstruction,
  buildDeleteTaskInstruction,
  type ExecutorContext,
  executeGetBoardDetails,
  executeGetTaskDetails,
  executeGetWorkspaceOverview,
  executeSearchTasks,
  type WorkspaceSnapshot,
} from "./tools/executors";
import {
  detectToolIntent,
  getToolsForMessage,
  needsTools,
} from "./tools/router";
import { classifyToolIntentSync } from "./tools/tool-classifier";

function makeSnapshot(): WorkspaceSnapshot {
  return {
    name: "Integration Workspace",
    boards: [
      {
        id: "board-1",
        name: "Sprint Board",
        columns: [
          {
            id: "col-1",
            name: "Todo",
            position: 0,
            tasks: [
              {
                id: "task-1",
                title: "Fix login bug",
                description: "Users cannot log in with SSO",
                priority: "high",
                status: "todo",
                progress: 0,
                position: 0,
                dueDate: "2025-12-31T00:00:00.000Z",
                tags: ["bug", "auth"],
              },
              {
                id: "task-2",
                title: "Add dark mode",
                priority: "medium",
                status: "in_progress",
                progress: 50,
                position: 1,
              },
            ],
          },
          {
            id: "col-2",
            name: "Done",
            position: 1,
            tasks: [
              {
                id: "task-3",
                title: "Update docs",
                priority: "low",
                status: "done",
                progress: 100,
                position: 0,
              },
            ],
          },
        ],
      },
      {
        id: "board-2",
        name: "Backlog",
        columns: [
          {
            id: "col-3",
            name: "Ideas",
            position: 0,
            tasks: [],
          },
        ],
      },
    ],
  };
}

function makeCtx(snapshot?: WorkspaceSnapshot): ExecutorContext {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    snapshot: snapshot ?? makeSnapshot(),
  };
}

describe("Integration: message to executor pipeline", () => {
  it("search query finds matching tasks", () => {
    const intent = detectToolIntent("find tasks about login");
    expect(intent.intent).toBe("query");

    const ctx = makeCtx();
    const result = executeSearchTasks({ query: "login", limit: 20 }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { count: number; tasks: Array<{ id: string }> };
    expect(data.count).toBe(1);
    expect(data.tasks[0]?.id).toBe("task-1");
  });

  it("board details query returns board with columns", () => {
    const ctx = makeCtx();
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as {
      name: string;
      columns: Array<{ taskCount: number }>;
    };
    expect(data.name).toBe("Sprint Board");
    expect(data.columns.length).toBe(2);
    expect(data.columns[0]?.taskCount).toBe(2);
  });

  it("task details query returns full task info", () => {
    const ctx = makeCtx();
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as {
      title: string;
      priority: string;
      tags: string[];
      column: { name: string };
      board: { name: string };
    };
    expect(data.title).toBe("Fix login bug");
    expect(data.priority).toBe("high");
    expect(data.tags).toEqual(["bug", "auth"]);
    expect(data.column.name).toBe("Todo");
    expect(data.board.name).toBe("Sprint Board");
  });

  it("workspace overview returns stats", () => {
    const ctx = makeCtx();
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { boardCount: number; totalTasks: number };
    expect(data.boardCount).toBe(2);
    expect(data.totalTasks).toBe(3);
  });

  it("create task action returns instruction", () => {
    const intent = detectToolIntent("create a new task for the sprint");
    expect(intent.intent).toBe("action");

    const instruction = buildCreateTaskInstruction({
      boardId: "board-1",
      title: "Write tests",
      priority: "high",
    });
    expect(instruction.success).toBe(true);
    expect(instruction.instruction.type).toBe("createTask");
    if (instruction.instruction.type === "createTask") {
      expect(instruction.instruction.boardId).toBe("board-1");
      expect(instruction.instruction.title).toBe("Write tests");
      expect(instruction.instruction.priority).toBe("high");
    }
  });

  it("delete task action returns instruction", () => {
    const instruction = buildDeleteTaskInstruction({ taskId: "task-1" });
    expect(instruction.success).toBe(true);
    expect(instruction.instruction.type).toBe("deleteTask");
  });

  it("buildActionInstruction dispatcher routes correctly", () => {
    const createResult = buildActionInstruction("createTask", {
      boardId: "b1",
      title: "Test",
    });
    expect(createResult?.instruction.type).toBe("createTask");

    const deleteResult = buildActionInstruction("deleteTask", { taskId: "t1" });
    expect(deleteResult?.instruction.type).toBe("deleteTask");

    const unknownResult = buildActionInstruction("unknownTool", {});
    expect(unknownResult).toBeNull();

    const queryResult = buildActionInstruction("searchTasks", {
      query: "test",
    });
    expect(queryResult).toBeNull();
  });
});

describe("Integration: error handling without snapshot", () => {
  const ctxNoSnapshot: ExecutorContext = {
    userId: "user-1",
    workspaceId: "ws-1",
    snapshot: undefined,
  };

  it("search fails gracefully without snapshot", () => {
    const result = executeSearchTasks(
      { query: "test", limit: 20 },
      ctxNoSnapshot
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace data not available");
  });

  it("board details fails gracefully without snapshot", () => {
    const result = executeGetBoardDetails({ boardId: "b1" }, ctxNoSnapshot);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace data not available");
  });

  it("task details fails gracefully without snapshot", () => {
    const result = executeGetTaskDetails({ taskId: "t1" }, ctxNoSnapshot);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace data not available");
  });

  it("workspace overview fails gracefully without snapshot", () => {
    const result = executeGetWorkspaceOverview(
      { includeStats: true },
      ctxNoSnapshot
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Workspace data not available. Please refresh and try again."
    );
  });
});

describe("Integration: not-found error handling", () => {
  it("board details returns error for non-existent board", () => {
    const ctx = makeCtx();
    const result = executeGetBoardDetails({ boardId: "nonexistent" }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("task details returns error for non-existent task", () => {
    const ctx = makeCtx();
    const result = executeGetTaskDetails({ taskId: "nonexistent" }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("search returns empty for non-existent board filter", () => {
    const ctx = makeCtx();
    const result = executeSearchTasks(
      { query: "login", boardId: "nonexistent", limit: 20 },
      ctx
    );
    expect(result.success).toBe(true);
    const data = result.data as { count: number };
    expect(data.count).toBe(0);
  });
});

describe("Integration: classifier consistency", () => {
  it("sync classifier and router agree on query intent", () => {
    const routerResult = detectToolIntent("show me all tasks");
    const classifierResult = classifyToolIntentSync("show me all tasks");
    expect(routerResult.intent).toBe(classifierResult.intent);
  });

  it("sync classifier and router agree on action intent", () => {
    const routerResult = detectToolIntent("create a new task");
    const classifierResult = classifyToolIntentSync("create a new task");
    expect(routerResult.intent).toBe(classifierResult.intent);
  });

  it("sync classifier and router agree on none intent", () => {
    const routerResult = detectToolIntent("hello world");
    const classifierResult = classifyToolIntentSync("hello world");
    expect(routerResult.intent).toBe(classifierResult.intent);
  });

  it("needsTools is consistent with getToolsForMessage", () => {
    const messages = [
      "show me the tasks",
      "create a new task",
      "delete this board",
      "I have a task",
      "hello",
    ];
    for (const msg of messages) {
      const tools = getToolsForMessage(msg);
      const needs = needsTools(msg);
      if (tools) {
        expect(needs).toBe(true);
      } else {
        expect(needs).toBe(false);
      }
    }
  });
});
