import { describe, expect, it, spyOn } from "bun:test";
import { executeGetWorkspaceOverview } from "./get-workspace-overview";
import type { ExecutorContext, WorkspaceSnapshot } from "./types";

function makeSnapshot(
  overrides: Partial<WorkspaceSnapshot> = {}
): WorkspaceSnapshot {
  return {
    name: "Test Workspace",
    boards: [
      {
        id: "board-1",
        name: "Board One",
        columns: [
          {
            id: "col-1",
            name: "Todo",
            position: 0,
            tasks: [
              {
                id: "task-1",
                title: "Task 1",
                priority: "high",
                status: "todo",
                progress: 0,
                position: 0,
              },
              {
                id: "task-2",
                title: "Task 2",
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
                title: "Task 3",
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
        name: "Board Two",
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
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    ...overrides,
  };
}

describe("executeGetWorkspaceOverview", () => {
  it("returns workspace overview with board counts and task counts", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data as any;
    expect(data.workspaceId).toBe("ws-1");
    expect(data.name).toBe("Test Workspace");
    expect(data.boardCount).toBe(2);
    expect(data.totalTasks).toBe(3);
    expect(data.boards).toHaveLength(2);
  });

  it("computes correct column and task counts per board", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    const data = result.data as any;

    const board1 = data.boards.find((b: any) => b.id === "board-1");
    expect(board1.columnCount).toBe(2);
    expect(board1.taskCount).toBe(3);

    const board2 = data.boards.find((b: any) => b.id === "board-2");
    expect(board2.columnCount).toBe(1);
    expect(board2.taskCount).toBe(0);
  });

  it("returns each board with id, name, columnCount, taskCount", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    const data = result.data as any;

    for (const board of data.boards) {
      expect(board).toHaveProperty("id");
      expect(board).toHaveProperty("name");
      expect(board).toHaveProperty("columnCount");
      expect(board).toHaveProperty("taskCount");
      expect(typeof board.id).toBe("string");
      expect(typeof board.name).toBe("string");
      expect(typeof board.columnCount).toBe("number");
      expect(typeof board.taskCount).toBe("number");
    }
  });

  it("returns error when snapshot is missing", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = makeCtx({ snapshot: undefined });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Workspace data not available");
    warnSpy.mockRestore();
  });

  it("handles empty workspace (no boards)", () => {
    const snapshot = makeSnapshot({ boards: [] });
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.boardCount).toBe(0);
    expect(data.totalTasks).toBe(0);
    expect(data.boards).toHaveLength(0);
  });

  it("handles board with no columns", () => {
    const snapshot = makeSnapshot({
      boards: [{ id: "b1", name: "Empty Board", columns: [] }],
    });
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    const board = data.boards[0];
    expect(board.columnCount).toBe(0);
    expect(board.taskCount).toBe(0);
  });

  it("handles workspace with multiple boards with varying task distributions", () => {
    const snapshot = makeSnapshot({
      boards: [
        {
          id: "b1",
          name: "Big Board",
          columns: [
            {
              id: "c1",
              name: "Todo",
              position: 0,
              tasks: Array.from({ length: 10 }, (_, i) => ({
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
              name: "Done",
              position: 1,
              tasks: Array.from({ length: 5 }, (_, i) => ({
                id: `d${i}`,
                title: `Done ${i}`,
                priority: "low" as const,
                status: "done" as const,
                progress: 100,
                position: i,
              })),
            },
          ],
        },
        {
          id: "b2",
          name: "Small Board",
          columns: [
            {
              id: "c3",
              name: "Only",
              position: 0,
              tasks: [
                {
                  id: "t-single",
                  title: "Single",
                  priority: "high",
                  status: "todo",
                  progress: 0,
                  position: 0,
                },
              ],
            },
          ],
        },
      ],
    });
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    const data = result.data as any;

    expect(data.totalTasks).toBe(16);
    expect(data.boardCount).toBe(2);
  });

  it("ignores the includeStats param (always returns stats)", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const resultFalse = executeGetWorkspaceOverview(
      { includeStats: false },
      ctx
    );
    const resultTrue = executeGetWorkspaceOverview({ includeStats: true }, ctx);

    expect(resultFalse.success).toBe(true);
    expect(resultTrue.success).toBe(true);
    expect((resultFalse.data as any).boardCount).toBe(
      (resultTrue.data as any).boardCount
    );
  });

  it("includes workspaceId from context in the result", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot, workspaceId: "ws-custom-123" });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    const data = result.data as any;
    expect(data.workspaceId).toBe("ws-custom-123");
  });

  it("includes workspace name from snapshot", () => {
    const snapshot = makeSnapshot({ name: "My Special Workspace" });
    const ctx = makeCtx({ snapshot });
    const result = executeGetWorkspaceOverview({ includeStats: true }, ctx);
    const data = result.data as any;
    expect(data.name).toBe("My Special Workspace");
  });
});
