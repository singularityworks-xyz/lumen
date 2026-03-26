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
import { createBoardSlice } from "./slices/board-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createBoardSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createBoardSlice(set, get);
});

describe("addBoard", () => {
  it("creates board with default columns, board position, selection, and focus updates", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const boardId = actions.addBoard("Test Board", { x: 100, y: 200 });

    const board = state.boards.byId[boardId]!;
    expect(board).toBeDefined();
    expect(board.name).toBe("Test Board");
    expect(board.column_ids).toHaveLength(3);
    expect(state.boards.allIds).toContain(boardId);

    for (const colId of board.column_ids) {
      const col = state.columns.byId[colId]!;
      expect(col).toBeDefined();
      expect(col.board_id).toBe(boardId);
      expect(state.columns.allIds).toContain(colId);
    }

    const pos = state.boardPositions.byId[boardId]!;
    expect(pos).toBeDefined();
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
    expect(pos.zIndex).toBe(1);
    expect(pos.width).toBeDefined();
    expect(pos.height).toBeDefined();

    expect(state.selectedBoardId).toBe(boardId);
    expect(state.canvas.focusedBoardId).toBe(boardId);
    expect(state.workspaces.byId[wsId]!.board_ids).toContain(boardId);
    expect(state.workspaces.byId[wsId]!.lastFocusedBoardId).toBe(boardId);
  });

  it("auto-placement uses selected board when no explicit position provided", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId: existingBoardId } = addBoardToState(state, {
      workspaceId: wsId,
      x: 100,
      y: 500,
    });
    state.boardPositions.byId[existingBoardId]!.height = 400;
    state.selectedBoardId = existingBoardId;

    const boardId = actions.addBoard("Auto Board");

    const pos = state.boardPositions.byId[boardId]!;
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(500 + 400 + 50);
  });

  it("auto-placement falls back to lastFocusedBoardId when no selection", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId: existingBoardId } = addBoardToState(state, {
      workspaceId: wsId,
      x: 200,
      y: 300,
    });
    state.boardPositions.byId[existingBoardId]!.height = 350;
    state.workspaces.byId[wsId]!.lastFocusedBoardId = existingBoardId;
    state.selectedBoardId = null;

    const boardId = actions.addBoard("Fallback Board");

    const pos = state.boardPositions.byId[boardId]!;
    expect(pos.x).toBe(200);
    expect(pos.y).toBe(300 + 350 + 50);
  });

  it("auto-placement uses last board when no selection or focus", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId: lastBoardId } = addBoardToState(state, {
      workspaceId: wsId,
      x: 50,
      y: 100,
    });
    state.boardPositions.byId[lastBoardId]!.height = 450;
    state.selectedBoardId = null;
    state.workspaces.byId[wsId]!.lastFocusedBoardId = null;

    const boardId = actions.addBoard("Last Board");

    const pos = state.boardPositions.byId[boardId]!;
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(100 + 450 + 50);
  });
});

describe("removeBoard", () => {
  it("cascades through columns, tasks, positions, and workspace board IDs", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
    });
    const taskId = addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
    });
    state.selectedBoardIds.push(boardId);

    actions.removeBoard(boardId);

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
    expect(state.workspaces.byId[wsId]!.board_ids).not.toContain(boardId);
    expect(state.selectedBoardIds).not.toContain(boardId);
  });

  it("clears selectedBoardId if it matches", () => {
    const { boardId } = addBoardToState(state);
    state.selectedBoardId = boardId;

    actions.removeBoard(boardId);

    expect(state.selectedBoardId).toBeNull();
  });
});

