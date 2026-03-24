import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({ nanoid: () => `seq${++nanoidCounter}` }));

import {
  addBoardToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import { createAreaSlice } from "./slices/area-slice";
import type { KanbanStore } from "./types";

const DLG_ID_REGEX = /^dlg_seq\d+$/;

let state: KanbanStore;
let actions: ReturnType<typeof createAreaSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createAreaSlice(set, get);
});

describe("area-slice", () => {
  describe("addArea", () => {
    it("creates both entity and position", () => {
      const areaId = actions.addArea(
        "My Area",
        { x: 100, y: 200 },
        { width: 400, height: 300 }
      );

      expect(areaId).toBe("area_seq2");
      const area = state.areas.byId[areaId]!;
      expect(area).toBeDefined();
      expect(area.name).toBe("My Area");
      expect(area.board_ids).toEqual([]);
      expect(area.color).toBe("#9ca3af");
      expect(state.areas.allIds).toContain(areaId);

      const pos = state.areaPositions.byId[areaId]!;
      expect(pos).toBeDefined();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
      expect(pos.width).toBe(400);
      expect(pos.height).toBe(300);
      expect(pos.zIndex).toBe(0);
      expect(state.areaPositions.allIds).toContain(areaId);
    });

    it("uses currentWorkspaceId when workspaceId not provided", () => {
      const wsId = state.currentWorkspaceId ?? "";
      const areaId = actions.addArea(
        "Area",
        { x: 0, y: 0 },
        { width: 100, height: 100 }
      );

      expect(state.areas.byId[areaId]!.workspace_id).toBe(wsId);
    });

    it("uses provided workspaceId", () => {
      const areaId = actions.addArea(
        "Area",
        { x: 0, y: 0 },
        { width: 100, height: 100 },
        "ws-custom"
      );

      expect(state.areas.byId[areaId]!.workspace_id).toBe("ws-custom");
    });

    it("returns empty string when no workspaceId available", () => {
      state.currentWorkspaceId = null;
      const areaId = actions.addArea(
        "Area",
        { x: 0, y: 0 },
        { width: 100, height: 100 }
      );

      expect(areaId).toBe("");
    });
  });

  describe("updateAreaPosition", () => {
    it("captures drag origin only on first update", () => {
      const areaId = actions.addArea(
        "Area",
        { x: 100, y: 200 },
        { width: 400, height: 300 }
      );

      actions.updateAreaPosition(areaId, { x: 150, y: 250 });

      expect(state.areaDragOrigins[areaId]).toEqual({
        originX: 100,
        originY: 200,
      });
      expect(state.areaPositions.byId[areaId]!.x).toBe(150);
      expect(state.areaPositions.byId[areaId]!.y).toBe(250);

      actions.updateAreaPosition(areaId, { x: 200, y: 300 });

      expect(state.areaPositions.byId[areaId]!.x).toBe(200);
      expect(state.areaPositions.byId[areaId]!.y).toBe(300);
    });

    it("does nothing when area position does not exist", () => {
      actions.updateAreaPosition("nonexistent", { x: 10, y: 20 });

      expect(Object.hasOwn(state.areaDragOrigins, "nonexistent")).toBe(false);
    });
  });

  describe("finalizeAreaDrag", () => {
    it("moves contained boards by accumulated delta", () => {
      const areaId = actions.addArea(
        "Area",
        { x: 100, y: 100 },
        { width: 400, height: 300 }
      );
      const { boardId: board1 } = addBoardToState(state, { x: 50, y: 60 });
      const { boardId: board2 } = addBoardToState(state, { x: 80, y: 90 });
      actions.attachBoardToArea(areaId, board1);
      actions.attachBoardToArea(areaId, board2);

      actions.updateAreaPosition(areaId, { x: 200, y: 250 });
      actions.finalizeAreaDrag(areaId);

      expect(state.boardPositions.byId[board1]!.x).toBe(150);
      expect(state.boardPositions.byId[board1]!.y).toBe(210);
      expect(state.boardPositions.byId[board2]!.x).toBe(180);
      expect(state.boardPositions.byId[board2]!.y).toBe(240);
      expect(state.areaDragOrigins[areaId]).toBeUndefined();
    });

    it("does nothing when area or origin is missing", () => {
      actions.finalizeAreaDrag("nonexistent");

      expect(Object.hasOwn(state.areaDragOrigins, "nonexistent")).toBe(false);
    });
  });
});

