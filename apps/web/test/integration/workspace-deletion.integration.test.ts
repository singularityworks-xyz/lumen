import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import {
  applyYjsToStateWithRepair,
  initializeYjsForWorkspace,
} from "@/src/features/collab/sync/state-sync";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";

const TS = "2024-01-15T00:00:00.000Z";

// Use unique IDs per invocation to avoid METADATA collision.
let _wsDelCounter = 0;
function nextWsId(): string {
  _wsDelCounter += 1;
  return `ws-del-target-${_wsDelCounter}`;
}

// Build a fully populated workspace with boards, columns, tasks,
// board positions, and comments. All entity IDs are unique per invocation.
interface FullWorkspaceIds {
  b1: string;
  b2: string;
  c1a: string;
  c1b: string;
  c2a: string;
  t1: string;
  t2: string;
  t3: string;
  t4: string;
}

function createFullWorkspaceState(workspaceId: string): {
  state: KanbanState;
  ids: FullWorkspaceIds;
} {
  const n = _wsDelCounter;
  const ids: FullWorkspaceIds = {
    b1: `board-1-${n}`,
    b2: `board-2-${n}`,
    c1a: `col-1a-${n}`,
    c1b: `col-1b-${n}`,
    c2a: `col-2a-${n}`,
    t1: `task-1-${n}`,
    t2: `task-2-${n}`,
    t3: `task-3-${n}`,
    t4: `task-4-${n}`,
  };

  const state = createInitialState();

  state.workspaces.byId[workspaceId] = {
    id: workspaceId,
    name: "Target Workspace",
    created_at: TS,
    board_ids: [ids.b1, ids.b2],
  };
  state.workspaces.allIds.push(workspaceId);

  // Board 1 with 2 columns and 3 tasks
  state.boards.byId[ids.b1] = {
    id: ids.b1,
    name: "Board One",
    workspace_id: workspaceId,
    column_ids: [ids.c1a, ids.c1b],
    created_by: "user-1",
    created_at: TS,
  };
  state.boards.allIds.push(ids.b1);

  state.columns.byId[ids.c1a] = {
    id: ids.c1a,
    board_id: ids.b1,
    name: "To Do",
    position: 0,
    task_ids: [ids.t1, ids.t2],
  };
  state.columns.byId[ids.c1b] = {
    id: ids.c1b,
    board_id: ids.b1,
    name: "Done",
    position: 1,
    task_ids: [ids.t3],
  };
  state.columns.allIds.push(ids.c1a, ids.c1b);

  for (const [i, taskId] of [ids.t1, ids.t2, ids.t3].entries()) {
    const colId = i < 2 ? ids.c1a : ids.c1b;
    state.tasks.byId[taskId] = {
      id: taskId,
      title: `Task ${i + 1}`,
      board_id: ids.b1,
      column_id: colId,
      position: i < 2 ? i : 0,
      priority: "medium",
      progress: 0,
      status: "todo",
      created_by: "user-1",
      created_at: TS,
      updated_at: TS,
    };
    state.tasks.allIds.push(taskId);
  }

  // Board 2 with 1 column and 1 task
  state.boards.byId[ids.b2] = {
    id: ids.b2,
    name: "Board Two",
    workspace_id: workspaceId,
    column_ids: [ids.c2a],
    created_by: "user-1",
    created_at: TS,
  };
  state.boards.allIds.push(ids.b2);

  state.columns.byId[ids.c2a] = {
    id: ids.c2a,
    board_id: ids.b2,
    name: "Backlog",
    position: 0,
    task_ids: [ids.t4],
  };
  state.columns.allIds.push(ids.c2a);

  state.tasks.byId[ids.t4] = {
    id: ids.t4,
    title: "Task 4",
    board_id: ids.b2,
    column_id: ids.c2a,
    position: 0,
    priority: "low",
    progress: 0,
    status: "todo",
    created_by: "user-1",
    created_at: TS,
    updated_at: TS,
  };
  state.tasks.allIds.push(ids.t4);

  // Board positions
  state.boardPositions.byId[ids.b1] = { id: ids.b1, x: 100, y: 100, zIndex: 1 };
  state.boardPositions.byId[ids.b2] = { id: ids.b2, x: 800, y: 100, zIndex: 2 };
  state.boardPositions.allIds.push(ids.b1, ids.b2);

  return { state, ids };
}

