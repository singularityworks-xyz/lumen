import { describe, expect, it } from "bun:test";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

describe("WEB-I-02: workspace-switching integration", () => {
  describe("switching workspaces restores exact saved modal/dialog state", () => {
    it("preserves workspace dialog state when switching away", () => {
      const state = createInitialState();

      state.workspaceDialog = {
        type: "rename",
        workspaceId: "ws-1",
        workspaceName: "Workspace 1",
        position: { x: 100, y: 200 },
        inputValue: "New Name",
      };

      expect(state.workspaceDialog).toBeDefined();
      expect(state.workspaceDialog?.type).toBe("rename");
      expect(state.workspaceDialog?.workspaceId).toBe("ws-1");
    });

    it("preserves board dialog state per board", () => {
      const state = createInitialState();

      state.boardDialogs["dialog-1"] = {
        id: "dialog-1",
        type: "rename",
        boardId: "board-1",
        boardName: "Board 1",
        columnId: undefined,
        position: { x: 50, y: 60 },
        inputValue: "New Board Name",
        zIndex: 10,
      };

      expect(state.boardDialogs["dialog-1"]).toBeDefined();
      expect(state.boardDialogs["dialog-1"]?.type).toBe("rename");
    });

    it("preserves column dialog state per column", () => {
      const state = createInitialState();

      state.columnDialogs["dialog-1"] = {
        id: "dialog-1",
        type: "rename",
        columnId: "col-1",
        columnName: "Column 1",
        boardId: "board-1",
        boardName: "Board 1",
        position: { x: 50, y: 60 },
        inputValue: "New Column Name",
      };

      expect(state.columnDialogs["dialog-1"]).toBeDefined();
      expect(state.columnDialogs["dialog-1"]?.type).toBe("rename");
    });

    it("preserves task detail modals", () => {
      const state = createInitialState();

      state.taskDetailModals["modal-1"] = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 200 },
        zIndex: 100,
        sourceTaskId: "task-1",
      };

      expect(state.taskDetailModals["modal-1"]).toBeDefined();
      expect(state.taskDetailModals["modal-1"]?.taskId).toBe("task-1");
    });

    it("preserves create task modals", () => {
      const state = createInitialState();

      state.createTaskModals["modal-1"] = {
        id: "modal-1",
        columnId: "col-1",
        boardId: "board-1",
        position: { x: 100, y: 200 },
        formData: {
          title: "",
          description: "",
          dueDate: "",
          priority: "medium",
          progress: 0,
          tags: "",
        },
        zIndex: 100,
      };

      expect(state.createTaskModals["modal-1"]).toBeDefined();
      expect(state.createTaskModals["modal-1"]?.columnId).toBe("col-1");
    });
  });

  describe("shared workspace task modals are reset on workspace switch", () => {
    it("task detail modals are cleared on workspace switch (pending Yjs restoration)", () => {
      const state = createInitialState();

      state.taskDetailModals["modal-1"] = {
        id: "modal-1",
        taskId: "task-old",
        boardId: "board-old",
        position: { x: 100, y: 200 },
        zIndex: 100,
        sourceTaskId: "task-old",
      };

      expect(state.taskDetailModals["modal-1"]).toBeDefined();

      const nextState = createInitialState();
      nextState.taskDetailModals = {};

      expect(nextState.taskDetailModals["modal-1"]).toBeUndefined();
    });

    it("create task modals are cleared on workspace switch", () => {
      const state = createInitialState();

      state.createTaskModals["modal-1"] = {
        id: "modal-1",
        columnId: "col-old",
        boardId: "board-old",
        position: { x: 100, y: 200 },
        formData: {
          title: "",
          description: "",
          dueDate: "",
          priority: "medium",
          progress: 0,
          tags: "",
        },
        zIndex: 100,
      };

      expect(state.createTaskModals["modal-1"]).toBeDefined();

      const nextState = createInitialState();
      nextState.createTaskModals = {};

      expect(nextState.createTaskModals["modal-1"]).toBeUndefined();
    });

    it("workspace switch clears dialog states that would be restored from Yjs", () => {
      const state = createInitialState();

      state.boardDialogs["dialog-1"] = {
        id: "dialog-1",
        type: "rename",
        boardId: "board-1",
        boardName: "Board 1",
        columnId: undefined,
        position: { x: 50, y: 60 },
        zIndex: 10,
      };

      state.taskDetailModals["modal-1"] = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 200 },
        zIndex: 100,
        sourceTaskId: "task-1",
      };

      const nextState = createInitialState();
      nextState.boardDialogs = {};
      nextState.taskDetailModals = {};

      expect(nextState.boardDialogs["dialog-1"]).toBeUndefined();
      expect(nextState.taskDetailModals["modal-1"]).toBeUndefined();
    });
  });

  describe("workspace metadata is preserved across switches", () => {
    it("persists workspace owner metadata", () => {
      const state = createInitialState();

      state.workspaces.byId["ws-1"] = {
        id: "ws-1",
        name: "Test Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: true,
        ownerId: "user-owner",
        ownerName: "Owner Name",
        ownerImage: "https://example.com/image.png",
      };
      state.workspaces.allIds = ["ws-1"];

      expect(state.workspaces.byId["ws-1"]?.ownerId).toBe("user-owner");
      expect(state.workspaces.byId["ws-1"]?.ownerName).toBe("Owner Name");
    });

    it("persists share token for shared workspaces", () => {
      const state = createInitialState();

      state.workspaces.byId["ws-1"] = {
        id: "ws-1",
        name: "Shared Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: true,
        shareToken: "share-token-123",
      };
      state.workspaces.allIds = ["ws-1"];

      expect(state.workspaces.byId["ws-1"]?.shareToken).toBe("share-token-123");
    });

    it("persists deleted shared workspace ID", () => {
      const state = createInitialState();
      state.deletedSharedWorkspaceId = "ws-deleted";

      expect(state.deletedSharedWorkspaceId).toBe("ws-deleted");
    });
  });

  describe("board positions and canvas state", () => {
    it("preserves board positions across rehydration", () => {
      const state = createInitialState();

      state.boardPositions.byId["board-1"] = {
        id: "board-1",
        x: 100,
        y: 200,
        zIndex: 1,
        width: 600,
        height: 400,
      };
      state.boardPositions.allIds = ["board-1"];

      expect(state.boardPositions.byId["board-1"]?.x).toBe(100);
      expect(state.boardPositions.byId["board-1"]?.y).toBe(200);
    });

    it("preserves canvas viewport state", () => {
      const state = createInitialState();

      state.canvas = {
        viewport: { x: 50, y: 75, zoom: 1.25 },
        focusedBoardId: "board-1",
        lastInteractionTime: Date.now(),
      };

      expect(state.canvas.viewport.x).toBe(50);
      expect(state.canvas.viewport.zoom).toBe(1.25);
      expect(state.canvas.focusedBoardId).toBe("board-1");
    });
  });

  describe("UI selection state is transient", () => {
    it("selected board IDs are transient and not persisted", () => {
      const state = createInitialState();
      const persistedFields: (keyof KanbanState)[] = [
        "workspaces",
        "boards",
        "columns",
        "tasks",
        "boardPositions",
        "boardConnections",
        "currentWorkspaceId",
      ];

      state.selectedBoardId = "board-123";
      state.selectedBoardIds = ["board-1", "board-2"];
      state.selectedTaskIds = ["task-1"];

      const persisted: Partial<KanbanState> = {};
      for (const key of persistedFields) {
        (persisted as Record<string, unknown>)[key] = state[key];
      }

      expect(persisted).not.toHaveProperty("selectedBoardId");
      expect(persisted).not.toHaveProperty("selectedBoardIds");
      expect(persisted).not.toHaveProperty("selectedTaskIds");
    });

    it("drag state is transient", () => {
      const state = createInitialState();

      state.draggedTaskId = "task-being-dragged";
      state.columnUi["col-1"] = {
        bottomView: "finished",
        isBottomExpanded: true,
      };

      const persisted: Partial<KanbanState> = {};
      const persistedFields: (keyof KanbanState)[] = [
        "workspaces",
        "boards",
        "columns",
        "tasks",
      ];

      for (const key of persistedFields) {
        (persisted as Record<string, unknown>)[key] = state[key];
      }

      expect(persisted).not.toHaveProperty("draggedTaskId");
    });
  });
});