describe("attachBoardToArea", () => {
  it("detaches from other areas first", () => {
    const area1 = actions.addArea(
      "Area 1",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    const area2 = actions.addArea(
      "Area 2",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    const { boardId } = addBoardToState(state);

    actions.attachBoardToArea(area1, boardId);
    actions.attachBoardToArea(area2, boardId);

    expect(state.areas.byId[area1]!.board_ids).not.toContain(boardId);
    expect(state.areas.byId[area2]!.board_ids).toContain(boardId);
  });

  it("does not duplicate when already in area", () => {
    const areaId = actions.addArea(
      "Area",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    const { boardId } = addBoardToState(state);

    actions.attachBoardToArea(areaId, boardId);
    actions.attachBoardToArea(areaId, boardId);

    expect(state.areas.byId[areaId]!.board_ids).toEqual([boardId]);
  });

  it("does nothing when area does not exist", () => {
    actions.attachBoardToArea("nonexistent", "board-1");

    expect(Object.keys(state.areas.byId)).toHaveLength(0);
  });
});

describe("detachBoardFromArea", () => {
  it("removes board from area", () => {
    const areaId = actions.addArea(
      "Area",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    const { boardId: board1 } = addBoardToState(state);
    const { boardId: board2 } = addBoardToState(state);
    actions.attachBoardToArea(areaId, board1);
    actions.attachBoardToArea(areaId, board2);

    actions.detachBoardFromArea(areaId, board1);

    expect(state.areas.byId[areaId]!.board_ids).not.toContain(board1);
    expect(state.areas.byId[areaId]!.board_ids).toContain(board2);
  });

  it("does nothing when area does not exist", () => {
    actions.detachBoardFromArea("nonexistent", "board-1");
  });
});

describe("removeArea", () => {
  it("removes both entity and position", () => {
    const areaId = actions.addArea(
      "Area",
      { x: 10, y: 20 },
      { width: 100, height: 100 }
    );

    actions.removeArea(areaId);

    expect(state.areas.byId[areaId]).toBeUndefined();
    expect(state.areas.allIds).not.toContain(areaId);
    expect(state.areaPositions.byId[areaId]).toBeUndefined();
    expect(state.areaPositions.allIds).not.toContain(areaId);
  });

  it("does not affect other areas", () => {
    const area1 = actions.addArea(
      "Area 1",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    const area2 = actions.addArea(
      "Area 2",
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );

    actions.removeArea(area1);

    expect(state.areas.byId[area2]!).toBeDefined();
    expect(state.areaPositions.byId[area2]!).toBeDefined();
  });
});

describe("area dialogs", () => {
  it("openAreaDialog creates dialog by ID", () => {
    const dialogId = actions.openAreaDialog({
      areaId: "area-1",
      areaName: "My Area",
      position: { x: 100, y: 200 },
    });

    expect(dialogId).toMatch(DLG_ID_REGEX);
    const dialog = state.areaDialogs[dialogId]!;
    expect(dialog).toBeDefined();
    expect(dialog.areaId).toBe("area-1");
    expect(dialog.areaName).toBe("My Area");
    expect(dialog.position).toEqual({ x: 100, y: 200 });
    expect(dialog.inputValue).toBe("My Area");
  });

  it("updateAreaDialogPosition updates by ID", () => {
    const dialogId = actions.openAreaDialog({
      areaId: "area-1",
      areaName: "Area",
      position: { x: 0, y: 0 },
    });

    actions.updateAreaDialogPosition(dialogId, { x: 50, y: 60 });

    expect(state.areaDialogs[dialogId]!.position).toEqual({ x: 50, y: 60 });
  });

  it("updateAreaDialogInputValue updates by ID", () => {
    const dialogId = actions.openAreaDialog({
      areaId: "area-1",
      areaName: "Old Name",
      position: { x: 0, y: 0 },
    });

    actions.updateAreaDialogInputValue(dialogId, "New Name");

    expect(state.areaDialogs[dialogId]!.inputValue).toBe("New Name");
  });

  it("closeAreaDialog removes by ID", () => {
    const dialogId = actions.openAreaDialog({
      areaId: "area-1",
      areaName: "Area",
      position: { x: 0, y: 0 },
    });

    actions.closeAreaDialog(dialogId);

    expect(state.areaDialogs[dialogId]).toBeUndefined();
  });
});
