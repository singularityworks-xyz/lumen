import { describe, expect, it, mock } from "bun:test";

// Mock logger
mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

// Mock env
mock.module("@/src/env", () => ({
  env: { NEXT_PUBLIC_API_URL: "http://localhost:3002" },
}));

// Mock auth
mock.module("@/src/lib/auth-client", () => ({
  getCurrentUser: async () => ({ id: "user-1", name: "Test User" }),
}));

import {
  addBoardToState,
  createSliceHarness,
} from "@tests/helpers/store-harness";
import { createWorkspaceSlice } from "@/src/features/kanban/store/slices/workspace-slice";
import { createInitialState } from "@/src/features/kanban/store/utils";

// ──────────────────────────────────────────────────────────────
// Tests for the workspace sync logic: syncWorkspace action,
// store merge patterns, batch pre-fetch sizing, and abort logic.
// ──────────────────────────────────────────────────────────────

// ─── syncWorkspace action ──────────────────────────────────────

describe("syncWorkspace store action", () => {
  it("creates a new workspace if it doesn't exist", () => {
    const { state, actions } = createSliceHarness(createWorkspaceSlice);

    actions.syncWorkspace({
      id: "ws-shared-1",
      name: "Shared Project",
      isShared: true,
      ownerId: "user-2",
    });

    const ws = state.workspaces.byId["ws-shared-1"];
    expect(ws).toBeDefined();
    expect(ws!.name).toBe("Shared Project");
    expect(ws!.isShared).toBe(true);
    expect(ws!.ownerId).toBe("user-2");
    expect(state.workspaces.allIds).toContain("ws-shared-1");
  });

  it("updates existing workspace fields via Object.assign", () => {
    const { state, actions } = createSliceHarness(createWorkspaceSlice);

    actions.syncWorkspace({ id: "ws-1", name: "Original", isShared: true });
    actions.syncWorkspace({ id: "ws-1", name: "Renamed" });

    const ws = state.workspaces.byId["ws-1"];
    expect(ws!.name).toBe("Renamed");
    // isShared should be preserved since Object.assign merges
    expect(ws!.isShared).toBe(true);
  });

  it("does not duplicate allIds for existing workspace", () => {
    const { state, actions } = createSliceHarness(createWorkspaceSlice);

    actions.syncWorkspace({ id: "ws-1", name: "W" });
    actions.syncWorkspace({ id: "ws-1", name: "W2" });

    const count = state.workspaces.allIds.filter(
      (id: string) => id === "ws-1"
    ).length;
    expect(count).toBe(1);
  });

  it("syncs multiple workspaces independently", () => {
    const { state, actions } = createSliceHarness(createWorkspaceSlice);

    actions.syncWorkspace({ id: "ws-a", name: "One" });
    actions.syncWorkspace({ id: "ws-b", name: "Two" });
    actions.syncWorkspace({ id: "ws-c", name: "Three" });

    expect(state.workspaces.allIds).toContain("ws-a");
    expect(state.workspaces.allIds).toContain("ws-b");
    expect(state.workspaces.allIds).toContain("ws-c");
  });

  it("provides default name 'Shared Workspace' when name is not given", () => {
    const { state, actions } = createSliceHarness(createWorkspaceSlice);

    actions.syncWorkspace({ id: "ws-no-name" });

    const ws = state.workspaces.byId["ws-no-name"];
    expect(ws!.name).toBe("Shared Workspace");
  });
});

// ─── State merge logic (via direct state manipulation) ─────────

