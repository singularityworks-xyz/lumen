// Set environment variables BEFORE any imports that use env.ts
process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

// Mock Y.Doc with a simple Map-based implementation
function createMockDoc() {
  const maps = new Map<string, Map<string, unknown>>();
  return {
    getMap<T = unknown>(name: string): Map<string, T> {
      if (!maps.has(name)) {
        maps.set(name, new Map());
      }
      return maps.get(name) as Map<string, T>;
    },
    transact(fn: () => void) {
      fn();
    },
  };
}

type MockDoc = ReturnType<typeof createMockDoc>;

// Use a global store that persists across mock evaluations
// This ensures mock.module can always access the latest state
const globalMockStore = (
  globalThis as unknown as {
    __mockStore__: { doc: MockDoc; returnNull: boolean } | undefined;
  }
).__mockStore__;

const mockState = globalMockStore ?? {
  doc: createMockDoc(),
  returnNull: false,
};

// Store reference globally so it survives module reloads
(globalThis as unknown as { __mockStore__: typeof mockState }).__mockStore__ =
  mockState;

// Set up mock BEFORE any imports that depend on it
// The factory function is evaluated once, but it closes over mockState
// which is a reference to the mutable state object
mock.module("./yjs-accessor", () => ({
  getWorkspaceYjsDoc: (_workspaceId: string) => {
    // Always read from the current state at call time
    if (mockState.returnNull) {
      return Promise.resolve(null);
    }
    return Promise.resolve(mockState.doc);
  },
  // Export logger to satisfy imports from executor files
  logger: {
    info: mock(() => {
      // No-op mock for info logs
    }),
    error: mock(() => {
      // No-op mock for error logs
    }),
    warn: mock(() => {
      // No-op mock for warn logs
    }),
    debug: mock(() => {
      // No-op mock for debug logs
    }),
  },
}));

// Access mock state through getter for dynamic updates
const mockDoc = () => mockState.doc;

// Executor functions - loaded dynamically AFTER mock setup
let executeBulkDeleteTasks: typeof import("./bulk-delete-tasks").executeBulkDeleteTasks;
let executeBulkUpdateTasks: typeof import("./bulk-update-tasks").executeBulkUpdateTasks;
let executeCreateBoard: typeof import("./create-board").executeCreateBoard;
let executeCreateColumn: typeof import("./create-column").executeCreateColumn;
let executeCreateTask: typeof import("./create-task").executeCreateTask;
let executeDeleteBoard: typeof import("./delete-board").executeDeleteBoard;
let executeDeleteTask: typeof import("./delete-task").executeDeleteTask;
let executeMoveTask: typeof import("./move-task").executeMoveTask;
let executeUpdateBoard: typeof import("./update-board").executeUpdateBoard;
let executeUpdateTask: typeof import("./update-task").executeUpdateTask;

// Load modules dynamically after mock setup
beforeAll(async () => {
  const bulkDeleteTasks = await import("./bulk-delete-tasks");
  const bulkUpdateTasks = await import("./bulk-update-tasks");
  const createBoard = await import("./create-board");
  const createColumn = await import("./create-column");
  const createTask = await import("./create-task");
  const deleteBoard = await import("./delete-board");
  const deleteTask = await import("./delete-task");
  const moveTask = await import("./move-task");
  const updateBoard = await import("./update-board");
  const updateTask = await import("./update-task");

  executeBulkDeleteTasks = bulkDeleteTasks.executeBulkDeleteTasks;
  executeBulkUpdateTasks = bulkUpdateTasks.executeBulkUpdateTasks;
  executeCreateBoard = createBoard.executeCreateBoard;
  executeCreateColumn = createColumn.executeCreateColumn;
  executeCreateTask = createTask.executeCreateTask;
  executeDeleteBoard = deleteBoard.executeDeleteBoard;
  executeDeleteTask = deleteTask.executeDeleteTask;
  executeMoveTask = moveTask.executeMoveTask;
  executeUpdateBoard = updateBoard.executeUpdateBoard;
  executeUpdateTask = updateTask.executeUpdateTask;
});

const baseCtx = {
  workspaceId: "ws-1",
  userId: "user-1",
  ephemeral: false,
};

const ephemeralCtx = { ...baseCtx, ephemeral: true };

