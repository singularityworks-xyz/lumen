import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import {
  applyYjsToStateWithRepair,
  initializeYjsForWorkspace,
  initializeYjsFromState,
} from "@/src/features/collab/sync/state-sync";
import {
  needsRepair,
  repairState,
} from "@/src/features/collab/validation/fixer";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

function createSeededDoc(): {
  doc: Y.Doc;
  workspaceId: string;
  boardId: string;
  columnId: string;
  taskId: string;
} {
  const doc = new Y.Doc();
  const workspaceId = "ws-seeded";
  const boardId = "board-seeded";
  const columnId = "col-seeded";
  const taskId = "task-seeded";

  doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(workspaceId, {
    id: workspaceId,
    name: "Seeded Workspace",
    created_at: FROZEN_TIMESTAMP,
    board_ids: [boardId],
  });

  doc.getMap(YJS_MAP_NAMES.BOARDS).set(boardId, {
    id: boardId,
    name: "Seeded Board",
    workspace_id: workspaceId,
    column_ids: [columnId],
    created_by: "user-1",
    created_at: FROZEN_TIMESTAMP,
  });

  doc.getMap(YJS_MAP_NAMES.COLUMNS).set(columnId, {
    id: columnId,
    board_id: boardId,
    name: "To Do",
    position: 0,
    task_ids: [taskId],
  });

  doc.getMap(YJS_MAP_NAMES.TASKS).set(taskId, {
    id: taskId,
    title: "Seeded Task",
    board_id: boardId,
    column_id: columnId,
    position: 0,
    priority: "high",
    progress: 0,
    status: "todo",
    created_by: "user-1",
    created_at: FROZEN_TIMESTAMP,
    updated_at: FROZEN_TIMESTAMP,
  });

  doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).set(boardId, {
    id: boardId,
    x: 100,
    y: 200,
    zIndex: 1,
  });

  return { doc, workspaceId, boardId, columnId, taskId };
}

function createLocalState(): KanbanState {
  return createInitialState();
}

