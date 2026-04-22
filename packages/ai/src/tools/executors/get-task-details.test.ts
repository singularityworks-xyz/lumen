import { describe, expect, it, spyOn } from "bun:test";
import { executeGetTaskDetails } from "./get-task-details";
import type { ExecutorContext, WorkspaceSnapshot } from "./types";

function makeSnapshot(): WorkspaceSnapshot {
  return {
    name: "Test Workspace",
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
                description: "Users cannot login with SSO",
                priority: "high",
                status: "todo",
                progress: 25,
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
                title: "Setup CI",
                priority: "low",
                status: "done",
                progress: 100,
                position: 0,
                tags: ["devops"],
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
            name: "Inbox",
            position: 0,
            tasks: [
              {
                id: "task-4",
                title: "Investigate perf",
                description: "Slow page loads",
                priority: "urgent",
                status: "blocked",
                progress: 0,
                position: 0,
                tags: ["perf"],
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeCtx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    ...overrides,
  };
}

describe("executeGetTaskDetails", () => {
  it("returns full task details for a valid task ID", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.id).toBe("task-1");
    expect(data.title).toBe("Fix login bug");
    expect(data.description).toBe("Users cannot login with SSO");
    expect(data.priority).toBe("high");
    expect(data.status).toBe("todo");
    expect(data.progress).toBe(25);
    expect(data.dueDate).toBe("2025-12-31T00:00:00.000Z");
    expect(data.tags).toEqual(["bug", "auth"]);
  });

  it("includes column and board context", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    const data = result.data as any;
    expect(data.column).toEqual({ id: "col-1", name: "Todo" });
    expect(data.board).toEqual({ id: "board-1", name: "Sprint Board" });
  });

  it("finds tasks in the second board", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-4" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.title).toBe("Investigate perf");
    expect(data.board.id).toBe("board-2");
    expect(data.column.id).toBe("col-3");
  });

  it("finds tasks in the Done column", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-3" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.status).toBe("done");
    expect(data.column.name).toBe("Done");
  });

  it("returns error for non-existent task ID", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "nonexistent" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("returns error when snapshot is missing", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = makeCtx({ snapshot: undefined });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Workspace data not available");
    warnSpy.mockRestore();
  });

  it("handles task with no optional fields", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-2" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.title).toBe("Add dark mode");
    expect(data.description).toBeUndefined();
    expect(data.dueDate).toBeUndefined();
    expect(data.tags).toBeUndefined();
  });

  it("returns only the first matching task when IDs are unique", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.id).toBe("task-1");
  });

  it("handles empty workspace with no boards", () => {
    const snapshot: WorkspaceSnapshot = { name: "Empty", boards: [] };
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("handles board with empty columns", () => {
    const snapshot: WorkspaceSnapshot = {
      name: "W",
      boards: [{ id: "b1", name: "Board", columns: [] }],
    };
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("handles column with empty tasks", () => {
    const snapshot: WorkspaceSnapshot = {
      name: "W",
      boards: [
        {
          id: "b1",
          name: "Board",
          columns: [{ id: "c1", name: "Empty", position: 0, tasks: [] }],
        },
      ],
    };
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(false);
  });

  it("handles ephemeral context flag", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot, ephemeral: true });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);

    expect(result.success).toBe(true);
  });

  it("includes all task properties in response shape", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetTaskDetails({ taskId: "task-1" }, ctx);
    const data = result.data as any;

    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("priority");
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("progress");
    expect(data).toHaveProperty("column");
    expect(data).toHaveProperty("board");
    expect(data.column).toHaveProperty("id");
    expect(data.column).toHaveProperty("name");
    expect(data.board).toHaveProperty("id");
    expect(data.board).toHaveProperty("name");
  });
});