function seedDoc(doc: MockDoc) {
  const workspaceMap = doc.getMap("workspace");
  const boardsMap = doc.getMap("boards");
  const columnsMap = doc.getMap("columns");
  const tasksMap = doc.getMap("tasks");
  const boardPositionsMap = doc.getMap("boardPositions");

  workspaceMap.set("data", {
    id: "ws-1",
    name: "Test Workspace",
    board_ids: ["board-1"],
  });

  boardsMap.set("board-1", {
    id: "board-1",
    name: "Board One",
    workspace_id: "ws-1",
    created_by: "user-1",
    created_at: "2023-01-01T00:00:00Z",
    column_ids: ["col-1", "col-2"],
  });

  columnsMap.set("col-1", {
    id: "col-1",
    board_id: "board-1",
    name: "To Do",
    position: 0,
    task_ids: ["task-1"],
  });

  columnsMap.set("col-2", {
    id: "col-2",
    board_id: "board-1",
    name: "Done",
    position: 1,
    task_ids: [],
  });

  tasksMap.set("task-1", {
    id: "task-1",
    board_id: "board-1",
    column_id: "col-1",
    title: "Task One",
    description: "Desc",
    priority: "medium",
    progress: 0,
    position: 0,
    due_date: null,
    created_by: "user-1",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    status: "todo",
  });

  boardPositionsMap.set("board-1", {
    id: "board-1",
    x: 100,
    y: 100,
    zIndex: 1,
  });
}

beforeEach(() => {
  // Update the shared state so the mock module sees the new values
  mockState.doc = createMockDoc();
  mockState.returnNull = false;
  seedDoc(mockState.doc);
});