/**
 * Perform a two-phase sync to establish metadata tracking.
 * Phase 1: Initialize Y.Doc from state, then apply → state1 (establishes metadata)
 * Phase 2: Mutate Y.Doc, apply again → state2 (deletion detected)
 */
function initAndSync(
  state: KanbanState,
  wsId: string
): { doc: Y.Doc; syncedState: KanbanState } {
  const doc = new Y.Doc();
  initializeYjsForWorkspace(doc, state, wsId);

  // First sync — this writes METADATA so future syncs can detect deletions
  const syncedState = applyYjsToStateWithRepair(
    doc,
    state,
    wsId
  ) as KanbanState;

  return { doc, syncedState };
}

// ─── Workspace Deletion Cascade ────────────────────────────────

describe("WEB-I-WSDEL: Workspace deletion cascade", () => {
  describe("full cascade deletion via Y.Doc", () => {
    it("removes all boards, columns, tasks, positions when deleted from Y.Doc", () => {
      const wsId = nextWsId();
      const { state, ids } = createFullWorkspaceState(wsId);
      const { doc, syncedState } = initAndSync(state, wsId);

      // Verify initial sync populated everything
      expect(syncedState.boards?.byId[ids.b1]).toBeDefined();
      expect(syncedState.boards?.byId[ids.b2]).toBeDefined();
      expect(syncedState.tasks?.byId[ids.t1]).toBeDefined();
      expect(syncedState.tasks?.byId[ids.t4]).toBeDefined();

      // Simulate full workspace deletion in Y.Doc
      doc.transact(() => {
        doc.getMap(YJS_MAP_NAMES.BOARDS).delete(ids.b1);
        doc.getMap(YJS_MAP_NAMES.BOARDS).delete(ids.b2);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1a);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1b);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c2a);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t1);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t2);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t3);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t4);
        doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).delete(ids.b1);
        doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).delete(ids.b2);
      });

      // Second sync — deletions should be detected via metadata
      const result = applyYjsToStateWithRepair(doc, syncedState, wsId);

      expect(result.boards?.byId[ids.b1]).toBeUndefined();
      expect(result.boards?.byId[ids.b2]).toBeUndefined();
      expect(result.columns?.byId[ids.c1a]).toBeUndefined();
      expect(result.columns?.byId[ids.c1b]).toBeUndefined();
      expect(result.columns?.byId[ids.c2a]).toBeUndefined();
      expect(result.tasks?.byId[ids.t1]).toBeUndefined();
      expect(result.tasks?.byId[ids.t2]).toBeUndefined();
      expect(result.tasks?.byId[ids.t3]).toBeUndefined();
      expect(result.tasks?.byId[ids.t4]).toBeUndefined();
      expect(result.boardPositions?.byId[ids.b1]).toBeUndefined();
      expect(result.boardPositions?.byId[ids.b2]).toBeUndefined();
    });
  });

  describe("partial deletion preserves other entities", () => {
    it("deleting one board preserves the other board and its children", () => {
      const wsId = nextWsId();
      const { state, ids } = createFullWorkspaceState(wsId);
      const { doc, syncedState } = initAndSync(state, wsId);

      // Delete only board-1 and its children
      doc.transact(() => {
        doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(wsId, {
          id: wsId,
          name: "Target Workspace",
          created_at: TS,
          board_ids: [ids.b2],
        });
        doc.getMap(YJS_MAP_NAMES.BOARDS).delete(ids.b1);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1a);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1b);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t1);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t2);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t3);
        doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).delete(ids.b1);
      });

      const result = applyYjsToStateWithRepair(doc, syncedState, wsId);

      // Board-1 gone
      expect(result.boards?.byId[ids.b1]).toBeUndefined();
      expect(result.columns?.byId[ids.c1a]).toBeUndefined();
      expect(result.tasks?.byId[ids.t1]).toBeUndefined();
      expect(result.tasks?.byId[ids.t2]).toBeUndefined();
      expect(result.tasks?.byId[ids.t3]).toBeUndefined();

      // Board-2 preserved
      expect(result.boards?.byId[ids.b2]).toBeDefined();
      expect(result.boards?.byId[ids.b2]?.name).toBe("Board Two");
      expect(result.columns?.byId[ids.c2a]).toBeDefined();
      expect(result.tasks?.byId[ids.t4]).toBeDefined();
      expect(result.boardPositions?.byId[ids.b2]).toBeDefined();
    });

    it("deleting tasks from a column preserves the column and other tasks", () => {
      const wsId = nextWsId();
      const { state, ids } = createFullWorkspaceState(wsId);
      const { doc, syncedState } = initAndSync(state, wsId);

      // Delete only task-1 (col-1a has task-1 and task-2)
      doc.transact(() => {
        const col = doc.getMap(YJS_MAP_NAMES.COLUMNS).get(ids.c1a) as Record<
          string,
          unknown
        >;
        if (col) {
          doc.getMap(YJS_MAP_NAMES.COLUMNS).set(ids.c1a, {
            ...col,
            task_ids: [ids.t2],
          });
        }
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t1);
      });

      const result = applyYjsToStateWithRepair(doc, syncedState, wsId);

      expect(result.tasks?.byId[ids.t1]).toBeUndefined();
      expect(result.tasks?.byId[ids.t2]).toBeDefined();
      expect(result.columns?.byId[ids.c1a]).toBeDefined();
    });
  });

  describe("cross-workspace isolation during deletion", () => {
    it("deleting entities in one workspace does not affect another", () => {
      const wsId = nextWsId();
      const otherWsId = `ws-other-${_wsDelCounter}`;
      const { state, ids } = createFullWorkspaceState(wsId);

      // Add entities belonging to another workspace (local only)
      state.workspaces.byId[otherWsId] = {
        id: otherWsId,
        name: "Other Workspace",
        created_at: TS,
        board_ids: ["board-other"],
      };
      state.workspaces.allIds.push(otherWsId);
      state.boards.byId["board-other"] = {
        id: "board-other",
        name: "Other Board",
        workspace_id: otherWsId,
        column_ids: [],
        created_by: "user-2",
        created_at: TS,
      };
      state.boards.allIds.push("board-other");

      const { doc, syncedState } = initAndSync(state, wsId);

      // Delete target workspace entities
      doc.transact(() => {
        doc.getMap(YJS_MAP_NAMES.BOARDS).delete(ids.b1);
        doc.getMap(YJS_MAP_NAMES.BOARDS).delete(ids.b2);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1a);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c1b);
        doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(ids.c2a);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t1);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t2);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t3);
        doc.getMap(YJS_MAP_NAMES.TASKS).delete(ids.t4);
      });

      const result = applyYjsToStateWithRepair(doc, syncedState, wsId);

      // Target workspace boards removed
      expect(result.boards?.byId[ids.b1]).toBeUndefined();
      expect(result.boards?.byId[ids.b2]).toBeUndefined();

      // Other workspace board preserved (belongs to different workspace)
      expect(result.boards?.byId["board-other"]).toBeDefined();
      expect(result.boards?.byId["board-other"]?.workspace_id).toBe(otherWsId);
    });
  });

  describe("Y.Doc round-trip consistency after deletion", () => {
    it("re-initializing Y.Doc after deletion produces empty workspace", () => {
      const wsId = nextWsId();

      // Clean state with just the workspace (no boards)
      const cleanState = createInitialState();
      cleanState.workspaces.byId[wsId] = {
        id: wsId,
        name: "Empty Workspace",
        created_at: TS,
        board_ids: [],
      };
      cleanState.workspaces.allIds.push(wsId);

      const doc = new Y.Doc();
      initializeYjsForWorkspace(doc, cleanState, wsId);

      expect(doc.getMap(YJS_MAP_NAMES.WORKSPACE).size).toBe(1);
      expect(doc.getMap(YJS_MAP_NAMES.BOARDS).size).toBe(0);
      expect(doc.getMap(YJS_MAP_NAMES.COLUMNS).size).toBe(0);
      expect(doc.getMap(YJS_MAP_NAMES.TASKS).size).toBe(0);
    });
  });
});