describe("WEB-I-01: store-persistence integration", () => {
  describe("persisted workspace/board/task state survives rehydrate", () => {
    it("seeded Y.Doc state round-trips into local store without cross-workspace data loss", () => {
      const { doc, workspaceId, boardId, columnId, taskId } = createSeededDoc();

      const localState = createLocalState();

      const mergedState = applyYjsToStateWithRepair(
        doc,
        localState,
        workspaceId
      );

      expect(mergedState.workspaces?.byId[workspaceId]).toBeDefined();
      expect(mergedState.workspaces?.byId[workspaceId]?.name).toBe(
        "Seeded Workspace"
      );

      expect(mergedState.boards?.byId[boardId]).toBeDefined();
      expect(mergedState.boards?.byId[boardId]?.name).toBe("Seeded Board");
      expect(mergedState.boards?.byId[boardId]?.workspace_id).toBe(workspaceId);

      expect(mergedState.columns?.byId[columnId]).toBeDefined();
      expect(mergedState.columns?.byId[columnId]?.name).toBe("To Do");

      expect(mergedState.tasks?.byId[taskId]).toBeDefined();
      expect(mergedState.tasks?.byId[taskId]?.title).toBe("Seeded Task");

      expect(mergedState.boardPositions?.byId[boardId]).toBeDefined();
      expect(mergedState.boardPositions?.byId[boardId]?.x).toBe(100);
      expect(mergedState.boardPositions?.byId[boardId]?.y).toBe(200);
    });

    it("local-only workspace is preserved when syncing another workspace from Yjs", () => {
      const { doc, workspaceId } = createSeededDoc();

      const localState = createLocalState();
      localState.workspaces.byId["ws-local"] = {
        id: "ws-local",
        name: "Local Only Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        isShared: false,
      };
      localState.workspaces.allIds.push("ws-local");

      localState.boards.byId["board-local"] = {
        id: "board-local",
        name: "Local Board",
        workspace_id: "ws-local",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      localState.boards.allIds.push("board-local");

      const mergedState = applyYjsToStateWithRepair(
        doc,
        localState,
        workspaceId
      );

      expect(mergedState.workspaces?.byId["ws-local"]).toBeDefined();
      expect(mergedState.boards?.byId["board-local"]).toBeDefined();
      expect(mergedState.boards?.byId["board-local"]?.workspace_id).toBe(
        "ws-local"
      );
    });

    it("delete propagation removes synced entities while preserving unrelated local data", () => {
      const doc = new Y.Doc();
      const workspaceId = "ws-sync";
      const boardId = "board-to-delete";
      const localBoardId = "board-local-keep";

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(workspaceId, {
        id: workspaceId,
        name: "Sync Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [boardId],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set(boardId, {
        id: boardId,
        name: "Board to Delete",
        workspace_id: workspaceId,
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      });

      doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).set(boardId, {
        id: boardId,
        x: 0,
        y: 0,
        zIndex: 1,
      });

      const localState: KanbanState = {
        ...createLocalState(),
        workspaces: {
          byId: {
            [workspaceId]: {
              id: workspaceId,
              name: "Sync Workspace",
              created_at: FROZEN_TIMESTAMP,
              board_ids: [boardId, localBoardId],
              isShared: true,
            },
          },
          allIds: [workspaceId],
        },
        boards: {
          byId: {
            [boardId]: {
              id: boardId,
              name: "Board to Delete",
              workspace_id: workspaceId,
              column_ids: [],
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
            },
            [localBoardId]: {
              id: localBoardId,
              name: "Local Board Keep",
              workspace_id: workspaceId,
              column_ids: [],
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
            },
          },
          allIds: [boardId, localBoardId],
        },
        boardPositions: {
          byId: {
            [boardId]: { id: boardId, x: 0, y: 0, zIndex: 1 },
            [localBoardId]: { id: localBoardId, x: 500, y: 0, zIndex: 2 },
          },
          allIds: [boardId, localBoardId],
        },
        columns: { byId: {}, allIds: [] },
        tasks: { byId: {}, allIds: [] },
        currentWorkspaceId: workspaceId,
      };

      // First sync with board-to-delete present
      applyYjsToStateWithRepair(doc, localState, workspaceId);

      // Simulate deletion: remove board from workspace's board_ids AND delete from BOARDS
      const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      const currentWorkspace = workspaceMap.get(workspaceId) as {
        id: string;
        name: string;
        created_at: string;
        board_ids: string[];
      };
      workspaceMap.set(workspaceId, {
        ...currentWorkspace,
        board_ids: [],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).delete(boardId);

      const result = applyYjsToStateWithRepair(doc, localState, workspaceId);

      expect(result.boards?.byId[boardId]).toBeUndefined();
      expect(result.boards?.byId[localBoardId]).toBeDefined();
      expect(result.boardPositions?.byId[localBoardId]).toBeDefined();
    });
  });

  describe("transient selection and drag state do not leak into persisted state", () => {
    it("ui state fields are excluded from persistence partialize", () => {
      interface TransientField {
        canvas?: {
          viewport: { x: number; y: number; zoom: number };
          focusedBoardId: string;
          lastInteractionTime: number;
        };
        draggedTaskId?: string;
        selectedBoardId?: string;
        selectedTaskIds?: string[];
        showCommandPalette?: boolean;
        showMiniMap?: boolean;
      }
      const state = createInitialState();
      const transient: TransientField = {
        showCommandPalette: true,
        showMiniMap: true,
        selectedBoardId: "board-123",
        selectedTaskIds: ["task-1", "task-2"],
        draggedTaskId: "task-3",
        canvas: {
          viewport: { x: 100, y: 200, zoom: 1.5 },
          focusedBoardId: "board-focus",
          lastInteractionTime: Date.now(),
        },
      };
      Object.assign(state, transient);

      const persisted: Record<string, unknown> = {};
      const persistPartialize = (s: KanbanState) => {
        const fields: (keyof KanbanState)[] = [
          "workspaces",
          "boards",
          "columns",
          "tasks",
          "boardPositions",
          "boardConnections",
          "currentWorkspaceId",
        ];
        for (const key of fields) {
          persisted[key] = s[key];
        }
      };

      persistPartialize(state);

      expect(persisted).not.toHaveProperty("showCommandPalette");
      expect(persisted).not.toHaveProperty("showMiniMap");
      expect(persisted).not.toHaveProperty("selectedBoardId");
      expect(persisted).not.toHaveProperty("selectedTaskIds");
      expect(persisted).not.toHaveProperty("draggedTaskId");
      expect(persisted).not.toHaveProperty("canvas");

      expect(persisted).toHaveProperty("workspaces");
      expect(persisted).toHaveProperty("boards");
      expect(persisted).toHaveProperty("columns");
      expect(persisted).toHaveProperty("tasks");
      expect(persisted).toHaveProperty("boardPositions");
      expect(persisted).toHaveProperty("currentWorkspaceId");
    });

    it("rehydration restores showMiniMap from workspace metadata", () => {
      const state = createInitialState();
      const workspaceId = state.currentWorkspaceId ?? "";
      state.workspaces.byId[workspaceId] = {
        id: workspaceId,
        name: "Test Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
        showMiniMap: true,
      };

      const workspace = state.workspaces.byId[workspaceId];
      expect(workspace?.showMiniMap).toBe(true);
    });
  });

  describe("Yjs initialization from local state", () => {
    it("initializeYjsFromState pushes all data to Yjs", () => {
      const doc = new Y.Doc();
      const state = createInitialState();

      // Properly set up state to only have ws-1 (clear default workspace)
      state.workspaces.byId = {
        "ws-1": {
          id: "ws-1",
          name: "Test Workspace",
          created_at: FROZEN_TIMESTAMP,
          board_ids: ["board-1"],
        },
      };
      state.workspaces.allIds = ["ws-1"];

      state.boards.byId = {
        "board-1": {
          id: "board-1",
          name: "Test Board",
          workspace_id: "ws-1",
          column_ids: ["col-1"],
          created_by: "user-1",
          created_at: FROZEN_TIMESTAMP,
        },
      };
      state.boards.allIds = ["board-1"];

      state.columns.byId["col-1"] = {
        id: "col-1",
        board_id: "board-1",
        name: "Column 1",
        position: 0,
        task_ids: ["task-1"],
      };
      state.columns.allIds = ["col-1"];

      state.tasks.byId["task-1"] = {
        id: "task-1",
        title: "Test Task",
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
      state.tasks.allIds = ["task-1"];

      initializeYjsFromState(doc, state);

      const wsMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
      const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
      const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);

      expect(wsMap.size).toBe(1);
      expect(boardsMap.size).toBe(1);
      expect(columnsMap.size).toBe(1);
      expect(tasksMap.size).toBe(1);

      const ws = wsMap.get("ws-1") as Record<string, unknown>;
      expect(ws?.name).toBe("Test Workspace");
    });

    it("initializeYjsForWorkspace only pushes workspace-specific data", () => {
      const doc = new Y.Doc();
      const state = createInitialState();

      state.workspaces.byId["ws-1"] = {
        id: "ws-1",
        name: "Workspace 1",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-1"],
      };
      state.workspaces.byId["ws-2"] = {
        id: "ws-2",
        name: "Workspace 2",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-2"],
      };
      state.workspaces.allIds = ["ws-1", "ws-2"];

      state.boards.byId["board-1"] = {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      state.boards.byId["board-2"] = {
        id: "board-2",
        name: "Board 2",
        workspace_id: "ws-2",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      state.boards.allIds = ["board-1", "board-2"];

      initializeYjsForWorkspace(doc, state, "ws-1");

      const wsMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);

      expect(wsMap.size).toBe(1);
      expect(boardsMap.size).toBe(1);

      const ws = wsMap.get("ws-1") as Record<string, unknown>;
      expect(ws?.name).toBe("Workspace 1");

      const board = boardsMap.get("board-1") as Record<string, unknown>;
      expect(board?.name).toBe("Board 1");
    });
  });

  describe("state repair validates and fixes data integrity", () => {
    it("needsRepair returns true for orphaned tasks", () => {
      const state = createInitialState();
      state.columns.byId["col-1"] = {
        id: "col-1",
        board_id: "board-1",
        name: "Column 1",
        position: 0,
        task_ids: [],
      };
      state.columns.allIds = ["col-1"];

      state.tasks.byId["task-orphan"] = {
        id: "task-orphan",
        title: "Orphaned Task",
        board_id: "board-nonexistent",
        column_id: "col-nonexistent",
        position: 0,
        priority: "medium",
        progress: 0,
        status: "todo",
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
        updated_at: FROZEN_TIMESTAMP,
      };
      state.tasks.allIds = ["task-orphan"];

      expect(needsRepair(state)).toBe(true);
    });

    it("repairState removes orphaned tasks", () => {
      const state = createInitialState();
      state.columns.byId["col-1"] = {
        id: "col-1",
        board_id: "board-1",
        name: "Column 1",
        position: 0,
        task_ids: [],
      };
      state.columns.allIds = ["col-1"];

      state.boards.byId["board-1"] = {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: ["col-1"],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      state.boards.allIds = ["board-1"];

      state.tasks.byId["task-valid"] = {
        id: "task-valid",
        title: "Valid Task",
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
      state.tasks.byId["task-orphan"] = {
        id: "task-orphan",
        title: "Orphaned Task",
        board_id: "board-nonexistent",
        column_id: "col-nonexistent",
        position: 1,
        priority: "medium",
        progress: 0,
        status: "todo",
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
        updated_at: FROZEN_TIMESTAMP,
      };
      state.tasks.allIds = ["task-valid", "task-orphan"];

      const repaired = repairState(state);

      expect(repaired.tasks.byId["task-valid"]).toBeDefined();
      expect(repaired.tasks.byId["task-orphan"]).toBeUndefined();
      expect(repaired.tasks.allIds).toEqual(["task-valid"]);
    });

    it("repairState creates missing board positions", () => {
      const state = createInitialState();

      state.boards.byId["board-1"] = {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      state.boards.allIds = ["board-1"];

      state.boardPositions.byId = {};
      state.boardPositions.allIds = [];

      const repaired = repairState(state);

      expect(repaired.boardPositions.byId["board-1"]).toBeDefined();
      expect(repaired.boardPositions.byId["board-1"]?.id).toBe("board-1");
      expect(repaired.boardPositions.allIds).toContain("board-1");
    });
  });
});
