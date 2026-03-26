import { describe, expect, it } from "bun:test";
import {
  bulkDeleteTasksSchema,
  bulkUpdateTasksSchema,
  createBoardSchema,
  createColumnSchema,
  createTaskSchema,
  deleteBoardSchema,
  deleteTaskSchema,
  getBoardDetailsSchema,
  getRecentActivitySchema,
  getTaskDetailsSchema,
  getWorkspaceOverviewSchema,
  moveTaskSchema,
  prioritySchema,
  searchTasksSchema,
  taskStatusSchema,
  updateBoardSchema,
  updateTaskSchema,
} from "../../src/tools/schemas";

describe("prioritySchema", () => {
  it("accepts all valid priority values", () => {
    expect(prioritySchema.parse("low")).toBe("low");
    expect(prioritySchema.parse("medium")).toBe("medium");
    expect(prioritySchema.parse("high")).toBe("high");
    expect(prioritySchema.parse("urgent")).toBe("urgent");
  });

  it("rejects invalid priority values", () => {
    expect(() => prioritySchema.parse("critical")).toThrow();
    expect(() => prioritySchema.parse("")).toThrow();
    expect(() => prioritySchema.parse("LOW")).toThrow();
  });
});

describe("taskStatusSchema", () => {
  it("accepts all valid status values", () => {
    const validStatuses = [
      "todo",
      "in_progress",
      "done",
      "blocked",
      "cancelled",
    ] as const;
    for (const s of validStatuses) {
      expect(taskStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid status values", () => {
    expect(() => taskStatusSchema.parse("pending")).toThrow();
    expect(() => taskStatusSchema.parse("")).toThrow();
    expect(() => taskStatusSchema.parse("IN_PROGRESS")).toThrow();
  });
});

describe("getWorkspaceOverviewSchema", () => {
  it("parses empty object with default includeStats", () => {
    const result = getWorkspaceOverviewSchema.parse({});
    expect(result.includeStats).toBe(true);
  });

  it("parses explicit includeStats=false", () => {
    const result = getWorkspaceOverviewSchema.parse({ includeStats: false });
    expect(result.includeStats).toBe(false);
  });
});

describe("getBoardDetailsSchema", () => {
  it("requires a boardId string", () => {
    expect(() => getBoardDetailsSchema.parse({})).toThrow();
    expect(() => getBoardDetailsSchema.parse({ boardId: "" })).not.toThrow();
    expect(getBoardDetailsSchema.parse({ boardId: "abc" })).toEqual({
      boardId: "abc",
    });
  });
});

describe("getTaskDetailsSchema", () => {
  it("requires a taskId string", () => {
    expect(() => getTaskDetailsSchema.parse({})).toThrow();
    expect(getTaskDetailsSchema.parse({ taskId: "t1" })).toEqual({
      taskId: "t1",
    });
  });
});

describe("searchTasksSchema", () => {
  it("accepts minimal valid payload", () => {
    const result = searchTasksSchema.parse({ query: "test" });
    expect(result.query).toBe("test");
    expect(result.limit).toBe(20);
  });

  it("accepts full valid payload with all filters", () => {
    const result = searchTasksSchema.parse({
      query: "bugs",
      status: "in_progress",
      priority: "high",
      boardId: "b1",
      limit: 10,
    });
    expect(result.status).toBe("in_progress");
    expect(result.priority).toBe("high");
    expect(result.limit).toBe(10);
  });

  it("rejects limit out of range", () => {
    expect(() => searchTasksSchema.parse({ query: "x", limit: 0 })).toThrow();
    expect(() => searchTasksSchema.parse({ query: "x", limit: 51 })).toThrow();
  });

  it("rejects invalid status filter", () => {
    expect(() =>
      searchTasksSchema.parse({ query: "x", status: "invalid" })
    ).toThrow();
  });
});

describe("getRecentActivitySchema", () => {
  it("accepts empty object with defaults", () => {
    const result = getRecentActivitySchema.parse({});
    expect(result.limit).toBe(20);
  });

  it("accepts valid ISO datetime for since", () => {
    const result = getRecentActivitySchema.parse({
      since: "2025-01-01T00:00:00.000Z",
    });
    expect(result.since).toBe("2025-01-01T00:00:00.000Z");
  });

  it("rejects non-ISO datetime for since", () => {
    expect(() =>
      getRecentActivitySchema.parse({ since: "yesterday" })
    ).toThrow();
  });

  it("rejects limit above 100", () => {
    expect(() => getRecentActivitySchema.parse({ limit: 101 })).toThrow();
  });
});

describe("createTaskSchema", () => {
  it("accepts minimal valid task creation", () => {
    const result = createTaskSchema.parse({
      boardId: "b1",
      title: "New task",
    });
    expect(result.boardId).toBe("b1");
    expect(result.title).toBe("New task");
  });

  it("rejects empty title", () => {
    expect(() =>
      createTaskSchema.parse({ boardId: "b1", title: "" })
    ).toThrow();
  });

  it("rejects title longer than 500 chars", () => {
    expect(() =>
      createTaskSchema.parse({ boardId: "b1", title: "x".repeat(501) })
    ).toThrow();
  });

  it("rejects invalid priority", () => {
    expect(() =>
      createTaskSchema.parse({
        boardId: "b1",
        title: "T",
        priority: "critical",
      })
    ).toThrow();
  });

  it("rejects non-ISO dueDate", () => {
    expect(() =>
      createTaskSchema.parse({
        boardId: "b1",
        title: "T",
        dueDate: "2025-12-25",
      })
    ).toThrow();
  });

  it("accepts valid ISO dueDate", () => {
    const result = createTaskSchema.parse({
      boardId: "b1",
      title: "T",
      dueDate: "2025-12-25T00:00:00.000Z",
    });
    expect(result.dueDate).toBe("2025-12-25T00:00:00.000Z");
  });
});

describe("updateTaskSchema", () => {
  it("accepts valid update with partial fields", () => {
    const result = updateTaskSchema.parse({
      taskId: "t1",
      updates: { title: "Updated" },
    });
    expect(result.taskId).toBe("t1");
    expect(result.updates.title).toBe("Updated");
  });

  it("accepts null dueDate to clear it", () => {
    const result = updateTaskSchema.parse({
      taskId: "t1",
      updates: { dueDate: null },
    });
    expect(result.updates.dueDate).toBeNull();
  });

  it("rejects without taskId", () => {
    expect(() => updateTaskSchema.parse({ updates: { title: "X" } })).toThrow();
  });
});

describe("deleteTaskSchema", () => {
  it("requires taskId", () => {
    expect(() => deleteTaskSchema.parse({})).toThrow();
    expect(deleteTaskSchema.parse({ taskId: "t1" })).toEqual({ taskId: "t1" });
  });
});

describe("moveTaskSchema", () => {
  it("accepts minimal move with just taskId", () => {
    const result = moveTaskSchema.parse({ taskId: "t1" });
    expect(result.taskId).toBe("t1");
  });

  it("accepts move with columnId, boardId, and position", () => {
    const result = moveTaskSchema.parse({
      taskId: "t1",
      columnId: "c1",
      boardId: "b2",
      position: 3,
    });
    expect(result.columnId).toBe("c1");
    expect(result.boardId).toBe("b2");
    expect(result.position).toBe(3);
  });

  it("rejects negative position", () => {
    expect(() =>
      moveTaskSchema.parse({ taskId: "t1", position: -1 })
    ).toThrow();
  });
});

describe("createBoardSchema", () => {
  it("accepts valid board creation", () => {
    const result = createBoardSchema.parse({ name: "Sprint 5" });
    expect(result.name).toBe("Sprint 5");
  });

  it("rejects empty name", () => {
    expect(() => createBoardSchema.parse({ name: "" })).toThrow();
  });

  it("accepts optional position", () => {
    const result = createBoardSchema.parse({
      name: "B",
      position: { x: 10, y: 20 },
    });
    expect(result.position).toEqual({ x: 10, y: 20 });
  });
});

describe("updateBoardSchema", () => {
  it("requires boardId", () => {
    expect(() => updateBoardSchema.parse({ updates: { name: "X" } })).toThrow();
  });

  it("accepts valid update", () => {
    const result = updateBoardSchema.parse({
      boardId: "b1",
      updates: { name: "New Name", description: "desc" },
    });
    expect(result.boardId).toBe("b1");
    expect(result.updates.name).toBe("New Name");
  });
});

describe("deleteBoardSchema", () => {
  it("requires boardId", () => {
    expect(() => deleteBoardSchema.parse({})).toThrow();
    expect(deleteBoardSchema.parse({ boardId: "b1" })).toEqual({
      boardId: "b1",
    });
  });
});

describe("createColumnSchema", () => {
  it("accepts valid column creation", () => {
    const result = createColumnSchema.parse({
      boardId: "b1",
      name: "In Progress",
    });
    expect(result.name).toBe("In Progress");
  });

  it("rejects empty name", () => {
    expect(() =>
      createColumnSchema.parse({ boardId: "b1", name: "" })
    ).toThrow();
  });

  it("rejects negative position", () => {
    expect(() =>
      createColumnSchema.parse({ boardId: "b1", name: "Col", position: -1 })
    ).toThrow();
  });
});

describe("bulkUpdateTasksSchema", () => {
  it("accepts valid bulk update", () => {
    const result = bulkUpdateTasksSchema.parse({
      taskIds: ["t1", "t2"],
      updates: { priority: "high", status: "in_progress" },
    });
    expect(result.taskIds).toHaveLength(2);
    expect(result.updates.priority).toBe("high");
  });

  it("rejects empty taskIds array", () => {
    expect(() =>
      bulkUpdateTasksSchema.parse({ taskIds: [], updates: { priority: "low" } })
    ).toThrow();
  });

  it("rejects more than 100 taskIds", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `t${i}`);
    expect(() =>
      bulkUpdateTasksSchema.parse({ taskIds: ids, updates: {} })
    ).toThrow();
  });

  it("rejects invalid priority in updates", () => {
    expect(() =>
      bulkUpdateTasksSchema.parse({
        taskIds: ["t1"],
        updates: { priority: "critical" },
      })
    ).toThrow();
  });
});

describe("bulkDeleteTasksSchema", () => {
  it("accepts valid bulk delete", () => {
    const result = bulkDeleteTasksSchema.parse({ taskIds: ["t1"] });
    expect(result.taskIds).toEqual(["t1"]);
  });

  it("rejects empty taskIds array", () => {
    expect(() => bulkDeleteTasksSchema.parse({ taskIds: [] })).toThrow();
  });
});
