import { describe, expect, it, mock } from "bun:test";

// Mock all executor imports
mock.module("@lumen/ai/tools", () => ({
  requiresConfirmation: (name: string) => name === "deleteBoard",
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
}));

mock.module("./executors/create-task", () => ({
  executeCreateTask: mock(() =>
    Promise.resolve({ success: true, data: { taskId: "new" } })
  ),
}));
mock.module("./executors/update-task", () => ({
  executeUpdateTask: mock(() =>
    Promise.resolve({ success: true, data: { updated: true } })
  ),
}));
mock.module("./executors/delete-task", () => ({
  executeDeleteTask: mock(() =>
    Promise.resolve({ success: true, data: { deleted: true } })
  ),
}));
mock.module("./executors/move-task", () => ({
  executeMoveTask: mock(() =>
    Promise.resolve({ success: true, data: { moved: true } })
  ),
}));
mock.module("./executors/create-board", () => ({
  executeCreateBoard: mock(() =>
    Promise.resolve({ success: true, data: { boardId: "new" } })
  ),
}));
mock.module("./executors/update-board", () => ({
  executeUpdateBoard: mock(() =>
    Promise.resolve({ success: true, data: { updated: true } })
  ),
}));
mock.module("./executors/delete-board", () => ({
  executeDeleteBoard: mock(() =>
    Promise.resolve({ success: true, data: { deleted: true } })
  ),
}));
mock.module("./executors/create-column", () => ({
  executeCreateColumn: mock(() =>
    Promise.resolve({ success: true, data: { columnId: "new" } })
  ),
}));
mock.module("./executors/bulk-update-tasks", () => ({
  executeBulkUpdateTasks: mock(() =>
    Promise.resolve({ success: true, data: { count: 5 } })
  ),
}));
mock.module("./executors/bulk-delete-tasks", () => ({
  executeBulkDeleteTasks: mock(() =>
    Promise.resolve({ success: true, data: { count: 3 } })
  ),
}));

import { executeTool, executeToolDirect } from "./tool-executor";

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

    it("executes non-confirmation tools directly", async () => {
      const result = await executeTool(
        "createTask",
        { title: "Test" },
        baseCtx
      );
      expect(result.success).toBe(true);
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
    it("executes updateTask action tool", async () => {
      const result = await executeToolDirect(
        "updateTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes deleteTask action tool", async () => {
      const result = await executeToolDirect(
        "deleteTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes moveTask action tool", async () => {
      const result = await executeToolDirect(
        "moveTask",
        { taskId: "t-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes createBoard action tool", async () => {
      const result = await executeToolDirect(
        "createBoard",
        { name: "Board" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes updateBoard action tool", async () => {
      const result = await executeToolDirect(
        "updateBoard",
        { boardId: "b-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes deleteBoard action directly", async () => {
      const result = await executeToolDirect(
        "deleteBoard",
        { boardId: "b-1" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes createColumn action tool", async () => {
      const result = await executeToolDirect(
        "createColumn",
        { boardId: "b-1", name: "Col" },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes bulkUpdateTasks action tool", async () => {
      const result = await executeToolDirect(
        "bulkUpdateTasks",
        { taskIds: ["t-1"] },
        baseCtx
      );
      expect(result.success).toBe(true);
    });

    it("executes bulkDeleteTasks action tool", async () => {
      const result = await executeToolDirect(
        "bulkDeleteTasks",
        { taskIds: ["t-1"] },
        baseCtx
      );
      expect(result.success).toBe(true);
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
        { title: "Test" },
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
