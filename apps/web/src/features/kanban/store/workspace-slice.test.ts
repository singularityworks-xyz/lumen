import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import {
  addBoardToState,
  addTaskToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import { createWorkspaceSlice } from "./slices/workspace-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createWorkspaceSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createWorkspaceSlice(set, get);
});

describe("setCurrentWorkspace", () => {
  it("saves per-workspace viewport and dialog state on switch", () => {
    const ws1Id = state.currentWorkspaceId ?? "";
    state.canvas.viewport = { x: 100, y: 200, zoom: 1.5 };
    state.showMiniMap = true;
    state.boardQuickActions = {
      b1: { boardId: "b1", position: { x: 10, y: 20 } },
    };
    state.selectedBoardId = "b1";

    const ws2Id = actions.addWorkspace("Second");
    actions.setCurrentWorkspace(ws2Id);

    const ws1 = state.workspaces.byId[ws1Id]!;
    expect(ws1.lastViewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
    expect(ws1.showMiniMap).toBe(true);
    expect(ws1.savedDialogState).toBeDefined();
    expect(ws1.savedDialogState?.boardQuickActions).toEqual({
      b1: { boardId: "b1", position: { x: 10, y: 20 } },
    });
    expect(ws1.savedDialogState?.selectedBoardId).toBe("b1");
  });

  it("restores per-workspace dialog state and miniMap when switching back", () => {
    const ws1Id = state.currentWorkspaceId ?? "";
    state.showMiniMap = true;
    state.boardQuickActions = {
      b1: { boardId: "b1", position: { x: 10, y: 20 } },
    };
    state.selectedBoardId = "b1";
    state.selectedTaskIds = ["task-1", "task-2"];

    const ws2Id = actions.addWorkspace("Second");
    actions.setCurrentWorkspace(ws2Id);

    expect(state.showMiniMap).toBe(false);
    expect(state.boardQuickActions).toEqual({});
    expect(state.selectedTaskIds).toEqual([]);

    actions.setCurrentWorkspace(ws1Id);

    expect(state.showMiniMap).toBe(true);
    expect(state.boardQuickActions).toEqual({
      b1: { boardId: "b1", position: { x: 10, y: 20 } },
    });
    expect(state.selectedBoardId).toBe("b1");
    expect(state.selectedTaskIds).toEqual(["task-1", "task-2"]);
  });

  it("shared workspaces skip restoring local task modals", () => {
    const _ws1Id = state.currentWorkspaceId ?? "";
    state.taskDetailModals = {
      "modal-1": {
        id: "modal-1",
        taskId: "task-1",
        sourceTaskId: "task-1",
        boardId: "board-1",
        position: { x: 0, y: 0 },
        isEditing: false,
        zIndex: 100,
      },
    };

    const ws2Id = actions.addWorkspace("Shared");
    state.workspaces.byId[ws2Id]!.isShared = true;
    state.workspaces.byId[ws2Id]!.savedDialogState = {
      taskDetailModals: {
        "modal-2": {
          id: "modal-2",
          taskId: "task-2",
          sourceTaskId: "task-2",
          boardId: "board-1",
          position: { x: 10, y: 20 },
          isEditing: false,
          zIndex: 101,
        },
      },
      createTaskModals: {},
      boardQuickActions: {},
      boardDialogs: {},
      columnQuickActions: {},
      columnDialogs: {},
      taskQuickActions: {},
      connectionDialog: null,
      areaDialogs: {},
      dialogFocusStack: [],
      selectedTaskIds: [],
      selectedBoardId: null,
      selectedBoardIds: [],
    };

    actions.setCurrentWorkspace(ws2Id);

    expect(state.taskDetailModals).toEqual({});
    expect(state.createTaskModals).toEqual({});
  });

  it("clears transient UI fields on switch", () => {
    state.workspaceQuickActions = {
      workspaceId: "ws-1",
      position: { x: 0, y: 0 },
    };
    state.workspaceDialog = {
      type: "rename",
      workspaceId: "ws-1",
      workspaceName: "Test",
      position: { x: 0, y: 0 },
      inputValue: "Test",
    };
    state.shakingTaskDetailModalId = "modal-1";
    state.draggedTaskId = "task-1";

    const ws2Id = actions.addWorkspace("Second");
    actions.setCurrentWorkspace(ws2Id);

    expect(state.workspaceQuickActions).toBeNull();
    expect(state.workspaceDialog).toBeNull();
    expect(state.shakingTaskDetailModalId).toBeNull();
    expect(state.draggedTaskId).toBeNull();
  });
});

describe("addWorkspace", () => {
  it("local workspace creation defaults AI to disabled", () => {
    const id = actions.addWorkspace("New Workspace", "A description");

    const ws = state.workspaces.byId[id]!;
    expect(ws).toBeDefined();
    expect(ws.name).toBe("New Workspace");
    expect(ws.description).toBe("A description");
    expect(ws.aiEnabled).toBe(false);
    expect(ws.board_ids).toEqual([]);
    expect(state.workspaces.allIds).toContain(id);
  });

  it("resets the welcome card dismissal so it shows on the new workspace", () => {
    state.welcomeDismissed = true;

    actions.addWorkspace("Fresh Workspace");

    expect(state.welcomeDismissed).toBe(false);
  });
});

describe("updateWorkspace", () => {
  it("issues network PATCH only for shared workspaces", () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;

    const wsId = state.currentWorkspaceId ?? "";
    actions.updateWorkspace(wsId, { name: "Local Name" });
    expect(fetchCalled).toBe(false);

    const sharedId = actions.addWorkspace("Shared");
    state.workspaces.byId[sharedId]!.isShared = true;
    actions.updateWorkspace(sharedId, { name: "Shared Name" });
    expect(fetchCalled).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it("does not PATCH for local-only metadata updates", () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;

    const wsId = state.currentWorkspaceId ?? "";
    actions.updateWorkspace(wsId, { description: "Updated desc" });
    expect(fetchCalled).toBe(false);

    globalThis.fetch = originalFetch;
  });
});

describe("deleteWorkspace", () => {
  it("recreates a default workspace when deleting the only remaining workspace", async () => {
    const defaultWsId = state.workspaces.allIds[0]!;
    const result = await actions.deleteWorkspace(defaultWsId);
    expect(result).toBe(true);
    expect(state.workspaces.byId[defaultWsId]).toBeUndefined();
    expect(state.workspaces.allIds).toHaveLength(1);
    expect(state.currentWorkspaceId).toBe(state.workspaces.allIds[0]!);
  });

  it("delete local workspace cascades local board data cleanup", async () => {
    const wsId = actions.addWorkspace("To Delete");
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
    });
    const taskId = addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
    });

    expect(state.boards.byId[boardId]).toBeDefined();
    expect(state.tasks.byId[taskId]).toBeDefined();

    const result = await actions.deleteWorkspace(wsId);
    expect(result).toBe(true);

    expect(state.workspaces.byId[wsId]).toBeUndefined();
    expect(state.workspaces.allIds).not.toContain(wsId);
    expect(state.boards.byId[boardId]).toBeUndefined();
    expect(state.boards.allIds).not.toContain(boardId);
    for (const colId of columnIds) {
      expect(state.columns.byId[colId]).toBeUndefined();
      expect(state.columns.allIds).not.toContain(colId);
    }
    expect(state.tasks.byId[taskId]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(taskId);
    expect(state.boardPositions.byId[boardId]).toBeUndefined();
    expect(state.boardPositions.allIds).not.toContain(boardId);
  });

  it("switches to default workspace when current is deleted", async () => {
    const defaultWsId = state.workspaces.allIds[0]!;
    const wsId = actions.addWorkspace("Temp");
    actions.setCurrentWorkspace(wsId);
    expect(state.currentWorkspaceId).toBe(wsId);

    const result = await actions.deleteWorkspace(wsId);
    expect(result).toBe(true);
    expect(state.currentWorkspaceId).toBe(defaultWsId);
  });
});

