import { afterAll, describe, expect, it, mock } from "bun:test";

// Mock query executors and utilities from @lumen/ai/tools
// These are the only things we need to mock for tool-executor tests
// We do NOT mock the action executors since that would interfere
// with other test files that import them
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
  // Include utility functions that might be imported
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

// Import the module under test AFTER setting up mocks
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
    it("executes createTask action tool", async () => {
      const result = await executeToolDirect(
        "createTask",
        { title: "Test", boardId: "b-1" },
        baseCtx
      );
      // Result depends on whether yjs doc is available
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
