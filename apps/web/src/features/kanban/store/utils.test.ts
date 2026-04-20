import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import {
  createDefaultWorkspace,
  createInitialState,
  getNextZIndex,
} from "@/src/features/kanban/store/utils";
import type { BoardPosition, EntityMap } from "@/src/features/kanban/types";

beforeEach(() => {
  nanoidCounter = 0;
});

describe("getNextZIndex", () => {
  it("returns max plus one even with sparse IDs", () => {
    const positions: EntityMap<BoardPosition> = {
      byId: {
        a: { id: "a", x: 0, y: 0, zIndex: 5 },
        b: { id: "b", x: 1, y: 1, zIndex: 20 },
        c: { id: "c", x: 2, y: 2, zIndex: 3 },
      },
      allIds: ["a", "b", "c"],
    };
    expect(getNextZIndex(positions)).toBe(21);
  });

  it("returns 1 when positions are empty", () => {
    const positions: EntityMap<BoardPosition> = { byId: {}, allIds: [] };
    expect(getNextZIndex(positions)).toBe(1);
  });
});

describe("createDefaultWorkspace", () => {
  it("default workspace shape is correct", () => {
    const { workspace, id } = createDefaultWorkspace();

    expect(workspace.id).toBe(id);
    expect(workspace.name).toBe("Default Workspace");
    expect(workspace.description).toBe("Your default workspace");
    expect(workspace.board_ids).toEqual([]);
    expect(typeof workspace.created_at).toBe("string");
    expect(new Date(workspace.created_at).toString()).not.toBe("Invalid Date");
  });
});

describe("createInitialState", () => {
  it("seeds exactly one workspace", () => {
    const state = createInitialState();

    expect(state.workspaces.allIds).toHaveLength(1);
    const id = state.workspaces.allIds[0]!;
    expect(state.workspaces.byId[id]).toBeDefined();
    expect(state.workspaces.byId[id]?.name).toBe("Default Workspace");
    expect(state.currentWorkspaceId).toBe(id);
  });

  it("has clean UI state", () => {
    const state = createInitialState();

    expect(state.boards).toEqual({ byId: {}, allIds: [] });
    expect(state.columns).toEqual({ byId: {}, allIds: [] });
    expect(state.tasks).toEqual({ byId: {}, allIds: [] });
    expect(state.comments).toEqual({ byId: {}, allIds: [] });
    expect(state.boardPositions).toEqual({ byId: {}, allIds: [] });
    expect(state.boardConnections).toEqual({ byId: {}, allIds: [] });
    expect(state.areas).toEqual({ byId: {}, allIds: [] });
    expect(state.selectionBox).toBeNull();
    expect(state.showCommandPalette).toBe(false);
    expect(state.showMiniMap).toBe(false);
    expect(state.interactionMode).toBe("drag");
    expect(state.selectedBoardId).toBeNull();
    expect(state.selectedBoardIds).toEqual([]);
    expect(state.selectedTaskIds).toEqual([]);
    expect(state.draggedTaskId).toBeNull();
    expect(state.canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(state.canvas.focusedBoardId).toBeNull();
    expect(state.dialogFocusStack).toEqual([]);
    expect(state.isProfileModalOpen).toBe(false);
  });
});
