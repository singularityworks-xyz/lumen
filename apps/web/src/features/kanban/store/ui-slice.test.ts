import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({ nanoid: () => `seq${++nanoidCounter}` }));

import { createFreshState } from "@tests/helpers/store-harness";
import { createUiSlice } from "./slices/ui-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createUiSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createUiSlice(set, get);
});

describe("ui-slice", () => {
  describe("setInteractionMode", () => {
    it("changes mode to select", () => {
      actions.setInteractionMode("select");
      expect(state.interactionMode).toBe("select");
    });

    it("changes mode to drag and clears selectedBoardIds", () => {
      state.selectedBoardIds = ["b1", "b2"];
      actions.setInteractionMode("drag");
      expect(state.interactionMode).toBe("drag");
      expect(state.selectedBoardIds).toEqual([]);
    });

    it("changes mode to select from drag", () => {
      state.interactionMode = "drag" as typeof state.interactionMode;
      actions.setInteractionMode("select");
      expect(state.interactionMode).toBe("select");
    });
  });

  describe("setShowCommandPalette", () => {
    it("sets showCommandPalette to true", () => {
      state.showCommandPalette = false;
      actions.setShowCommandPalette(true);
      expect(state.showCommandPalette).toBe(true);
    });

    it("sets showCommandPalette to false", () => {
      state.showCommandPalette = true;
      actions.setShowCommandPalette(false);
      expect(state.showCommandPalette).toBe(false);
    });

    it("toggles via set calls", () => {
      actions.setShowCommandPalette(true);
      expect(state.showCommandPalette).toBe(true);
      actions.setShowCommandPalette(false);
      expect(state.showCommandPalette).toBe(false);
    });
  });

  describe("setShowMiniMap", () => {
    it("toggles showMiniMap on", () => {
      state.showMiniMap = false;
      actions.setShowMiniMap(true);
      expect(state.showMiniMap).toBe(true);
    });

    it("toggles showMiniMap off", () => {
      state.showMiniMap = true;
      actions.setShowMiniMap(false);
      expect(state.showMiniMap).toBe(false);
    });

    it("syncs to workspace when currentWorkspaceId is set", () => {
      const wsId = state.currentWorkspaceId ?? "";
      actions.setShowMiniMap(true);
      expect(state.workspaces.byId[wsId]!.showMiniMap).toBe(true);
      actions.setShowMiniMap(false);
      expect(state.workspaces.byId[wsId]!.showMiniMap).toBe(false);
    });

    it("does not throw when currentWorkspaceId is null", () => {
      state.currentWorkspaceId = null;
      expect(() => actions.setShowMiniMap(true)).not.toThrow();
      expect(state.showMiniMap).toBe(true);
    });
  });

  describe("setSelectedBoard", () => {
    it("sets selectedBoardId", () => {
      actions.setSelectedBoard("board-1");
      expect(state.selectedBoardId).toBe("board-1");
    });

    it("clears selectedBoardId with null", () => {
      state.selectedBoardId = "board-1";
      actions.setSelectedBoard(null);
      expect(state.selectedBoardId).toBeNull();
    });

    it("updates lastFocusedBoardId on workspace", () => {
      const wsId = state.currentWorkspaceId ?? "";
      actions.setSelectedBoard("board-42");
      expect(state.workspaces.byId[wsId]!.lastFocusedBoardId).toBe("board-42");
    });

    it("does not update workspace when boardId is null", () => {
      const wsId = state.currentWorkspaceId ?? "";
      state.workspaces.byId[wsId]!.lastFocusedBoardId = "old-board";
      actions.setSelectedBoard(null);
      expect(state.workspaces.byId[wsId]!.lastFocusedBoardId).toBe("old-board");
    });
  });

  describe("toggleBoardSelection", () => {
    it("adds boardId when not present", () => {
      expect(state.selectedBoardIds).toEqual([]);
      actions.toggleBoardSelection("b1");
      expect(state.selectedBoardIds).toContain("b1");
    });

    it("removes boardId when already present", () => {
      state.selectedBoardIds = ["b1", "b2"];
      actions.toggleBoardSelection("b1");
      expect(state.selectedBoardIds).not.toContain("b1");
      expect(state.selectedBoardIds).toEqual(["b2"]);
    });

    it("can add multiple boards", () => {
      actions.toggleBoardSelection("b1");
      actions.toggleBoardSelection("b2");
      actions.toggleBoardSelection("b3");
      expect(state.selectedBoardIds).toEqual(["b1", "b2", "b3"]);
    });

    it("toggling same board twice returns to original state", () => {
      state.selectedBoardIds = ["b1"];
      actions.toggleBoardSelection("b2");
      actions.toggleBoardSelection("b2");
      expect(state.selectedBoardIds).toEqual(["b1"]);
    });
  });

  describe("toggleTaskSelection", () => {
    it("adds taskId when not present", () => {
      expect(state.selectedTaskIds).toEqual([]);
      actions.toggleTaskSelection("t1");
      expect(state.selectedTaskIds).toContain("t1");
    });

    it("removes taskId when already present", () => {
      state.selectedTaskIds = ["t1", "t2"];
      actions.toggleTaskSelection("t1");
      expect(state.selectedTaskIds).not.toContain("t1");
      expect(state.selectedTaskIds).toEqual(["t2"]);
    });

    it("can add multiple tasks", () => {
      actions.toggleTaskSelection("t1");
      actions.toggleTaskSelection("t2");
      actions.toggleTaskSelection("t3");
      expect(state.selectedTaskIds).toEqual(["t1", "t2", "t3"]);
    });

    it("toggling same task twice returns to original state", () => {
      state.selectedTaskIds = ["t1"];
      actions.toggleTaskSelection("t2");
      actions.toggleTaskSelection("t2");
      expect(state.selectedTaskIds).toEqual(["t1"]);
    });
  });
});