describe("duplicateWorkspace", () => {
  it("remaps boards, columns, tasks, and positions", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
      x: 200,
      y: 300,
    });
    addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
      title: "Original Task",
    });

    const newWsId = actions.duplicateWorkspace(wsId, "Copied Workspace");
    expect(newWsId).not.toBeNull();

    const newWs = state.workspaces.byId[newWsId!]!;
    expect(newWs).toBeDefined();
    expect(newWs.name).toBe("Copied Workspace");
    expect(newWs.board_ids).toHaveLength(1);

    const newBoardId = newWs.board_ids[0]!;
    const newBoard = state.boards.byId[newBoardId]!;
    expect(newBoard).toBeDefined();
    expect(newBoard.workspace_id).toBe(newWsId!);
    expect(newBoard.column_ids).toHaveLength(3);

    const newColId = newBoard.column_ids[0]!;
    const newCol = state.columns.byId[newColId]!;
    expect(newCol).toBeDefined();
    expect(newCol.board_id).toBe(newBoardId);
    expect(newCol.task_ids).toHaveLength(1);

    const newTaskId = newCol.task_ids[0]!;
    const newTask = state.tasks.byId[newTaskId]!;
    expect(newTask).toBeDefined();
    expect(newTask.title).toBe("Original Task");
    expect(newTask.board_id).toBe(newBoardId);
    expect(newTask.column_id).toBe(newColId);

    const newPos = state.boardPositions.byId[newBoardId]!;
    expect(newPos).toBeDefined();
    expect(newPos.x).toBe(250);
    expect(newPos.y).toBe(350);
  });

  it("returns null for non-existent workspace", () => {
    const result = actions.duplicateWorkspace("nonexistent", "Copy");
    expect(result).toBeNull();
  });
});

describe("resetWorkspace", () => {
  it("clears tasks but keeps boards and columns by default", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
    });
    const taskId = addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
    });

    actions.resetWorkspace(wsId);

    expect(state.tasks.byId[taskId]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(taskId);
    expect(state.boards.byId[boardId]).toBeDefined();
    expect(state.columns.byId[columnIds[0]!]).toBeDefined();
    expect(state.columns.byId[columnIds[0]!]?.task_ids).toEqual([]);
  });

  it("honors clearBoardsAndColumns option", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
    });
    const taskId = addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
    });

    actions.resetWorkspace(wsId, { clearBoardsAndColumns: true });

    expect(state.tasks.byId[taskId]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(taskId);
    for (const colId of columnIds) {
      expect(state.columns.byId[colId]).toBeUndefined();
      expect(state.columns.allIds).not.toContain(colId);
    }
    expect(state.boards.byId[boardId]).toBeUndefined();
    expect(state.boards.allIds).not.toContain(boardId);
    expect(state.boardPositions.byId[boardId]).toBeUndefined();
    expect(state.boardPositions.allIds).not.toContain(boardId);
    expect(state.workspaces.byId[wsId]?.board_ids).toEqual([]);
  });

  it("does nothing for non-existent workspace", () => {
    const initial = {
      boards: state.boards.allIds.length,
      columns: state.columns.allIds.length,
      tasks: state.tasks.allIds.length,
    };
    actions.resetWorkspace("nonexistent");
    expect(state.boards.allIds).toHaveLength(initial.boards);
    expect(state.columns.allIds).toHaveLength(initial.columns);
    expect(state.tasks.allIds).toHaveLength(initial.tasks);
  });
});
