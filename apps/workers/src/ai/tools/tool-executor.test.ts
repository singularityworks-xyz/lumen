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
const globalMockStore = (
  globalThis as unknown as {
    __yjsMockStore__: { doc: MockDoc; returnNull: boolean } | undefined;
  }
).__yjsMockStore__;

const mockState = globalMockStore ?? {
  doc: createMockDoc(),
  returnNull: false,
};

// Store reference globally so it survives module reloads
(
  globalThis as unknown as { __yjsMockStore__: typeof mockState }
).__yjsMockStore__ = mockState;

// Set up mock BEFORE any imports that depend on it
mock.module("./executors/yjs-accessor", () => ({
  getWorkspaceYjsDoc: (_workspaceId: string) => {
    if (mockState.returnNull) {
      return Promise.resolve(null);
    }
    return Promise.resolve(mockState.doc);
  },
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

// Mock query executors and utilities from @lumen/ai/tools
mock.module("@lumen/ai/tools", () => ({
  requiresConfirmation: (name: string) =>
    name === "deleteBoard" || name === "deleteTextBoard",
  executeGetWorkspaceOverview: mock(() =>
    Promise.resolve({ success: true, data: { overview: true } })
  ),
  executeGetBoardDetails: mock(() =>
    Promise.resolve({ success: true, data: { board: true } })
  ),
  executeGetTaskDetails: mock(() =>
    Promise.resolve({ success: true, data: { task: true } })
  ),
  executeSearchTasks: mock(() =>
    Promise.resolve({ success: true, data: { results: [] } })
  ),
  buildActionInstruction: mock(() => ({
    instruction: { type: "createTask" },
    message: "Task created",
  })),
  mapPriority: (priority: string | undefined) => {
    if (priority === "urgent") {
      return "high";
    }
    if (priority === "high" || priority === "medium" || priority === "low") {
      return priority;
    }
    return "medium";
  },
  getWorkspaceFromSnapshot: mock(() => null),
}));

// Module under test - loaded dynamically after mock setup
let executeTool: typeof import("./tool-executor").executeTool;
let executeToolDirect: typeof import("./tool-executor").executeToolDirect;

// Import the module under test AFTER setting up mocks
beforeAll(async () => {
  const toolExecutor = await import("./tool-executor");
  executeTool = toolExecutor.executeTool;
  executeToolDirect = toolExecutor.executeToolDirect;
});

const baseCtx = {
  workspaceId: "ws-1",
  userId: "user-1",
  ephemeral: false,
};

describe("tool-executor", () => {
  describe("executeTool", () => {
    it("returns requiresConfirmation for deleteBoard", async () => {
      const result = await executeTool("deleteBoard", {}, baseCtx);
      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
    });

    it("returns requiresConfirmation for deleteTextBoard", async () => {
      const result = await executeTool("deleteTextBoard", {}, baseCtx);
      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
    });

    it("executes getWorkspaceOverview query tool", async () => {
      const result = await executeTool("getWorkspaceOverview", {}, baseCtx);
      expect(result.success).toBe(true);
    });

    it("executes getBoardDetails query tool", async () => {
      const result = await executeTool(
        "getBoardDetails",
        { boardId: "b-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes getTaskDetails query tool", async () => {
      const result = await executeTool(
        "getTaskDetails",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes searchTasks query tool", async () => {
      const result = await executeTool(
        "searchTasks",
        { query: "test" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("returns error for unknown tool", async () => {
      const result = await executeTool("nonExistentTool", {}, baseCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });
  });

  describe("executeToolDirect", () => {
    beforeEach(() => {
      // Reset the mock state before each test
      mockState.doc = createMockDoc();
      mockState.returnNull = false;

      // Seed the mock doc with basic data
      const boardsMap = mockState.doc.getMap("boards");
      const columnsMap = mockState.doc.getMap("columns");
      const tasksMap = mockState.doc.getMap("tasks");
      const workspaceMap = mockState.doc.getMap("workspace");

      workspaceMap.set("data", {
        id: "ws-1",
        name: "Test Workspace",
        board_ids: ["b-1"],
      });

      boardsMap.set("b-1", {
        id: "b-1",
        name: "Board One",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2023-01-01T00:00:00Z",
        column_ids: ["col-1"],
      });

      columnsMap.set("col-1", {
        id: "col-1",
        board_id: "b-1",
        name: "To Do",
        position: 0,
        task_ids: ["t-1"],
      });

      tasksMap.set("t-1", {
        id: "t-1",
        board_id: "b-1",
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
    });

    it("executes createTask action tool", async () => {
      const result = await executeToolDirect(
        "createTask",
        { title: "Test", boardId: "b-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes updateTask action tool", async () => {
      const result = await executeToolDirect(
        "updateTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes deleteTask action tool", async () => {
      const result = await executeToolDirect(
        "deleteTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes moveTask action tool", async () => {
      const result = await executeToolDirect(
        "moveTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes createBoard action tool", async () => {
      const result = await executeToolDirect(
        "createBoard",
        { name: "Board" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes updateBoard action tool", async () => {
      const result = await executeToolDirect(
        "updateBoard",
        { boardId: "b-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes deleteBoard action directly", async () => {
      const result = await executeToolDirect(
        "deleteBoard",
        { boardId: "b-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes createTextBoard action tool", async () => {
      const result = await executeToolDirect(
        "createTextBoard",
        { name: "Notes", content: "- [ ] a" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes updateTextBoard action tool", async () => {
      mockState.doc.getMap("textBoards").set("tb-1", {
        id: "tb-1",
        workspace_id: "ws-1",
        name: "Notes",
        created_by: "user-1",
        created_at: "2023-01-01T00:00:00Z",
      });
      const result = await executeToolDirect(
        "updateTextBoard",
        { textBoardId: "tb-1", updates: { name: "X" } },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes deleteTextBoard action directly", async () => {
      mockState.doc.getMap("textBoards").set("tb-1", {
        id: "tb-1",
        workspace_id: "ws-1",
        name: "Notes",
        created_by: "user-1",
        created_at: "2023-01-01T00:00:00Z",
      });
      const result = await executeToolDirect(
        "deleteTextBoard",
        { textBoardId: "tb-1" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes createColumn action tool", async () => {
      const result = await executeToolDirect(
        "createColumn",
        { boardId: "b-1", name: "Col" },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes bulkUpdateTasks action tool", async () => {
      const result = await executeToolDirect(
        "bulkUpdateTasks",
        { taskIds: ["t-1"] },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("executes bulkDeleteTasks action tool", async () => {
      const result = await executeToolDirect(
        "bulkDeleteTasks",
        { taskIds: ["t-1"] },
        baseCtx
      );
      expect(result).toBeDefined();
    });

    it("returns error for unknown action tool", async () => {
      const result = await executeToolDirect("unknownAction", {}, baseCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });

    it("handles ephemeral mode for action tools", async () => {
      const ephemeralCtx = { ...baseCtx, ephemeral: true };
      const result = await executeToolDirect(
        "createTask",
        { title: "Test", boardId: "b-1" },
        ephemeralCtx
      );
      expect(result.success).toBe(true);
      expect(
        (result.data as { actionInstruction: unknown })?.actionInstruction
      ).toBeDefined();
    });

    it("returns error for unknown action in ephemeral mode", async () => {
      const ephemeralCtx = { ...baseCtx, ephemeral: true };
      const result = await executeToolDirect("unknownAction", {}, ephemeralCtx);
      expect(result.success).toBe(false);
    });
  });
});

afterAll(() => {
  mock.restore();
});
