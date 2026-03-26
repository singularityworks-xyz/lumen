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
import { createColumnSlice } from "./slices/column-slice";
import type { KanbanStore } from "./types";

function harness(state: KanbanStore) {
  const set = (fn: (s: KanbanStore) => void) => fn(state);
  const get = () => state;
  return createColumnSlice(set, get);
}

beforeEach(() => {
  nanoidCounter = 0;
});

describe("addColumn", () => {
  it("appends column with correct position when no position specified", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const prevLength = columnIds.length;
    const actions = harness(state);

    const colId = actions.addColumn(boardId, "New Column");

    expect(state.columns.byId[colId]).toBeDefined();
    expect(state.columns.byId[colId]!.name).toBe("New Column");
    expect(state.columns.byId[colId]!.board_id).toBe(boardId);
    expect(state.columns.byId[colId]!.position).toBe(prevLength);
    expect(state.columns.byId[colId]!.task_ids).toEqual([]);
    expect(state.columns.allIds).toContain(colId);
    expect(state.boards.byId[boardId]!.column_ids).toContain(colId);
  });

  it("inserts column at specified position", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId } = addBoardToState(state);
    const actions = harness(state);

    const colId = actions.addColumn(boardId, "Inserted", 1);

    expect(state.columns.byId[colId]!.position).toBe(1);
  });
});

describe("deleteColumn", () => {
  it("removes tasks and selected task IDs that belong to deleted column", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0]!;
    const t1 = addTaskToState(state, { columnId: colId, boardId });
    const t2 = addTaskToState(state, { columnId: colId, boardId });
    state.selectedTaskIds = [t1, "other-selected"];
    const actions = harness(state);

    actions.deleteColumn(boardId, colId);

    expect(state.tasks.byId[t1]).toBeUndefined();
    expect(state.tasks.byId[t2]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(t1);
    expect(state.tasks.allIds).not.toContain(t2);
    expect(state.selectedTaskIds).not.toContain(t1);
    expect(state.selectedTaskIds).toContain("other-selected");
  });

  it("removes column from board column_ids", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0]!;
    const actions = harness(state);

    actions.deleteColumn(boardId, colId);

    expect(state.boards.byId[boardId]!.column_ids).not.toContain(colId);
    expect(state.columns.byId[colId]).toBeUndefined();
    expect(state.columns.allIds).not.toContain(colId);
  });
});

describe("moveColumn", () => {
  it("reorders and rewrites all positions", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const [c0, c1, c2] = columnIds;
    const actions = harness(state);

    actions.moveColumn(boardId, c0!, 2);

    expect(state.boards.byId[boardId]!.column_ids).toEqual([c1!, c2!, c0!]);
    expect(state.columns.byId[c1!]!.position).toBe(0);
    expect(state.columns.byId[c2!]!.position).toBe(1);
    expect(state.columns.byId[c0!]!.position).toBe(2);
  });
});

describe("moveColumnToBoard", () => {
  it("re-parents tasks and normalizes source board positions", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId: sourceId, columnIds: srcCols } = addBoardToState(state);
    const { boardId: targetId, columnIds: tgtCols } = addBoardToState(state);
    const colId = srcCols[0]!;
    const task1 = addTaskToState(state, { columnId: colId, boardId: sourceId });
    const task2 = addTaskToState(state, { columnId: colId, boardId: sourceId });
    const targetColCount = tgtCols.length;
    const actions = harness(state);

    actions.moveColumnToBoard(sourceId, colId, targetId);

    expect(state.boards.byId[sourceId]!.column_ids).not.toContain(colId);
    expect(state.boards.byId[targetId]!.column_ids).toContain(colId);
    expect(state.columns.byId[colId]!.board_id).toBe(targetId);
    expect(state.columns.byId[colId]!.position).toBe(targetColCount);
    expect(state.tasks.byId[task1]!.board_id).toBe(targetId);
    expect(state.tasks.byId[task2]!.board_id).toBe(targetId);

    const remainingSrcCols = state.boards.byId[sourceId]!.column_ids;
    for (const [i, id] of remainingSrcCols.entries()) {
      expect(state.columns.byId[id]!.position).toBe(i);
    }
  });

  it("does nothing when source and target are same", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0]!;
    const before = JSON.parse(JSON.stringify(state));
    const actions = harness(state);

    actions.moveColumnToBoard(boardId, colId, boardId);

    expect(state.boards.byId[boardId]!.column_ids).toEqual(
      before.boards.byId[boardId].column_ids
    );
    expect(state.columns.byId[colId]!.board_id).toBe(
      before.columns.byId[colId].board_id
    );
  });
});

describe("openColumnDialog", () => {
  it("returns existing dialog ID for same column/type (deduplication)", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const actions = harness(state);

    const opts = {
      type: "rename" as const,
      columnId: columnIds[0]!,
      columnName: "Col",
      boardId,
      boardName: "Board",
      position: { x: 0, y: 0 },
    };

    const first = actions.openColumnDialog(opts);
    const second = actions.openColumnDialog(opts);

    expect(first).toBe(second);
    expect(Object.keys(state.columnDialogs)).toHaveLength(1);
  });
});

describe("closeColumnDialog", () => {
  it("removes the dialog", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const actions = harness(state);

    const id = actions.openColumnDialog({
      type: "delete",
      columnId: columnIds[0]!,
      columnName: "Col",
      boardId,
      boardName: "Board",
      position: { x: 0, y: 0 },
    });

    expect(state.columnDialogs[id]).toBeDefined();

    actions.closeColumnDialog(id);

    expect(state.columnDialogs[id]).toBeUndefined();
  });
});

describe("updateColumn", () => {
  it("merges updates into column", () => {
    const state = createFreshState() as KanbanStore;
    const { columnIds } = addBoardToState(state);
    const colId = columnIds[0]!;
    const actions = harness(state);

    actions.updateColumn(colId, { name: "Updated", description: "desc" });

    expect(state.columns.byId[colId]!.name).toBe("Updated");
    expect(state.columns.byId[colId]!.description).toBe("desc");
    expect(state.columns.byId[colId]!.board_id).toBeDefined();
  });
});

describe("updateColumnQuickActionsPosition", () => {
  it("updates position and moves linked modal source rects", () => {
    const state = createFreshState() as KanbanStore;
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0]!;
    const modalId = "modal-1";
    state.createTaskModals[modalId] = {
      id: modalId,
      boardId,
      columnId: colId,
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
      sourceRect: {
        top: 0,
        right: 220,
        bottom: 190,
        left: 0,
        width: 220,
        height: 190,
      },
      zIndex: 10,
    };
    const actions = harness(state);

    actions.openColumnQuickActions(colId, boardId, true, { x: 0, y: 0 });
    actions.updateColumnQuickActionsPosition(colId, { x: 500, y: 300 });

    const quickActions = state.columnQuickActions[colId];
    expect(quickActions).toBeDefined();
    expect(quickActions!.position).toEqual({ x: 500, y: 300 });

    const modal = state.createTaskModals[modalId];
    expect(modal).toBeDefined();
    expect(modal!.sourceRect).toEqual({
      left: 500,
      top: 460,
      right: 720,
      bottom: 490,
      width: 220,
      height: 190,
    });
  });
});