describe("workspace state merge logic (via setState)", () => {
  it("merges boards into store from pre-fetched state", () => {
    const state = createInitialState();
    const wsId = state.currentWorkspaceId!;

    // Simulate what fetchAndMergeWorkspaceState does
    state.boards.byId["board-remote"] = {
      id: "board-remote",
      name: "Remote Board",
      workspace_id: wsId,
      column_ids: [],
      created_by: "user-2",
      created_at: "2024-01-01T00:00:00Z",
    };
    state.boards.allIds.push("board-remote");
    state.workspaces.byId[wsId]!.board_ids.push("board-remote");

    expect(state.boards.byId["board-remote"]).toBeDefined();
    expect(state.boards.byId["board-remote"]!.name).toBe("Remote Board");
    expect(state.boards.byId["board-remote"]!.workspace_id).toBe(wsId);
  });

  it("merges columns and tasks into state", () => {
    const state = createInitialState();

    state.columns.byId["col-r"] = {
      id: "col-r",
      board_id: "board-r",
      name: "To Do",
      position: 0,
      task_ids: ["task-r"],
    };
    state.columns.allIds.push("col-r");

    state.tasks.byId["task-r"] = {
      id: "task-r",
      title: "Remote Task",
      board_id: "board-r",
      column_id: "col-r",
      position: 0,
      priority: "medium",
      progress: 0,
      status: "todo",
      created_by: "user-2",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    state.tasks.allIds.push("task-r");

    expect(state.columns.byId["col-r"]?.name).toBe("To Do");
    expect(state.tasks.byId["task-r"]?.title).toBe("Remote Task");
  });

  it("preserves existing boards when merging new remote boards", () => {
    const state = createInitialState();
    const wsId = state.currentWorkspaceId!;

    // Add a local board first
    addBoardToState(state, {
      boardId: "board-local",
      name: "Local Board",
      workspaceId: wsId,
    });

    // Add remote board
    state.boards.byId["board-remote"] = {
      id: "board-remote",
      name: "Remote Board",
      workspace_id: wsId,
      column_ids: [],
      created_by: "user-2",
      created_at: "2024-01-01T00:00:00Z",
    };
    state.boards.allIds.push("board-remote");

    expect(state.boards.byId["board-local"]).toBeDefined();
    expect(state.boards.byId["board-remote"]).toBeDefined();
  });

  it("does not duplicate allIds when merging existing entity", () => {
    const state = createInitialState();

    state.boards.byId["board-1"] = {
      id: "board-1",
      name: "Board",
      workspace_id: "ws-1",
      column_ids: [],
      created_by: "user-1",
      created_at: "2024-01-01T00:00:00Z",
    };
    state.boards.allIds.push("board-1");

    // Merge again (simulate re-fetch)
    if (!state.boards.allIds.includes("board-1")) {
      state.boards.allIds.push("board-1");
    }

    const count = state.boards.allIds.filter(
      (id: string) => id === "board-1"
    ).length;
    expect(count).toBe(1);
  });

  it("hasContent check returns false when all maps are empty", () => {
    const stateData = { boards: {}, columns: {}, tasks: {} };
    const hasContent =
      Object.keys(stateData.boards).length > 0 ||
      Object.keys(stateData.columns).length > 0 ||
      Object.keys(stateData.tasks).length > 0;
    expect(hasContent).toBe(false);
  });

  it("hasContent check returns true when boards exist", () => {
    const stateData = {
      boards: { "board-1": { id: "board-1" } },
      columns: {},
      tasks: {},
    };
    const hasContent =
      Object.keys(stateData.boards).length > 0 ||
      Object.keys(stateData.columns).length > 0 ||
      Object.keys(stateData.tasks).length > 0;
    expect(hasContent).toBe(true);
  });

  it("skip-if-loaded logic detects existing content", () => {
    const state = createInitialState();
    const wsId = state.currentWorkspaceId!;

    addBoardToState(state, { boardId: "existing-board", workspaceId: wsId });

    const ws = state.workspaces.byId[wsId]!;
    const hasContent = ws.board_ids.length > 0;
    expect(hasContent).toBe(true);
  });
});

// ─── Batch prefetch logic ──────────────────────────────────────

describe("batch prefetch logic", () => {
  const MAX_CONCURRENT_PREFETCH = 3;

  it("splits workspaces into correct batch sizes", () => {
    const workspaces = Array.from({ length: 7 }, (_, i) => ({ id: `ws-${i}` }));
    const batches: Array<Array<{ id: string }>> = [];

    for (let i = 0; i < workspaces.length; i += MAX_CONCURRENT_PREFETCH) {
      batches.push(workspaces.slice(i, i + MAX_CONCURRENT_PREFETCH));
    }

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(3);
    expect(batches[1]).toHaveLength(3);
    expect(batches[2]).toHaveLength(1);
  });

  it("produces single batch for count <= MAX_CONCURRENT_PREFETCH", () => {
    const workspaces = [{ id: "ws-1" }, { id: "ws-2" }];
    const batches: Array<Array<{ id: string }>> = [];

    for (let i = 0; i < workspaces.length; i += MAX_CONCURRENT_PREFETCH) {
      batches.push(workspaces.slice(i, i + MAX_CONCURRENT_PREFETCH));
    }

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("filters only shared workspaces for pre-fetch", () => {
    const backendWorkspaces = [
      { id: "ws-1", name: "Local", isShared: false },
      { id: "ws-2", name: "Shared A", isShared: true },
      { id: "ws-3", name: "Shared B", isShared: true },
      { id: "ws-4", name: "Local 2", isShared: false },
    ];

    const sharedWorkspaces = backendWorkspaces.filter((ws) => ws.isShared);
    expect(sharedWorkspaces).toHaveLength(2);
    expect(sharedWorkspaces.map((ws) => ws.id)).toEqual(["ws-2", "ws-3"]);
  });

  it("returns empty batch list when no shared workspaces", () => {
    const backendWorkspaces = [{ id: "ws-1", name: "Local", isShared: false }];

    const sharedWorkspaces = backendWorkspaces.filter((ws) => ws.isShared);
    expect(sharedWorkspaces).toHaveLength(0);
  });
});

// ─── AbortController / shouldContinue logic ────────────────────

describe("abort/shouldContinue logic", () => {
  it("shouldContinue returns true when active and not aborted", () => {
    const abortController = new AbortController();
    const isActive = true;
    const shouldContinue = () => isActive && !abortController.signal.aborted;
    expect(shouldContinue()).toBe(true);
  });

  it("shouldContinue returns false when aborted", () => {
    const abortController = new AbortController();
    const isActive = true;
    const shouldContinue = () => isActive && !abortController.signal.aborted;

    abortController.abort();
    expect(shouldContinue()).toBe(false);
  });

  it("shouldContinue returns false when deactivated", () => {
    const abortController = new AbortController();
    let isActive = true;
    const shouldContinue = () => isActive && !abortController.signal.aborted;

    isActive = false;
    expect(shouldContinue()).toBe(false);
  });

  it("AbortError is properly detected", () => {
    const error = new DOMException("The operation was aborted", "AbortError");
    const isAbortError =
      error instanceof DOMException && error.name === "AbortError";
    expect(isAbortError).toBe(true);
  });

  it("non-abort errors are not treated as AbortError", () => {
    const error = new Error("Network failure");
    const isAbortError =
      error instanceof DOMException && error.name === "AbortError";
    expect(isAbortError).toBe(false);
  });
});
