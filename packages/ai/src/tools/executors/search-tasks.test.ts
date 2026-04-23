import { describe, expect, it, spyOn } from "bun:test";
import type { SearchTasksParams } from "../schemas";
import { executeSearchTasks } from "./search-tasks";
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
                progress: 0,
                position: 0,
              },
              {
                id: "task-2",
                title: "Add dark mode",
                description: "Implement dark theme",
                priority: "medium",
                status: "in_progress",
                progress: 30,
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
                title: "Setup CI pipeline",
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
        name: "Backlog Board",
        columns: [
          {
            id: "col-3",
            name: "Backlog",
            position: 0,
            tasks: [
              {
                id: "task-4",
                title: "Fix login redirect",
                priority: "urgent",
                status: "blocked",
                progress: 0,
                position: 0,
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

describe("executeSearchTasks", () => {
  it("finds tasks matching query in title", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "login", limit: 20 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.count).toBe(2);
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0].title).toContain("login");
    expect(data.tasks[1].title).toContain("login");
  });

  it("finds tasks matching query in description", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "SSO", limit: 20 }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.count).toBe(1);
    expect(data.tasks[0].id).toBe("task-1");
  });

  it("search is case-insensitive", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "LOGIN", limit: 20 }, ctx);

    const data = result.data as any;
    expect(data.count).toBe(2);
  });

  it("returns empty results when no match", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "nonexistent", limit: 20 }, ctx);

    const data = result.data as any;
    expect(data.count).toBe(0);
    expect(data.tasks).toHaveLength(0);
  });

  it("filters by priority", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks(
      { query: "login", priority: "high", limit: 20 },
      ctx
    );

    const data = result.data as any;
    expect(data.count).toBe(1);
    expect(data.tasks[0].priority).toBe("high");
  });

  it("filters by status", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks(
      { query: "login", status: "blocked", limit: 20 },
      ctx
    );

    const data = result.data as any;
    expect(data.count).toBe(1);
    expect(data.tasks[0].status).toBe("blocked");
  });

  it("filters by boardId", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks(
      { query: "login", boardId: "board-1", limit: 20 },
      ctx
    );

    const data = result.data as any;
    expect(data.count).toBe(1);
    expect(data.tasks[0].boardName).toBe("Sprint Board");
  });

  it("respects the limit parameter", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "login", limit: 1 }, ctx);

    const data = result.data as any;
    expect(data.count).toBe(1);
  });

  it("uses default limit of 20 when not specified", () => {
    const bigSnapshot: WorkspaceSnapshot = {
      name: "Big",
      boards: [
        {
          id: "b1",
          name: "Board",
          columns: [
            {
              id: "c1",
              name: "Col",
              position: 0,
              tasks: Array.from({ length: 30 }, (_, i) => ({
                id: `t${i}`,
                title: `task item ${i}`,
                priority: "medium" as const,
                status: "todo" as const,
                progress: 0,
                position: i,
              })),
            },
          ],
        },
      ],
    };
    const ctx = makeCtx({ snapshot: bigSnapshot });
    const result = executeSearchTasks(
      { query: "task" } as unknown as SearchTasksParams,
      ctx
    );
    const data = result.data as any;
    expect(data.count).toBe(20);
    expect(data.tasks).toHaveLength(20);
  });

  it("returns error when snapshot is missing", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = makeCtx({ snapshot: undefined });
    const result = executeSearchTasks({ query: "test", limit: 20 }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Workspace data not available");
    warnSpy.mockRestore();
  });

  it("returns task with correct structure", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "login", limit: 20 }, ctx);
    const data = result.data as any;

    for (const task of data.tasks) {
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("columnName");
      expect(task).toHaveProperty("boardName");
    }
  });

  it("includes query in the response", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "dark mode", limit: 20 }, ctx);
    const data = result.data as any;
    expect(data.query).toBe("dark mode");
  });

  it("combines priority, status, and boardId filters", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks(
      {
        query: "fix",
        priority: "urgent",
        status: "blocked",
        boardId: "board-2",
        limit: 20,
      },
      ctx
    );

    const data = result.data as any;
    expect(data.count).toBe(1);
    expect(data.tasks[0].id).toBe("task-4");
  });

  it("returns no results when filters exclude all matches", () => {
    const snapshot = makeSnapshot();
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks(
      { query: "login", priority: "low", limit: 20 },
      ctx
    );

    const data = result.data as any;
    expect(data.count).toBe(0);
  });

  it("stops searching boards once limit is reached", () => {
    const snapshot: WorkspaceSnapshot = {
      name: "W",
      boards: [
        {
          id: "b1",
          name: "Board 1",
          columns: [
            {
              id: "c1",
              name: "Col",
              position: 0,
              tasks: Array.from({ length: 3 }, (_, i) => ({
                id: `t${i}`,
                title: "match task",
                priority: "medium" as const,
                status: "todo" as const,
                progress: 0,
                position: i,
              })),
            },
          ],
        },
        {
          id: "b2",
          name: "Board 2",
          columns: [
            {
              id: "c2",
              name: "Col",
              position: 0,
              tasks: [
                {
                  id: "t-later",
                  title: "match task later",
                  priority: "medium",
                  status: "todo",
                  progress: 0,
                  position: 0,
                },
              ],
            },
          ],
        },
      ],
    };
    const ctx = makeCtx({ snapshot });
    const result = executeSearchTasks({ query: "match", limit: 2 }, ctx);
    const data = result.data as any;
    expect(data.count).toBe(2);
  });
});
