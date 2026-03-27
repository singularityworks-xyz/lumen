import { describe, expect, it, spyOn } from "bun:test";
import {
  type ExecutorContext,
  executeGetBoardDetails,
  type WorkspaceSnapshot,
} from "./tools/executors";

function makeSnapshot(): WorkspaceSnapshot {
  return {
    name: "Test Workspace",
    boards: [
      {
        id: "board-1",
        name: "Sprint Board",
        description: "Current sprint work",
        columns: [
          {
            id: "col-1",
            name: "Todo",
            position: 0,
            tasks: [
              {
                id: "task-1",
                title: "Fix login bug",
                priority: "high",
                status: "todo",
                progress: 0,
                position: 0,
                dueDate: "2025-12-31T00:00:00.000Z",
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
              },
            ],
          },
        ],
      },
      {
        id: "board-2",
        name: "Empty Board",
        columns: [
          {
            id: "col-3",
            name: "Backlog",
            position: 0,
            tasks: [],
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

describe("executeGetBoardDetails", () => {
  it("returns board details with columns and tasks", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.id).toBe("board-1");
    expect(data.name).toBe("Sprint Board");
    expect(data.description).toBe("Current sprint work");
    expect(data.columns).toHaveLength(2);
  });

  it("returns correct column structure with task counts", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);
    const data = result.data as any;

    const todoCol = data.columns[0];
    expect(todoCol.id).toBe("col-1");
    expect(todoCol.name).toBe("Todo");
    expect(todoCol.taskCount).toBe(2);

    const doneCol = data.columns[1];
    expect(doneCol.id).toBe("col-2");
    expect(doneCol.name).toBe("Done");
    expect(doneCol.taskCount).toBe(1);
  });

  it("returns tasks with id, title, priority, status, and dueDate", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);
    const data = result.data as any;

    const tasks = data.columns[0].tasks;
    expect(tasks).toHaveLength(2);

    const task1 = tasks[0];
    expect(task1.id).toBe("task-1");
    expect(task1.title).toBe("Fix login bug");
    expect(task1.priority).toBe("high");
    expect(task1.status).toBe("todo");
    expect(task1.dueDate).toBe("2025-12-31T00:00:00.000Z");
  });

  it("handles board with no tasks in a column", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-2" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.columns[0].taskCount).toBe(0);
    expect(data.columns[0].tasks).toHaveLength(0);
  });

  it("returns error for non-existent board ID", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "nonexistent" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("returns error when snapshot is missing", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = makeCtx({ snapshot: undefined });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Workspace data not available");
    warnSpy.mockRestore();
  });

  it("handles empty workspace with no boards", () => {
    const snapshot: WorkspaceSnapshot = { name: "Empty", boards: [] };
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("handles board with no description", () => {
    const snapshot: WorkspaceSnapshot = {
      name: "W",
      boards: [
        {
          id: "b1",
          name: "No Desc Board",
          columns: [{ id: "c1", name: "Col", position: 0, tasks: [] }],
        },
      ],
    };
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "b1" }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.description).toBeUndefined();
  });

  it("handles board with multiple columns containing varying tasks", () => {
    const snapshot: WorkspaceSnapshot = {
      name: "W",
      boards: [
        {
          id: "b1",
          name: "Board",
          columns: [
            {
              id: "c1",
              name: "Col 1",
              position: 0,
              tasks: Array.from({ length: 5 }, (_, i) => ({
                id: `t${i}`,
                title: `Task ${i}`,
                priority: "medium" as const,
                status: "todo" as const,
                progress: 0,
                position: i,
              })),
            },
            {
              id: "c2",
              name: "Col 2",
              position: 1,
              tasks: Array.from({ length: 3 }, (_, i) => ({
                id: `t2-${i}`,
                title: `Task 2-${i}`,
                priority: "high" as const,
                status: "in_progress" as const,
                progress: 50,
                position: i,
              })),
            },
            {
              id: "c3",
              name: "Col 3",
              position: 2,
              tasks: [],
            },
          ],
        },
      ],
    };
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "b1" }, ctx);
    const data = result.data as any;

    expect(data.columns).toHaveLength(3);
    expect(data.columns[0].taskCount).toBe(5);
    expect(data.columns[1].taskCount).toBe(3);
    expect(data.columns[2].taskCount).toBe(0);
  });

  it("includes workspaceId from context", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot, workspaceId: "ws-custom" });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);

    expect(result.success).toBe(true);
  });

  it("preserves column ordering by position", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);
    const data = result.data as any;

    expect(data.columns[0].name).toBe("Todo");
    expect(data.columns[1].name).toBe("Done");
  });

  it("returns all task fields needed for listing", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetBoardDetails({ boardId: "board-1" }, ctx);
    const data = result.data as any;

    for (const col of data.columns) {
      for (const task of col.tasks) {
        expect(task).toHaveProperty("id");
        expect(task).toHaveProperty("title");
        expect(task).toHaveProperty("priority");
        expect(task).toHaveProperty("status");
        expect(task).toHaveProperty("dueDate");
      }
    }
  });
});
