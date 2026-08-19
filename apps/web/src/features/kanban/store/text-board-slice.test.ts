import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import { createFreshState } from "@tests/helpers/store-harness";
import { createTextBoardSlice } from "./slices/text-board-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createTextBoardSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createTextBoardSlice(set, get);
});

describe("addTextBoard", () => {
  it("creates a text board with position, selection, and focus updates", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const textBoardId = actions.addTextBoard(
      "Launch todos",
      { x: 100, y: 200 },
      "Todos for launch"
    );

    const textBoard = state.textBoards.byId[textBoardId]!;
    expect(textBoard).toBeDefined();
    expect(textBoard.id.startsWith("tb_")).toBe(true);
    expect(textBoard.name).toBe("Launch todos");
    expect(textBoard.description).toBe("Todos for launch");
    expect(textBoard.workspace_id).toBe(wsId);
    expect(textBoard.created_at).toBeDefined();
    expect(state.textBoards.allIds).toContain(textBoardId);

    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos).toBeDefined();
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
    expect(pos.zIndex).toBe(1);
    expect(pos.width).toBe(320);
    expect(pos.height).toBe(420);

    expect(state.selectedBoardId).toBe(textBoardId);
    expect(state.canvas.focusedBoardId).toBe(textBoardId);
    expect(state.workspaces.byId[wsId]?.text_board_ids).toContain(textBoardId);
    expect(state.workspaces.byId[wsId]?.lastFocusedBoardId).toBe(textBoardId);
  });

  it("cascades below an existing text board when no position given", () => {
    const _wsId = state.currentWorkspaceId ?? "";
    const firstId = actions.addTextBoard("First", { x: 10, y: 10 });
    state.textBoardPositions.byId[firstId]!.height = 500;

    const secondId = actions.addTextBoard("Second");
    const pos = state.textBoardPositions.byId[secondId]!;
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(10 + 500 + 50);
  });

  it("cascades below an existing kanban board position when no position given", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const boardId = "board_existing";
    state.boards.byId[boardId] = {
      id: boardId,
      name: "Kanban",
      workspace_id: wsId,
      created_by: "test",
      created_at: new Date().toISOString(),
      column_ids: [],
    };
    state.boards.allIds.push(boardId);
    state.workspaces.byId[wsId]?.board_ids.push(boardId);
    state.boardPositions.byId[boardId] = {
      id: boardId,
      x: 50,
      y: 60,
      zIndex: 1,
      height: 300,
    };
    state.boardPositions.allIds.push(boardId);
    state.selectedBoardId = boardId;

    const textBoardId = actions.addTextBoard("Below kanban");
    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(60 + 300 + 50);
  });
});

describe("updateTextBoard", () => {
  it("updates fields and sets updated_at", () => {
    const textBoardId = actions.addTextBoard("Notes");
    state.textBoards.byId[textBoardId]!.updated_at = "2000-01-01T00:00:00.000Z";

    actions.updateTextBoard(textBoardId, {
      name: "Renamed",
      content: JSON.stringify({ type: "doc", content: [] }),
    });

    const textBoard = state.textBoards.byId[textBoardId]!;
    expect(textBoard.name).toBe("Renamed");
    expect(textBoard.content).toBe(
      JSON.stringify({ type: "doc", content: [] })
    );
    expect(textBoard.updated_at).toBeDefined();
    expect(textBoard.updated_at).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("does nothing for unknown ids", () => {
    expect(() =>
      actions.updateTextBoard("tb_missing", { name: "X" })
    ).not.toThrow();
  });
});

describe("removeTextBoard", () => {
  it("removes the board, its position, and workspace reference", () => {
    const wsId = state.currentWorkspaceId ?? "";
    const textBoardId = actions.addTextBoard("Delete me");
    state.selectedBoardId = textBoardId;
    state.selectedBoardIds = [textBoardId];

    actions.removeTextBoard(textBoardId);

    expect(state.textBoards.byId[textBoardId]).toBeUndefined();
    expect(state.textBoards.allIds).not.toContain(textBoardId);
    expect(state.textBoardPositions.byId[textBoardId]).toBeUndefined();
    expect(state.textBoardPositions.allIds).not.toContain(textBoardId);
    expect(state.workspaces.byId[wsId]?.text_board_ids).not.toContain(
      textBoardId
    );
    expect(state.selectedBoardId).toBeNull();
    expect(state.selectedBoardIds).not.toContain(textBoardId);
  });
});

describe("positions and z-index", () => {
  it("updateTextBoardPosition mutates x/y", () => {
    const textBoardId = actions.addTextBoard("Move me", { x: 0, y: 0 });
    actions.updateTextBoardPosition(textBoardId, { x: 55, y: 66 });
    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos.x).toBe(55);
    expect(pos.y).toBe(66);
  });

  it("updateTextBoardDimensions records user resize", () => {
    const textBoardId = actions.addTextBoard("Resize me");
    actions.updateTextBoardDimensions(
      textBoardId,
      { width: 400, height: 600 },
      true
    );
    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos.width).toBe(400);
    expect(pos.height).toBe(600);
    expect(pos.userResized).toBe(true);
    expect(pos.lastUserWidth).toBe(400);
    expect(pos.lastUserHeight).toBe(600);
  });

  it("clamps dimensions below the minimum width/height", () => {
    const textBoardId = actions.addTextBoard("Clamp me");
    actions.updateTextBoardDimensions(
      textBoardId,
      { width: 100, height: 50 },
      true
    );
    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos.width).toBe(280);
    expect(pos.height).toBe(180);
    expect(pos.lastUserWidth).toBe(280);
    expect(pos.lastUserHeight).toBe(180);
  });

  it("bringTextBoardToFront increases zIndex above other text boards", () => {
    const firstId = actions.addTextBoard("A", { x: 0, y: 0 });
    const secondId = actions.addTextBoard("B", { x: 0, y: 0 });
    expect(state.textBoardPositions.byId[secondId]!.zIndex).toBeGreaterThan(
      state.textBoardPositions.byId[firstId]!.zIndex
    );

    actions.bringTextBoardToFront(firstId);
    expect(state.textBoardPositions.byId[firstId]!.zIndex).toBeGreaterThan(
      state.textBoardPositions.byId[secondId]!.zIndex
    );
  });

  it("finalizeTextBoardDrag keeps position intact", () => {
    const textBoardId = actions.addTextBoard("Drag me", { x: 7, y: 8 });
    actions.updateTextBoardPosition(textBoardId, { x: 9, y: 10 });
    actions.finalizeTextBoardDrag(textBoardId);
    const pos = state.textBoardPositions.byId[textBoardId]!;
    expect(pos.x).toBe(9);
    expect(pos.y).toBe(10);
  });
});
