import { describe, expect, it } from "bun:test";
import {
  buildActionInstruction,
  buildBulkDeleteTasksInstruction,
  buildBulkUpdateTasksInstruction,
  buildCreateBoardInstruction,
  buildCreateColumnInstruction,
  buildCreateTaskInstruction,
  buildCreateTextBoardInstruction,
  buildDeleteBoardInstruction,
  buildDeleteTaskInstruction,
  buildDeleteTextBoardInstruction,
  buildMoveTaskInstruction,
  buildUpdateBoardInstruction,
  buildUpdateTaskInstruction,
  buildUpdateTextBoardInstruction,
} from "./action-builders";
import type {
  BulkUpdateTasksInstruction,
  CreateBoardInstruction,
  CreateColumnInstruction,
  CreateTaskInstruction,
  MoveTaskInstruction,
  UpdateBoardInstruction,
  UpdateTaskInstruction,
} from "./action-instructions";

describe("buildCreateTaskInstruction", () => {
  it("builds a createTask instruction with required fields", () => {
    const result = buildCreateTaskInstruction({
      boardId: "board-1",
      title: "New Task",
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as CreateTaskInstruction;
    expect(inst.type).toBe("createTask");
    expect(inst.boardId).toBe("board-1");
    expect(inst.title).toBe("New Task");
    expect(result.message).toContain("New Task");
  });

  it("includes optional fields when provided", () => {
    const result = buildCreateTaskInstruction({
      boardId: "board-1",
      title: "Task",
      columnId: "col-1",
      description: "A description",
      priority: "high",
      dueDate: "2025-12-25T00:00:00.000Z",
    });
    const inst = result.instruction as CreateTaskInstruction;
    expect(inst.columnId).toBe("col-1");
    expect(inst.description).toBe("A description");
    expect(inst.priority).toBe("high");
    expect(inst.dueDate).toBe("2025-12-25T00:00:00.000Z");
  });

  it("maps 'urgent' priority to 'high' via mapPriority", () => {
    const result = buildCreateTaskInstruction({
      boardId: "board-1",
      title: "Urgent Task",
      priority: "urgent",
    });
    const inst = result.instruction as CreateTaskInstruction;
    expect(inst.priority).toBe("high");
  });

  it("omits priority when not provided", () => {
    const result = buildCreateTaskInstruction({
      boardId: "board-1",
      title: "Task",
    });
    const inst = result.instruction as CreateTaskInstruction;
    expect(inst.priority).toBeUndefined();
  });

  it("returns success: true", () => {
    const result = buildCreateTaskInstruction({
      boardId: "b1",
      title: "T",
    });
    expect(result.success).toBe(true);
  });
});

describe("buildUpdateTaskInstruction", () => {
  it("builds an updateTask instruction", () => {
    const result = buildUpdateTaskInstruction({
      taskId: "task-1",
      updates: { title: "Updated Title" },
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as UpdateTaskInstruction;
    expect(inst.type).toBe("updateTask");
    expect(inst.taskId).toBe("task-1");
    expect(inst.updates.title).toBe("Updated Title");
    expect(result.message).toContain("task-1");
  });

  it("maps urgent priority to high in updates", () => {
    const result = buildUpdateTaskInstruction({
      taskId: "t1",
      updates: { priority: "urgent" },
    });
    const inst = result.instruction as UpdateTaskInstruction;
    expect(inst.updates.priority).toBe("high");
  });

  it("preserves null dueDate for clearing", () => {
    const result = buildUpdateTaskInstruction({
      taskId: "t1",
      updates: { dueDate: null },
    });
    const inst = result.instruction as UpdateTaskInstruction;
    expect(inst.updates.dueDate).toBeNull();
  });

  it("preserves status in updates", () => {
    const result = buildUpdateTaskInstruction({
      taskId: "t1",
      updates: { status: "done" },
    });
    const inst = result.instruction as UpdateTaskInstruction;
    expect(inst.updates.status).toBe("done");
  });

  it("omits priority when not provided in updates", () => {
    const result = buildUpdateTaskInstruction({
      taskId: "t1",
      updates: { title: "New" },
    });
    const inst = result.instruction as UpdateTaskInstruction;
    expect(inst.updates.priority).toBeUndefined();
  });
});

describe("buildDeleteTaskInstruction", () => {
  it("builds a deleteTask instruction", () => {
    const result = buildDeleteTaskInstruction({ taskId: "task-1" });
    expect(result.success).toBe(true);
    expect(result.instruction.type).toBe("deleteTask");
    expect((result.instruction as any).taskId).toBe("task-1");
    expect(result.message).toContain("task-1");
  });
});

describe("buildMoveTaskInstruction", () => {
  it("builds a moveTask instruction with all fields", () => {
    const result = buildMoveTaskInstruction({
      taskId: "task-1",
      columnId: "col-2",
      boardId: "board-2",
      position: 3,
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as MoveTaskInstruction;
    expect(inst.type).toBe("moveTask");
    expect(inst.taskId).toBe("task-1");
    expect(inst.columnId).toBe("col-2");
    expect(inst.boardId).toBe("board-2");
    expect(inst.position).toBe(3);
  });

  it("builds with only taskId (minimal)", () => {
    const result = buildMoveTaskInstruction({ taskId: "t1" });
    const inst = result.instruction as MoveTaskInstruction;
    expect(inst.columnId).toBeUndefined();
    expect(inst.boardId).toBeUndefined();
    expect(inst.position).toBeUndefined();
  });
});

describe("buildCreateBoardInstruction", () => {
  it("builds a createBoard instruction", () => {
    const result = buildCreateBoardInstruction({ name: "Sprint 5" });
    expect(result.success).toBe(true);
    const inst = result.instruction as CreateBoardInstruction;
    expect(inst.type).toBe("createBoard");
    expect(inst.name).toBe("Sprint 5");
    expect(result.message).toContain("Sprint 5");
  });

  it("includes optional description and position", () => {
    const result = buildCreateBoardInstruction({
      name: "Board",
      description: "A board",
      position: { x: 10, y: 20 },
    });
    const inst = result.instruction as CreateBoardInstruction;
    expect(inst.description).toBe("A board");
    expect(inst.position).toEqual({ x: 10, y: 20 });
  });
});

describe("buildUpdateBoardInstruction", () => {
  it("builds an updateBoard instruction", () => {
    const result = buildUpdateBoardInstruction({
      boardId: "board-1",
      updates: { name: "Renamed" },
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as UpdateBoardInstruction;
    expect(inst.type).toBe("updateBoard");
    expect(inst.boardId).toBe("board-1");
    expect(inst.updates.name).toBe("Renamed");
  });

  it("includes description in updates", () => {
    const result = buildUpdateBoardInstruction({
      boardId: "b1",
      updates: { description: "New desc" },
    });
    const inst = result.instruction as UpdateBoardInstruction;
    expect(inst.updates.description).toBe("New desc");
  });
});

describe("buildDeleteBoardInstruction", () => {
  it("builds a deleteBoard instruction", () => {
    const result = buildDeleteBoardInstruction({ boardId: "board-1" });
    expect(result.success).toBe(true);
    expect(result.instruction.type).toBe("deleteBoard");
    expect((result.instruction as any).boardId).toBe("board-1");
    expect(result.message).toContain("board-1");
  });
});

describe("buildCreateTextBoardInstruction", () => {
  it("builds a createTextBoard instruction with all fields", () => {
    const result = buildCreateTextBoardInstruction({
      name: "Launch todos",
      description: "Todos for launch",
      content: "- [ ] Ship it",
      position: { x: 1, y: 2 },
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as {
      content?: string;
      name: string;
      position?: { x: number; y: number };
      type: string;
    };
    expect(inst.type).toBe("createTextBoard");
    expect(inst.name).toBe("Launch todos");
    expect(inst.content).toBe("- [ ] Ship it");
    expect(inst.position).toEqual({ x: 1, y: 2 });
    expect(result.message).toContain("Launch todos");
  });
});

describe("buildUpdateTextBoardInstruction", () => {
  it("builds an updateTextBoard instruction", () => {
    const result = buildUpdateTextBoardInstruction({
      textBoardId: "tb1",
      updates: { name: "Renamed", content: "- [x] Done" },
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as {
      textBoardId: string;
      type: string;
      updates: { content?: string; name?: string };
    };
    expect(inst.type).toBe("updateTextBoard");
    expect(inst.textBoardId).toBe("tb1");
    expect(inst.updates.name).toBe("Renamed");
    expect(inst.updates.content).toBe("- [x] Done");
  });
});

describe("buildDeleteTextBoardInstruction", () => {
  it("builds a deleteTextBoard instruction", () => {
    const result = buildDeleteTextBoardInstruction({ textBoardId: "tb1" });
    expect(result.success).toBe(true);
    expect(result.instruction.type).toBe("deleteTextBoard");
    expect((result.instruction as { textBoardId: string }).textBoardId).toBe(
      "tb1"
    );
  });
});

describe("buildCreateColumnInstruction", () => {
  it("builds a createColumn instruction", () => {
    const result = buildCreateColumnInstruction({
      boardId: "board-1",
      name: "In Progress",
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as CreateColumnInstruction;
    expect(inst.type).toBe("createColumn");
    expect(inst.boardId).toBe("board-1");
    expect(inst.name).toBe("In Progress");
    expect(result.message).toContain("In Progress");
  });

  it("includes optional position", () => {
    const result = buildCreateColumnInstruction({
      boardId: "b1",
      name: "Col",
      position: 2,
    });
    const inst = result.instruction as CreateColumnInstruction;
    expect(inst.position).toBe(2);
  });
});

describe("buildBulkUpdateTasksInstruction", () => {
  it("builds a bulkUpdateTasks instruction", () => {
    const result = buildBulkUpdateTasksInstruction({
      taskIds: ["t1", "t2", "t3"],
      updates: { priority: "high", status: "in_progress" },
    });
    expect(result.success).toBe(true);
    const inst = result.instruction as BulkUpdateTasksInstruction;
    expect(inst.type).toBe("bulkUpdateTasks");
    expect(inst.taskIds).toEqual(["t1", "t2", "t3"]);
    expect(inst.updates.priority).toBe("high");
    expect(inst.updates.status).toBe("in_progress");
    expect(result.message).toContain("3 tasks");
  });

  it("maps urgent to high in bulk updates", () => {
    const result = buildBulkUpdateTasksInstruction({
      taskIds: ["t1"],
      updates: { priority: "urgent" },
    });
    const inst = result.instruction as BulkUpdateTasksInstruction;
    expect(inst.updates.priority).toBe("high");
  });

  it("omits priority when not set", () => {
    const result = buildBulkUpdateTasksInstruction({
      taskIds: ["t1"],
      updates: { status: "done" },
    });
    const inst = result.instruction as BulkUpdateTasksInstruction;
    expect(inst.updates.priority).toBeUndefined();
  });

  it("preserves dueDate and columnId in updates", () => {
    const result = buildBulkUpdateTasksInstruction({
      taskIds: ["t1"],
      updates: {
        dueDate: "2025-12-25T00:00:00.000Z",
        columnId: "col-1",
      },
    });
    const inst = result.instruction as BulkUpdateTasksInstruction;
    expect(inst.updates.dueDate).toBe("2025-12-25T00:00:00.000Z");
    expect(inst.updates.columnId).toBe("col-1");
  });
});

describe("buildBulkDeleteTasksInstruction", () => {
  it("builds a bulkDeleteTasks instruction", () => {
    const result = buildBulkDeleteTasksInstruction({
      taskIds: ["t1", "t2"],
    });
    expect(result.success).toBe(true);
    expect(result.instruction.type).toBe("bulkDeleteTasks");
    expect((result.instruction as any).taskIds).toEqual(["t1", "t2"]);
    expect(result.message).toContain("2 tasks");
  });

  it("handles single task delete", () => {
    const result = buildBulkDeleteTasksInstruction({ taskIds: ["t1"] });
    expect(result.message).toContain("1 task");
  });
});

describe("buildActionInstruction (dispatcher)", () => {
  it("dispatches 'createTask' to buildCreateTaskInstruction", () => {
    const result = buildActionInstruction("createTask", {
      boardId: "b1",
      title: "Task",
    });
    expect(result).not.toBeNull();
    expect(result?.instruction.type).toBe("createTask");
  });

  it("dispatches 'updateTask' to buildUpdateTaskInstruction", () => {
    const result = buildActionInstruction("updateTask", {
      taskId: "t1",
      updates: { title: "New" },
    });
    expect(result).not.toBeNull();
    expect(result?.instruction.type).toBe("updateTask");
  });

  it("dispatches 'deleteTask' to buildDeleteTaskInstruction", () => {
    const result = buildActionInstruction("deleteTask", { taskId: "t1" });
    expect(result?.instruction.type).toBe("deleteTask");
  });

  it("dispatches 'moveTask' to buildMoveTaskInstruction", () => {
    const result = buildActionInstruction("moveTask", { taskId: "t1" });
    expect(result?.instruction.type).toBe("moveTask");
  });

  it("dispatches 'createBoard' to buildCreateBoardInstruction", () => {
    const result = buildActionInstruction("createBoard", { name: "Board" });
    expect(result?.instruction.type).toBe("createBoard");
  });

  it("dispatches 'updateBoard' to buildUpdateBoardInstruction", () => {
    const result = buildActionInstruction("updateBoard", {
      boardId: "b1",
      updates: { name: "X" },
    });
    expect(result?.instruction.type).toBe("updateBoard");
  });

  it("dispatches 'deleteBoard' to buildDeleteBoardInstruction", () => {
    const result = buildActionInstruction("deleteBoard", { boardId: "b1" });
    expect(result?.instruction.type).toBe("deleteBoard");
  });

  it("dispatches 'createTextBoard' to buildCreateTextBoardInstruction", () => {
    const result = buildActionInstruction("createTextBoard", {
      name: "Notes",
      content: "- [ ] a",
    });
    expect(result?.instruction.type).toBe("createTextBoard");
  });

  it("dispatches 'updateTextBoard' to buildUpdateTextBoardInstruction", () => {
    const result = buildActionInstruction("updateTextBoard", {
      textBoardId: "tb1",
      updates: { name: "X" },
    });
    expect(result?.instruction.type).toBe("updateTextBoard");
  });

  it("dispatches 'deleteTextBoard' to buildDeleteTextBoardInstruction", () => {
    const result = buildActionInstruction("deleteTextBoard", {
      textBoardId: "tb1",
    });
    expect(result?.instruction.type).toBe("deleteTextBoard");
  });

  it("dispatches 'createColumn' to buildCreateColumnInstruction", () => {
    const result = buildActionInstruction("createColumn", {
      boardId: "b1",
      name: "Col",
    });
    expect(result?.instruction.type).toBe("createColumn");
  });

  it("dispatches 'bulkUpdateTasks' to buildBulkUpdateTasksInstruction", () => {
    const result = buildActionInstruction("bulkUpdateTasks", {
      taskIds: ["t1"],
      updates: { priority: "low" },
    });
    expect(result?.instruction.type).toBe("bulkUpdateTasks");
  });

  it("dispatches 'bulkDeleteTasks' to buildBulkDeleteTasksInstruction", () => {
    const result = buildActionInstruction("bulkDeleteTasks", {
      taskIds: ["t1"],
    });
    expect(result?.instruction.type).toBe("bulkDeleteTasks");
  });

  it("returns null for unknown tool names", () => {
    const result = buildActionInstruction("unknownTool", {});
    expect(result).toBeNull();
  });

  it("returns null for empty string tool name", () => {
    const result = buildActionInstruction("", {});
    expect(result).toBeNull();
  });

  it("returns null for query tool names", () => {
    const result = buildActionInstruction("getWorkspaceOverview", {});
    expect(result).toBeNull();
  });
});