describe("duplicateBoard", () => {
  it("remaps columns/tasks and offsets positions", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
      x: 200,
      y: 300,
    });
    const _taskId = addTaskToState(state, {
      columnId: columnIds[0]!,
      boardId,
      title: "Original Task",
    });

    const newBoardId = actions.duplicateBoard(boardId, "Copy Board");

    expect(newBoardId).not.toBeNull();
    const newBoard = state.boards.byId[newBoardId!]!;
    expect(newBoard).toBeDefined();
    expect(newBoard.name).toBe("Copy Board");
    expect(newBoard.column_ids).toHaveLength(3);

    const newPos = state.boardPositions.byId[newBoardId!]!;
    expect(newPos.x).toBe(250);
    expect(newPos.y).toBe(350);

    const newColId = newBoard.column_ids[0]!;
    const newCol = state.columns.byId[newColId]!;
    expect(newCol).toBeDefined();
    expect(newCol.board_id).toBe(newBoardId!);

    expect(newCol.task_ids).toHaveLength(1);
    const newTaskId = newCol.task_ids[0]!;
    const newTask = state.tasks.byId[newTaskId]!;
    expect(newTask).toBeDefined();
    expect(newTask.title).toBe("Original Task");
    expect(newTask.column_id).toBe(newColId);

    expect(state.workspaces.byId[wsId]!.board_ids).toContain(newBoardId!);
    expect(state.workspaces.byId[wsId]!.lastFocusedBoardId).toBe(newBoardId);
  });

  it("copies outbound connections only when requested", () => {
    const { boardId } = addBoardToState(state);
    const { boardId: targetBoardId } = addBoardToState(state);
    const connId = "conn-1";
    state.boardConnections.byId[connId] = {
      id: connId,
      source_board_id: boardId,
      target_board_id: targetBoardId,
      lineStyle: "solid",
      sourceHandle: "right",
      targetHandle: "left",
      showArrow: true,
      created_at: new Date().toISOString(),
    };
    state.boardConnections.allIds.push(connId);

    const withoutCopy = actions.duplicateBoard(boardId, "No Connections");
    const withoutCopyConns = state.boardConnections.allIds
      .map((id) => state.boardConnections.byId[id]!)
      .filter((c) => c && c.source_board_id === withoutCopy);
    expect(withoutCopyConns).toHaveLength(0);

    const withCopy = actions.duplicateBoard(boardId, "With Connections", {
      copyConnections: true,
    });
    const withCopyConns = state.boardConnections.allIds
      .map((id) => state.boardConnections.byId[id]!)
      .filter((c) => c && c.source_board_id === withCopy);
    expect(withCopyConns).toHaveLength(1);
    expect(withCopyConns[0]!.target_board_id).toBe(targetBoardId);
  });
});

describe("updateBoardQuickActionsPosition", () => {
  it("updates position and moves linked modal source rects", () => {
    const { boardId } = addBoardToState(state);
    const modalId = "modal-1";
    state.createTaskModals[modalId] = {
      id: modalId,
      boardId,
      columnId: "col-1",
      formData: {
        title: "",
        description: "",
        priority: "medium",
        progress: 0,
        dueDate: "",
        tags: "",
      },
      position: { x: 0, y: 0 },
      sourceType: "board-menu",
      sourceRect: {
        top: 0,
        right: 220,
        bottom: 110,
        left: 0,
        width: 220,
        height: 110,
      },
      zIndex: 10,
    };

    actions.openBoardQuickActions(boardId, { x: 0, y: 0 });
    actions.updateBoardQuickActionsPosition(boardId, { x: 500, y: 300 });

    const quickActions = state.boardQuickActions[boardId];
    expect(quickActions).toBeDefined();
    expect(quickActions!.position).toEqual({ x: 500, y: 300 });

    const modal = state.createTaskModals[modalId];
    expect(modal).toBeDefined();
    expect(modal!.sourceRect).toEqual({
      left: 500,
      top: 380,
      right: 720,
      bottom: 410,
      width: 220,
      height: 110,
    });
  });

  it("does not update modal source rect for non-board-menu sourceType", () => {
    const { boardId } = addBoardToState(state);
    const modalId = "modal-1";
    const originalRect = {
      top: 0,
      right: 220,
      bottom: 110,
      left: 0,
      width: 220,
      height: 110,
    };
    state.createTaskModals[modalId] = {
      id: modalId,
      boardId,
      columnId: "col-1",
      formData: {
        title: "",
        description: "",
        priority: "medium",
        progress: 0,
        dueDate: "",
        tags: "",
      },
      position: { x: 0, y: 0 },
      sourceType: "column-menu",
      sourceRect: { ...originalRect },
      zIndex: 10,
    };

    actions.openBoardQuickActions(boardId, { x: 0, y: 0 });
    actions.updateBoardQuickActionsPosition(boardId, { x: 500, y: 300 });

    const modal = state.createTaskModals[modalId];
    expect(modal!.sourceRect).toEqual(originalRect);
  });
});

describe("updateBoardDialogPosition", () => {
  it("updates dialog position", () => {
    const id = actions.openBoardDialog({
      type: "rename",
      boardId: "board-1",
      boardName: "My Board",
      position: { x: 10, y: 20 },
    });

    actions.updateBoardDialogPosition(id, { x: 100, y: 200 });

    expect(state.boardDialogs[id]!.position).toEqual({ x: 100, y: 200 });
  });
});
