import { beforeEach, describe, expect, it, mock } from "bun:test";
import { executeActionInstruction } from "./action-executor";

const mockStore = {
  boards: {
    byId: {} as Record<string, any>,
  },
  tasks: {
    byId: {} as Record<string, any>,
  },
  addTask: mock(() => "new-task-id"),
  updateTask: mock(() => undefined),
  deleteTask: mock(() => undefined),
  moveTask: mock(() => undefined),
  addBoard: mock(() => "new-board-id"),
  updateBoard: mock(() => undefined),
  removeBoard: mock(() => undefined),
  addColumn: mock(() => "new-col-id"),
  bulkUpdateTasks: mock(() => undefined),
  bulkDeleteTasks: mock(() => undefined),
};

beforeEach(() => {
  mockStore.boards.byId = {};
  mockStore.tasks.byId = {};
  mockStore.addTask.mockClear();
  mockStore.updateTask.mockClear();
  mockStore.deleteTask.mockClear();
  mockStore.moveTask.mockClear();
  mockStore.addBoard.mockClear();
  mockStore.updateBoard.mockClear();
  mockStore.removeBoard.mockClear();
  mockStore.addColumn.mockClear();
  mockStore.bulkUpdateTasks.mockClear();
  mockStore.bulkDeleteTasks.mockClear();
});

describe("executeActionInstruction", () => {
  it("creates a task", () => {
    mockStore.boards.byId["board-1"] = {
      column_ids: ["col-1", "col-2"],
      name: "Board",
    };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createTask",
        boardId: "board-1",
        columnId: "col-1",
        title: "New Task",
      } as any
    );
    expect(result).toBe('Created task "New Task"');
    expect(mockStore.addTask).toHaveBeenCalledWith(
      "col-1",
      "board-1",
      "New Task",
      expect.any(Object)
    );
  });

  it("creates a task using first column when no columnId", () => {
    mockStore.boards.byId["board-1"] = {
      column_ids: ["col-first"],
      name: "Board",
    };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createTask",
        boardId: "board-1",
        title: "Task",
      } as any
    );
    expect(result).toBe('Created task "Task"');
    expect(mockStore.addTask).toHaveBeenCalledWith(
      "col-first",
      "board-1",
      "Task",
      expect.any(Object)
    );
  });

  it("fails to create task when board not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createTask",
        boardId: "missing",
        title: "Task",
      } as any
    );
    expect(result).toBe("Failed to create task: board not found");
  });

  it("fails to create task when board has no columns", () => {
    mockStore.boards.byId["board-1"] = { column_ids: [], name: "Board" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createTask",
        boardId: "board-1",
        title: "Task",
      } as any
    );
    expect(result).toBe("Failed to create task: no columns in board");
  });

  it("updates a task", () => {
    mockStore.tasks.byId["task-1"] = { title: "Old Title" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "updateTask",
        taskId: "task-1",
        updates: { title: "New Title" },
      } as any
    );
    expect(result).toBe('Updated task "Old Title"');
    expect(mockStore.updateTask).toHaveBeenCalled();
  });

  it("fails to update task when not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "updateTask",
        taskId: "missing",
        updates: {},
      } as any
    );
    expect(result).toBe("Failed to update task: task not found");
  });

  it("deletes a task", () => {
    mockStore.tasks.byId["task-1"] = { title: "Task" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "deleteTask",
        taskId: "task-1",
      } as any
    );
    expect(result).toBe('Deleted task "Task"');
    expect(mockStore.deleteTask).toHaveBeenCalledWith("task-1");
  });

  it("fails to delete task when not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "deleteTask",
        taskId: "missing",
      } as any
    );
    expect(result).toBe("Failed to delete task: task not found");
  });

  it("moves a task", () => {
    mockStore.tasks.byId["task-1"] = {
      title: "Task",
      column_id: "col-1",
      board_id: "board-1",
    };
    mockStore.boards.byId["board-1"] = { column_ids: ["col-1", "col-2"] };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "moveTask",
        taskId: "task-1",
        columnId: "col-2",
      } as any
    );
    expect(result).toBe('Moved task "Task"');
    expect(mockStore.moveTask).toHaveBeenCalled();
  });

  it("fails to move task when not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "moveTask",
        taskId: "missing",
      } as any
    );
    expect(result).toBe("Failed to move task: task not found");
  });

  it("creates a board", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createBoard",
        name: "New Board",
      } as any
    );
    expect(result).toBe('Created board "New Board"');
    expect(mockStore.addBoard).toHaveBeenCalled();
  });

  it("updates a board", () => {
    mockStore.boards.byId["board-1"] = { name: "Old Board" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "updateBoard",
        boardId: "board-1",
        updates: { name: "New Board" },
      } as any
    );
    expect(result).toBe('Updated board "Old Board"');
  });

  it("fails to update board when not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "updateBoard",
        boardId: "missing",
        updates: {},
      } as any
    );
    expect(result).toBe("Failed to update board: board not found");
  });

  it("deletes a board", () => {
    mockStore.boards.byId["board-1"] = { name: "Board" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "deleteBoard",
        boardId: "board-1",
      } as any
    );
    expect(result).toBe('Deleted board "Board"');
    expect(mockStore.removeBoard).toHaveBeenCalledWith("board-1");
  });

  it("fails to delete board when not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "deleteBoard",
        boardId: "missing",
      } as any
    );
    expect(result).toBe("Failed to delete board: board not found");
  });

  it("creates a column", () => {
    mockStore.boards.byId["board-1"] = { name: "Board" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createColumn",
        boardId: "board-1",
        name: "New Column",
      } as any
    );
    expect(result).toBe('Created column "New Column" in board "Board"');
    expect(mockStore.addColumn).toHaveBeenCalled();
  });

  it("fails to create column when board not found", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "createColumn",
        boardId: "missing",
        name: "Col",
      } as any
    );
    expect(result).toBe("Failed to create column: board not found");
  });

  it("bulk updates tasks", () => {
    mockStore.tasks.byId.t1 = { title: "T1" };
    mockStore.tasks.byId.t2 = { title: "T2" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "bulkUpdateTasks",
        taskIds: ["t1", "t2", "missing"],
        updates: { priority: "high" },
      } as any
    );
    expect(result).toBe("Updated 2 tasks");
    expect(mockStore.bulkUpdateTasks).toHaveBeenCalledWith(
      ["t1", "t2"],
      expect.any(Object)
    );
  });

  it("fails bulk update when no valid tasks", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "bulkUpdateTasks",
        taskIds: ["missing"],
        updates: {},
      } as any
    );
    expect(result).toBe("Failed to update tasks: no valid tasks found");
  });

  it("bulk deletes tasks", () => {
    mockStore.tasks.byId.t1 = { title: "T1" };
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "bulkDeleteTasks",
        taskIds: ["t1", "missing"],
      } as any
    );
    expect(result).toBe("Deleted 1 tasks");
    expect(mockStore.bulkDeleteTasks).toHaveBeenCalledWith(["t1"]);
  });

  it("fails bulk delete when no valid tasks", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "bulkDeleteTasks",
        taskIds: ["missing"],
      } as any
    );
    expect(result).toBe("Failed to delete tasks: no valid tasks found");
  });

  it("returns message for unknown action type", () => {
    const result = executeActionInstruction(
      mockStore as any,
      {
        type: "unknownAction",
      } as any
    );
    expect(result).toBe("Unknown action type: unknownAction");
  });
});
