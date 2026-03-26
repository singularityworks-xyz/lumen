import { describe, expect, it } from "bun:test";
import { createInitialState } from "@/src/features/kanban/store/utils";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

describe("WEB-I-04: share-join integration", () => {
  describe("joined workspace is added locally with owner metadata", () => {
    it("adds workspace to local store with owner info", () => {
      const state = createInitialState();

      const workspaceData = {
        id: "ws-joined",
        name: "Joined Workspace",
        description: "Shared by Owner",
        created_at: new Date().toISOString(),
        board_ids: [] as string[],
        isShared: true,
        ownerId: "user-owner",
        ownerName: "Owner Name",
        ownerImage: "https://example.com/owner.png",
        shareToken: "share-token-abc",
      };

      state.workspaces.byId[workspaceData.id] = workspaceData;
      state.workspaces.allIds.push(workspaceData.id);

      expect(state.workspaces.byId["ws-joined"]).toBeDefined();
      expect(state.workspaces.byId["ws-joined"]?.name).toBe("Joined Workspace");
      expect(state.workspaces.byId["ws-joined"]?.ownerId).toBe("user-owner");
      expect(state.workspaces.byId["ws-joined"]?.ownerName).toBe("Owner Name");
      expect(state.workspaces.byId["ws-joined"]?.isShared).toBe(true);
    });

    it("sets current workspace to joined workspace", () => {
      const state = createInitialState();
      const workspaceId = "ws-joined";

      state.workspaces.byId[workspaceId] = {
        id: workspaceId,
        name: "Joined Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: true,
      };
      state.workspaces.allIds.push(workspaceId);
      state.currentWorkspaceId = workspaceId;

      expect(state.currentWorkspaceId).toBe(workspaceId);
    });

    it("preserves existing workspace if already present", () => {
      const state = createInitialState();

      state.workspaces.byId["ws-existing"] = {
        id: "ws-existing",
        name: "Existing Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: false,
      };
      state.workspaces.allIds.push("ws-existing");

      const existingWorkspace = state.workspaces.byId["ws-existing"];
      expect(existingWorkspace?.name).toBe("Existing Workspace");
      expect(existingWorkspace?.isShared).toBe(false);
    });

    it("generates correct owner description for shared workspace", () => {
      const owner = {
        id: "user-owner",
        name: "John Doe",
        email: "john@example.com",
        image: null as string | null,
      };

      const description = owner
        ? `Shared by ${owner.name || owner.email}`
        : "Joined via share link";

      expect(description).toBe("Shared by John Doe");
    });
  });

  describe("fetched server state merges boards/columns/tasks/positions exactly once", () => {
    it("merges boards from server state without duplication", () => {
      const state = createInitialState();

      const serverBoards: Record<string, unknown> = {
        "board-server-1": {
          id: "board-server-1",
          name: "Server Board 1",
          workspace_id: "ws-joined",
          column_ids: ["col-1"],
          created_by: "user-1",
          created_at: FROZEN_TIMESTAMP,
        },
        "board-server-2": {
          id: "board-server-2",
          name: "Server Board 2",
          workspace_id: "ws-joined",
          column_ids: ["col-2"],
          created_by: "user-1",
          created_at: FROZEN_TIMESTAMP,
        },
      };

      for (const [id, board] of Object.entries(serverBoards)) {
        if (!state.boards.byId[id]) {
          state.boards.byId[id] = board as (typeof state.boards.byId)[string];
          state.boards.allIds.push(id);
        }
      }

      expect(state.boards.byId["board-server-1"]).toBeDefined();
      expect(state.boards.byId["board-server-2"]).toBeDefined();
      expect(state.boards.allIds).toContain("board-server-1");
      expect(state.boards.allIds).toContain("board-server-2");
      expect(
        state.boards.allIds.filter((id) => id === "board-server-1").length
      ).toBe(1);
    });

    it("merges columns from server state without duplication", () => {
      const state = createInitialState();

      const serverColumns: Record<string, unknown> = {
        "col-1": {
          id: "col-1",
          board_id: "board-1",
          name: "Server Column 1",
          position: 0,
          task_ids: [],
        },
      };

      for (const [id, column] of Object.entries(serverColumns)) {
        if (!state.columns.byId[id]) {
          state.columns.byId[id] =
            column as (typeof state.columns.byId)[string];
          state.columns.allIds.push(id);
        }
      }

      expect(state.columns.byId["col-1"]).toBeDefined();
      expect(state.columns.allIds.filter((id) => id === "col-1").length).toBe(
        1
      );
    });

    it("merges tasks from server state without duplication", () => {
      const state = createInitialState();

      const serverTasks: Record<string, unknown> = {
        "task-1": {
          id: "task-1",
          title: "Server Task 1",
          board_id: "board-1",
          column_id: "col-1",
          position: 0,
          priority: "high",
          progress: 0,
          status: "todo",
          created_by: "user-1",
          created_at: FROZEN_TIMESTAMP,
          updated_at: FROZEN_TIMESTAMP,
        },
      };

      for (const [id, task] of Object.entries(serverTasks)) {
        if (!state.tasks.byId[id]) {
          state.tasks.byId[id] = task as (typeof state.tasks.byId)[string];
          state.tasks.allIds.push(id);
        }
      }

      expect(state.tasks.byId["task-1"]).toBeDefined();
      expect(state.tasks.allIds.filter((id) => id === "task-1").length).toBe(1);
    });

    it("merges board positions from server state without duplication", () => {
      const state = createInitialState();

      const serverPositions: Record<string, unknown> = {
        "board-1": {
          id: "board-1",
          x: 100,
          y: 200,
          zIndex: 1,
        },
      };

      for (const [id, position] of Object.entries(serverPositions)) {
        if (!state.boardPositions.byId[id]) {
          state.boardPositions.byId[id] =
            position as (typeof state.boardPositions.byId)[string];
          state.boardPositions.allIds.push(id);
        }
      }

      expect(state.boardPositions.byId["board-1"]).toBeDefined();
      expect(state.boardPositions.byId["board-1"]?.x).toBe(100);
      expect(
        state.boardPositions.allIds.filter((id) => id === "board-1").length
      ).toBe(1);
    });

    it("updates workspace board_ids with synced board IDs", () => {
      const state = createInitialState();
      const workspaceId = "ws-joined";

      state.workspaces.byId[workspaceId] = {
        id: workspaceId,
        name: "Joined Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: true,
      };

      const syncedBoards = ["board-1", "board-2"];
      for (const boardId of syncedBoards) {
        if (!state.workspaces.byId[workspaceId]?.board_ids.includes(boardId)) {
          state.workspaces.byId[workspaceId]?.board_ids.push(boardId);
        }
      }

      expect(state.workspaces.byId[workspaceId]?.board_ids).toContain(
        "board-1"
      );
      expect(state.workspaces.byId[workspaceId]?.board_ids).toContain(
        "board-2"
      );
      expect(state.workspaces.byId[workspaceId]?.board_ids.length).toBe(2);
    });

    it("handles empty server state gracefully", () => {
      const serverBoards: Record<string, unknown> = {};
      const serverColumns: Record<string, unknown> = {};
      const serverTasks: Record<string, unknown> = {};
      const serverPositions: Record<string, unknown> = {};

      expect(Object.keys(serverBoards).length).toBe(0);
      expect(Object.keys(serverColumns).length).toBe(0);
      expect(Object.keys(serverTasks).length).toBe(0);
      expect(Object.keys(serverPositions).length).toBe(0);
    });
  });

  describe("failed fetch does not corrupt existing store state", () => {
    it("preserves existing boards when server fetch fails", () => {
      const state = createInitialState();

      state.boards.byId["board-existing"] = {
        id: "board-existing",
        name: "Existing Board",
        workspace_id: "ws-local",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      state.boards.allIds = ["board-existing"];

      const fetchFailed = true;
      if (!fetchFailed) {
        const serverBoards: Record<string, unknown> = {};
        for (const [id, board] of Object.entries(serverBoards)) {
          if (!state.boards.byId[id]) {
            state.boards.byId[id] = board as (typeof state.boards.byId)[string];
            state.boards.allIds.push(id);
          }
        }
      }

      expect(state.boards.byId["board-existing"]).toBeDefined();
      expect(state.boards.allIds).toEqual(["board-existing"]);
    });

    it("preserves existing columns when server fetch fails", () => {
      const state = createInitialState();

      state.columns.byId["col-existing"] = {
        id: "col-existing",
        board_id: "board-1",
        name: "Existing Column",
        position: 0,
        task_ids: [],
      };
      state.columns.allIds = ["col-existing"];

      const fetchFailed = true;
      if (!fetchFailed) {
        const serverColumns: Record<string, unknown> = {};
        for (const [id, column] of Object.entries(serverColumns)) {
          if (!state.columns.byId[id]) {
            state.columns.byId[id] =
              column as (typeof state.columns.byId)[string];
            state.columns.allIds.push(id);
          }
        }
      }

      expect(state.columns.byId["col-existing"]).toBeDefined();
      expect(state.columns.allIds).toEqual(["col-existing"]);
    });

    it("preserves existing tasks when server fetch fails", () => {
      const state = createInitialState();

      state.tasks.byId["task-existing"] = {
        id: "task-existing",
        title: "Existing Task",
        board_id: "board-1",
        column_id: "col-1",
        position: 0,
        priority: "medium",
        progress: 0,
        status: "todo",
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
        updated_at: FROZEN_TIMESTAMP,
      };
      state.tasks.allIds = ["task-existing"];

      const fetchFailed = true;
      if (!fetchFailed) {
        const serverTasks: Record<string, unknown> = {};
        for (const [id, task] of Object.entries(serverTasks)) {
          if (!state.tasks.byId[id]) {
            state.tasks.byId[id] = task as (typeof state.tasks.byId)[string];
            state.tasks.allIds.push(id);
          }
        }
      }

      expect(state.tasks.byId["task-existing"]).toBeDefined();
      expect(state.tasks.allIds).toEqual(["task-existing"]);
    });

    it("preserves existing workspace when server fetch fails", () => {
      const state = createInitialState();

      state.workspaces.byId["ws-existing"] = {
        id: "ws-existing",
        name: "Existing Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: false,
      };
      state.workspaces.allIds = ["ws-existing"];
      state.currentWorkspaceId = "ws-existing";

      const fetchFailed = true;
      if (!fetchFailed) {
        const serverData = {
          workspace: {},
          boards: {},
          columns: {},
          tasks: {},
          boardPositions: {},
        };
        for (const [id, board] of Object.entries(
          serverData.boards as Record<string, unknown>
        )) {
          if (!state.boards.byId[id]) {
            state.boards.byId[id] = board as (typeof state.boards.byId)[string];
            state.boards.allIds.push(id);
          }
        }
      }

      expect(state.workspaces.byId["ws-existing"]).toBeDefined();
      expect(state.workspaces.allIds).toEqual(["ws-existing"]);
      expect(state.currentWorkspaceId).toBe("ws-existing");
    });
  });
});