// ─── create-task ───────────────────────────────────────────────
describe("executeCreateTask", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeCreateTask(
      { boardId: "board-1", columnId: "col-1", title: "New Task" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction).toBeDefined();
    expect(result.instruction?.type).toBe("createTask");
    expect(result.instruction?.columnId).toBe("col-1");
  });

  it("resolves columnId from snapshot in ephemeral mode", async () => {
    const ctx = {
      ...ephemeralCtx,
      snapshot: {
        name: "ws",
        boards: [
          {
            id: "board-1",
            name: "Board",
            columns: [{ id: "col-1", name: "To Do", position: 0, tasks: [] }],
          },
        ],
      },
    };
    const result = await executeCreateTask(
      { boardId: "board-1", title: "Test" },
      ctx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.columnId).toBe("col-1");
  });

  it("fails in ephemeral when no column resolved", async () => {
    const ctx = {
      ...ephemeralCtx,
      snapshot: {
        name: "ws",
        boards: [{ id: "board-1", name: "B", columns: [] }],
      },
    };
    const result = await executeCreateTask(
      { boardId: "board-1", title: "Test" },
      ctx
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Column ID is required");
  });

  it("creates task in non-ephemeral mode", async () => {
    const result = await executeCreateTask(
      { boardId: "board-1", columnId: "col-1", title: "New Task" },
      baseCtx
    );
    expect(result.success).toBe(true);
    const data = result.data as { taskId: string; title: string };
    expect(data.taskId).toBeDefined();
    expect(data.title).toBe("New Task");
  });

  it("uses first column when columnId not provided", async () => {
    const result = await executeCreateTask(
      { boardId: "board-1", title: "Auto Column" },
      baseCtx
    );
    expect(result.success).toBe(true);
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeCreateTask(
      { boardId: "board-1", title: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });

  it("fails when board not found", async () => {
    const result = await executeCreateTask(
      { boardId: "nonexistent", title: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("fails when board has no columns", async () => {
    const boardsMap = mockDoc().getMap("boards");
    boardsMap.set("empty-board", {
      id: "empty-board",
      name: "Empty",
      workspace_id: "ws-1",
      created_by: "user-1",
      created_at: "2023-01-01",
      column_ids: [],
    });
    const result = await executeCreateTask(
      { boardId: "empty-board", title: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board has no columns");
  });

  it("fails when column does not belong to board", async () => {
    const columnsMap = mockDoc().getMap("columns");
    columnsMap.set("orphan-col", {
      id: "orphan-col",
      board_id: "other-board",
      name: "Orphan",
      position: 0,
      task_ids: [],
    });
    const boardsMap = mockDoc().getMap("boards");
    const board = boardsMap.get("board-1") as Record<string, unknown>;
    boardsMap.set("board-1", {
      ...board,
      column_ids: [...(board.column_ids as string[]), "orphan-col"],
    });

    const result = await executeCreateTask(
      { boardId: "board-1", columnId: "orphan-col", title: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Column does not belong to board");
  });
});

// ─── create-column ─────────────────────────────────────────────
describe("executeCreateColumn", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeCreateColumn(
      { boardId: "board-1", name: "New Col" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("createColumn");
    expect(result.instruction?.name).toBe("New Col");
  });

  it("creates column in Yjs doc", async () => {
    const result = await executeCreateColumn(
      { boardId: "board-1", name: "New Column" },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { columnId: string }).columnId).toBeDefined();
    expect((result.data as { name: string }).name).toBe("New Column");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeCreateColumn(
      { boardId: "board-1", name: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });

  it("fails when board not found", async () => {
    const result = await executeCreateColumn(
      { boardId: "nonexistent", name: "Fail" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });
});

// ─── create-board ──────────────────────────────────────────────
describe("executeCreateBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeCreateBoard(
      { name: "New Board" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("createBoard");
    expect(result.instruction?.name).toBe("New Board");
  });

  it("creates board with default columns", async () => {
    const result = await executeCreateBoard({ name: "New Board" }, baseCtx);
    expect(result.success).toBe(true);
    const data = result.data as { boardId: string; name: string };
    expect(data.boardId).toBeDefined();
    expect(data.name).toBe("New Board");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeCreateBoard({ name: "Fail" }, baseCtx);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });
});

// ─── update-task ───────────────────────────────────────────────
describe("executeUpdateTask", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeUpdateTask(
      { taskId: "task-1", updates: { title: "Updated" } },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("updateTask");
  });

  it("updates task title", async () => {
    const result = await executeUpdateTask(
      { taskId: "task-1", updates: { title: "Updated Title" } },
      baseCtx
    );
    expect(result.success).toBe(true);
    const tasksMap = mockDoc().getMap("tasks");
    const task = tasksMap.get("task-1") as Record<string, unknown>;
    expect(task.title).toBe("Updated Title");
  });

  it("updates task priority", async () => {
    await executeUpdateTask(
      { taskId: "task-1", updates: { priority: "high" } },
      baseCtx
    );
    const tasksMap = mockDoc().getMap("tasks");
    const task = tasksMap.get("task-1") as Record<string, unknown>;
    expect(task.priority).toBe("high");
  });

  it("maps urgent priority to high", async () => {
    await executeUpdateTask(
      { taskId: "task-1", updates: { priority: "urgent" } },
      baseCtx
    );
    const tasksMap = mockDoc().getMap("tasks");
    const task = tasksMap.get("task-1") as Record<string, unknown>;
    expect(task.priority).toBe("high");
  });

  it("fails when task not found", async () => {
    const result = await executeUpdateTask(
      { taskId: "nonexistent", updates: { title: "Fail" } },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeUpdateTask(
      { taskId: "task-1", updates: { title: "Fail" } },
      baseCtx
    );
    expect(result.success).toBe(false);
  });
});

// ─── update-board ──────────────────────────────────────────────
describe("executeUpdateBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeUpdateBoard(
      { boardId: "board-1", updates: { name: "Updated" } },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("updateBoard");
  });

  it("updates board name", async () => {
    const result = await executeUpdateBoard(
      { boardId: "board-1", updates: { name: "New Name" } },
      baseCtx
    );
    expect(result.success).toBe(true);
    const boardsMap = mockDoc().getMap("boards");
    const board = boardsMap.get("board-1") as Record<string, unknown>;
    expect(board.name).toBe("New Name");
  });

  it("fails when board not found", async () => {
    const result = await executeUpdateBoard(
      { boardId: "nonexistent", updates: { name: "Fail" } },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeUpdateBoard(
      { boardId: "board-1", updates: { name: "Fail" } },
      baseCtx
    );
    expect(result.success).toBe(false);
  });
});

// ─── move-task ─────────────────────────────────────────────────
describe("executeMoveTask", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeMoveTask(
      { taskId: "task-1", columnId: "col-2" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("moveTask");
  });

  it("moves task to different column", async () => {
    const result = await executeMoveTask(
      { taskId: "task-1", columnId: "col-2" },
      baseCtx
    );
    expect(result.success).toBe(true);
    const tasksMap = mockDoc().getMap("tasks");
    const task = tasksMap.get("task-1") as Record<string, unknown>;
    expect(task.column_id).toBe("col-2");
  });

  it("fails when task not found", async () => {
    const result = await executeMoveTask(
      { taskId: "nonexistent", columnId: "col-2" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("fails when target column not found", async () => {
    const result = await executeMoveTask(
      { taskId: "task-1", columnId: "nonexistent" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Target column not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeMoveTask(
      { taskId: "task-1", columnId: "col-2" },
      baseCtx
    );
    expect(result.success).toBe(false);
  });
});

// ─── delete-task ───────────────────────────────────────────────
describe("executeDeleteTask", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeDeleteTask({ taskId: "task-1" }, ephemeralCtx);
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("deleteTask");
  });

  it("deletes task from Yjs doc", async () => {
    const result = await executeDeleteTask({ taskId: "task-1" }, baseCtx);
    expect(result.success).toBe(true);
    const tasksMap = mockDoc().getMap("tasks");
    expect(tasksMap.has("task-1")).toBe(false);
  });

  it("removes task from column task_ids", async () => {
    await executeDeleteTask({ taskId: "task-1" }, baseCtx);
    const columnsMap = mockDoc().getMap("columns");
    const col = columnsMap.get("col-1") as Record<string, unknown>;
    expect((col.task_ids as string[]).includes("task-1")).toBe(false);
  });

  it("fails when task not found", async () => {
    const result = await executeDeleteTask({ taskId: "nonexistent" }, baseCtx);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Task not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeDeleteTask({ taskId: "task-1" }, baseCtx);
    expect(result.success).toBe(false);
  });
});

// ─── delete-board ──────────────────────────────────────────────
describe("executeDeleteBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeDeleteBoard(
      { boardId: "board-1" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("deleteBoard");
  });

  it("deletes board and associated data", async () => {
    const result = await executeDeleteBoard({ boardId: "board-1" }, baseCtx);
    expect(result.success).toBe(true);
    expect(mockDoc().getMap("boards").has("board-1")).toBe(false);
    expect(mockDoc().getMap("boardPositions").has("board-1")).toBe(false);
    expect(mockDoc().getMap("columns").has("col-1")).toBe(false);
    expect(mockDoc().getMap("tasks").has("task-1")).toBe(false);
  });

  it("updates workspace board_ids", async () => {
    await executeDeleteBoard({ boardId: "board-1" }, baseCtx);
    const workspaceMap = mockDoc().getMap("workspace");
    const wsData = workspaceMap.get("data") as { board_ids?: string[] };
    expect(wsData.board_ids?.includes("board-1")).toBe(false);
  });

  it("fails when board not found", async () => {
    const result = await executeDeleteBoard(
      { boardId: "nonexistent" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Board not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeDeleteBoard({ boardId: "board-1" }, baseCtx);
    expect(result.success).toBe(false);
  });
});

// ─── bulk-update-tasks ─────────────────────────────────────────
describe("executeBulkUpdateTasks", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeBulkUpdateTasks(
      { taskIds: ["task-1"], updates: { priority: "high" } },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("bulkUpdateTasks");
  });

  it("updates multiple tasks", async () => {
    const tasksMap = mockDoc().getMap("tasks");
    tasksMap.set("task-2", {
      id: "task-2",
      board_id: "board-1",
      column_id: "col-1",
      title: "Task Two",
      priority: "low",
      progress: 0,
      position: 1,
      created_by: "user-1",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      status: "todo",
    });

    const result = await executeBulkUpdateTasks(
      { taskIds: ["task-1", "task-2"], updates: { priority: "high" } },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { updatedCount: number }).updatedCount).toBe(2);
  });

  it("skips non-existent tasks", async () => {
    const result = await executeBulkUpdateTasks(
      { taskIds: ["task-1", "nonexistent"], updates: { priority: "high" } },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { updatedCount: number }).updatedCount).toBe(1);
  });

  it("maps urgent priority to high", async () => {
    await executeBulkUpdateTasks(
      { taskIds: ["task-1"], updates: { priority: "urgent" } },
      baseCtx
    );
    const tasksMap = mockDoc().getMap("tasks");
    const task = tasksMap.get("task-1") as Record<string, unknown>;
    expect(task.priority).toBe("high");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeBulkUpdateTasks(
      { taskIds: ["task-1"], updates: { priority: "high" } },
      baseCtx
    );
    expect(result.success).toBe(false);
  });
});

// ─── bulk-delete-tasks ─────────────────────────────────────────
describe("executeBulkDeleteTasks", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeBulkDeleteTasks(
      { taskIds: ["task-1"] },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("bulkDeleteTasks");
  });

  it("deletes multiple tasks", async () => {
    const tasksMap = mockDoc().getMap("tasks");
    tasksMap.set("task-2", {
      id: "task-2",
      board_id: "board-1",
      column_id: "col-1",
      title: "Task Two",
      priority: "medium",
      progress: 0,
      position: 1,
      created_by: "user-1",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      status: "todo",
    });

    const result = await executeBulkDeleteTasks(
      { taskIds: ["task-1", "task-2"] },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { deletedCount: number }).deletedCount).toBe(2);
    expect(tasksMap.has("task-1")).toBe(false);
    expect(tasksMap.has("task-2")).toBe(false);
  });

  it("removes deleted tasks from column task_ids", async () => {
    await executeBulkDeleteTasks({ taskIds: ["task-1"] }, baseCtx);
    const columnsMap = mockDoc().getMap("columns");
    const col = columnsMap.get("col-1") as Record<string, unknown>;
    expect((col.task_ids as string[]).includes("task-1")).toBe(false);
  });

  it("skips non-existent tasks", async () => {
    const result = await executeBulkDeleteTasks(
      { taskIds: ["task-1", "nonexistent"] },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { deletedCount: number }).deletedCount).toBe(1);
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeBulkDeleteTasks(
      { taskIds: ["task-1"] },
      baseCtx
    );
    expect(result.success).toBe(false);
  });
});

afterAll(() => {
  mock.restore();
});
