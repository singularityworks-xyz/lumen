import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import {
  applyYjsToStateWithRepair,
  initializeYjsForWorkspace,
} from "@/src/features/collab/sync/state-sync";
import { repairState } from "@/src/features/collab/validation/fixer";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

function createYDocWithWorkspace(
  workspaceId: string,
  workspaceName: string,
  boardId: string,
  boardName: string
): Y.Doc {
  const doc = new Y.Doc();

  doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(workspaceId, {
    id: workspaceId,
    name: workspaceName,
    created_at: FROZEN_TIMESTAMP,
    board_ids: [boardId],
  });

  doc.getMap(YJS_MAP_NAMES.BOARDS).set(boardId, {
    id: boardId,
    name: boardName,
    workspace_id: workspaceId,
    column_ids: ["col-1"],
    created_by: "user-1",
    created_at: FROZEN_TIMESTAMP,
  });

  doc.getMap(YJS_MAP_NAMES.COLUMNS).set("col-1", {
    id: "col-1",
    board_id: boardId,
    name: "To Do",
    position: 0,
    task_ids: ["task-1"],
  });

  doc.getMap(YJS_MAP_NAMES.TASKS).set("task-1", {
    id: "task-1",
    title: "Test Task",
    board_id: boardId,
    column_id: "col-1",
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

  return doc;
}

describe("WEB-I-03: yjs-sync integration", () => {
  describe("seeded Y.Doc round-trips into local store without cross-workspace data loss", () => {
    it("syncs workspace, board, column, and task from Y.Doc", () => {
      const workspaceId = "ws-seeded";
      const boardId = "board-seeded";
      const doc = createYDocWithWorkspace(
        workspaceId,
        "Seeded Workspace",
        boardId,
        "Seeded Board"
      );

      const localState = createInitialState();
      const result = applyYjsToStateWithRepair(doc, localState, workspaceId);

      expect(result.workspaces?.byId[workspaceId]).toBeDefined();
      expect(result.workspaces?.byId[workspaceId]?.name).toBe(
        "Seeded Workspace"
      );

      expect(result.boards?.byId[boardId]).toBeDefined();
      expect(result.boards?.byId[boardId]?.name).toBe("Seeded Board");

      expect(result.columns?.byId["col-1"]).toBeDefined();
      expect(result.columns?.byId["col-1"]?.name).toBe("To Do");

      expect(result.tasks?.byId["task-1"]).toBeDefined();
      expect(result.tasks?.byId["task-1"]?.title).toBe("Test Task");
    });

    it("does not merge entities from different workspace into current", () => {
      const doc = new Y.Doc();
      const currentWsId = "ws-current";
      const otherWsId = "ws-other";

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(currentWsId, {
        id: currentWsId,
        name: "Current Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-current"],
      });

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(otherWsId, {
        id: otherWsId,
        name: "Other Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-other"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-current", {
        id: "board-current",
        name: "Current Board",
        workspace_id: currentWsId,
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-other", {
        id: "board-other",
        name: "Other Board",
        workspace_id: otherWsId,
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      });

      const localState = createInitialState();
      const result = applyYjsToStateWithRepair(doc, localState, currentWsId);

      expect(result.workspaces?.byId[currentWsId]).toBeDefined();
      expect(result.workspaces?.byId[otherWsId]).toBeUndefined();

      expect(result.boards?.byId["board-current"]).toBeDefined();
      expect(result.boards?.byId["board-other"]).toBeUndefined();
    });

    it("preserves local boards not in Yjs for current workspace", () => {
      const doc = createYDocWithWorkspace(
        "ws-1",
        "Workspace 1",
        "board-yjs",
        "YJS Board"
      );

      const localState = createInitialState();
      localState.boards.byId["board-local"] = {
        id: "board-local",
        name: "Local Board",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      localState.boards.allIds = ["board-local"];

      const result = applyYjsToStateWithRepair(doc, localState, "ws-1");

      expect(result.boards?.byId["board-yjs"]).toBeDefined();
      expect(result.boards?.byId["board-local"]).toBeDefined();
    });

    it("initializes Y.Doc with workspace-specific data only", () => {
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

      const ws1 = wsMap.get("ws-1") as Record<string, unknown>;
      expect(ws1?.name).toBe("Workspace 1");

      const board1 = boardsMap.get("board-1") as Record<string, unknown>;
      expect(board1?.name).toBe("Board 1");
    });
  });

  describe("delete propagation removes synced entities while preserving unrelated local data", () => {
    it("removes board deleted in Yjs from local state", () => {
      const doc = createYDocWithWorkspace(
        "ws-1",
        "Workspace",
        "board-1",
        "Board 1"
      );

      const localState = createInitialState();
      localState.boards.byId["board-1"] = {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: ["col-1"],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      localState.boards.allIds = ["board-1"];

      localState.columns.byId["col-1"] = {
        id: "col-1",
        board_id: "board-1",
        name: "Column 1",
        position: 0,
        task_ids: [],
      };
      localState.columns.allIds = ["col-1"];

      const syncedState = applyYjsToStateWithRepair(doc, localState, "ws-1");
      expect(syncedState.boards?.byId["board-1"]).toBeDefined();

      // Simulate deletion: remove board from workspace's board_ids AND delete from BOARDS
      // This is how deletion works in reality - same Y.Doc is modified
      const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      const currentWorkspace = workspaceMap.get("ws-1") as {
        id: string;
        name: string;
        created_at: string;
        board_ids: string[];
      };
      workspaceMap.set("ws-1", {
        ...currentWorkspace,
        board_ids: [],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).delete("board-1");

      const result = applyYjsToStateWithRepair(
        doc,
        syncedState as KanbanState,
        "ws-1"
      );

      expect(result.boards?.byId["board-1"]).toBeUndefined();
    });

    it("preserves local boards not in Yjs when other boards are deleted", () => {
      const doc = new Y.Doc();
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-1", {
        id: "ws-1",
        name: "Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-1"],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      });

      const localState = createInitialState();
      localState.boards.byId["board-1"] = {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      localState.boards.byId["board-local"] = {
        id: "board-local",
        name: "Local Board",
        workspace_id: "ws-1",
        column_ids: [],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      };
      localState.boards.allIds = ["board-1", "board-local"];

      // First sync with board-1 present
      const syncedState = applyYjsToStateWithRepair(doc, localState, "ws-1");

      // Simulate deletion: remove board-1 from workspace's board_ids AND delete from BOARDS
      const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      const currentWorkspace = workspaceMap.get("ws-1") as {
        id: string;
        name: string;
        created_at: string;
        board_ids: string[];
      };
      workspaceMap.set("ws-1", {
        ...currentWorkspace,
        board_ids: [],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).delete("board-1");

      const result = applyYjsToStateWithRepair(
        doc,
        syncedState as KanbanState,
        "ws-1"
      );

      expect(result.boards?.byId["board-1"]).toBeUndefined();
      expect(result.boards?.byId["board-local"]).toBeDefined();
    });

    it("removes task deleted in Yjs from local state", () => {
      const doc = new Y.Doc();
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-1", {
        id: "ws-1",
        name: "Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: ["board-1"],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        column_ids: ["col-1"],
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
      });
      doc.getMap(YJS_MAP_NAMES.COLUMNS).set("col-1", {
        id: "col-1",
        board_id: "board-1",
        name: "Column 1",
        position: 0,
        task_ids: ["task-1"],
      });
      doc.getMap(YJS_MAP_NAMES.TASKS).set("task-1", {
        id: "task-1",
        title: "Task 1",
        board_id: "board-1",
        column_id: "col-1",
        position: 0,
        priority: "medium",
        progress: 0,
        status: "todo",
        created_by: "user-1",
        created_at: FROZEN_TIMESTAMP,
        updated_at: FROZEN_TIMESTAMP,
      });

      const localState = createInitialState();
      localState.tasks.byId["task-1"] = {
        id: "task-1",
        title: "Task 1",
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
      localState.tasks.allIds = ["task-1"];

      // First sync with task-1 present
      applyYjsToStateWithRepair(doc, localState, "ws-1");

      // Simulate deletion: remove task-1 from column's task_ids AND delete from TASKS
      const columnMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
      const currentColumn = columnMap.get("col-1") as {
        id: string;
        board_id: string;
        name: string;
        position: number;
        task_ids: string[];
      };
      columnMap.set("col-1", {
        ...currentColumn,
        task_ids: [],
      });
      doc.getMap(YJS_MAP_NAMES.TASKS).delete("task-1");

      const result = applyYjsToStateWithRepair(doc, localState, "ws-1");

      expect(result.tasks?.byId["task-1"]).toBeUndefined();
    });
  });

  describe("state repair fixes data integrity issues", () => {
    it("repairs orphaned tasks referencing non-existent columns", () => {
      const doc = new Y.Doc();
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-1", {
        id: "ws-1",
        name: "Workspace",
        created_at: FROZEN_TIMESTAMP,
        board_ids: [],
      });

      const state: KanbanState = {
        ...createInitialState(),
        tasks: {
          byId: {
            "task-orphan": {
              id: "task-orphan",
              title: "Orphaned",
              board_id: "board-nonexistent",
              column_id: "col-nonexistent",
              position: 0,
              priority: "medium",
              progress: 0,
              status: "todo",
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
              updated_at: FROZEN_TIMESTAMP,
            },
          },
          allIds: ["task-orphan"],
        },
        columns: {
          byId: {},
          allIds: [],
        },
        boards: {
          byId: {},
          allIds: [],
        },
      };

      const repaired = repairState(state);

      expect(repaired.tasks.byId["task-orphan"]).toBeUndefined();
      expect(repaired.tasks.allIds).not.toContain("task-orphan");
    });

    it("repairs missing board positions", () => {
      const state: KanbanState = {
        ...createInitialState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "Board 1",
              workspace_id: "ws-1",
              column_ids: [],
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
            },
          },
          allIds: ["board-1"],
        },
        boardPositions: {
          byId: {},
          allIds: [],
        },
      };

      const repaired = repairState(state);

      expect(repaired.boardPositions.byId["board-1"]).toBeDefined();
      expect(repaired.boardPositions.byId["board-1"]?.id).toBe("board-1");
    });

    it("repairs column task_ids referencing non-existent tasks", () => {
      const state: KanbanState = {
        ...createInitialState(),
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "Column 1",
              position: 0,
              task_ids: ["task-1", "task-orphan"],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              title: "Task 1",
              board_id: "board-1",
              column_id: "col-1",
              position: 0,
              priority: "medium",
              progress: 0,
              status: "todo",
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
              updated_at: FROZEN_TIMESTAMP,
            },
          },
          allIds: ["task-1"],
        },
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "Board 1",
              workspace_id: "ws-1",
              column_ids: ["col-1"],
              created_by: "user-1",
              created_at: FROZEN_TIMESTAMP,
            },
          },
          allIds: ["board-1"],
        },
      };

      const repaired = repairState(state);

      expect(repaired.columns.byId["col-1"]?.task_ids).toEqual(["task-1"]);
    });
  });
});
