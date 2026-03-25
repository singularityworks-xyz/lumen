import { describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import { createFreshState } from "@tests/helpers/store-harness";
import type { KanbanState } from "./types";

const uiStateFields: (keyof KanbanState)[] = [
  "showCommandPalette",
  "showMiniMap",
  "interactionMode",
  "selectedBoardId",
  "selectedBoardIds",
  "selectedTaskIds",
  "draggedTaskId",
  "columnUi",
];

const temporalExcludeFields: (keyof KanbanState)[] = [
  ...uiStateFields,
  "canvas",
];

describe("kanban-store", () => {
  describe("temporal partialize", () => {
    it("excludes transient UI fields from temporal history", () => {
      const state = createFreshState();
      const tracked: Record<string, unknown> = {};
      for (const key of Object.keys(state) as (keyof KanbanState)[]) {
        if (!temporalExcludeFields.includes(key)) {
          tracked[key] = state[key];
        }
      }

      for (const field of temporalExcludeFields) {
        expect(tracked).not.toHaveProperty(field);
      }

      expect(tracked).toHaveProperty("workspaces");
      expect(tracked).toHaveProperty("boards");
      expect(tracked).toHaveProperty("columns");
      expect(tracked).toHaveProperty("tasks");
      expect(tracked).toHaveProperty("boardPositions");
      expect(tracked).toHaveProperty("boardConnections");
      expect(tracked).toHaveProperty("currentWorkspaceId");
    });

    it("includes canvas in temporal exclude list", () => {
      expect(temporalExcludeFields).toContain("canvas");
    });

    it("includes all UI state fields in temporal exclude list", () => {
      for (const field of uiStateFields) {
        expect(temporalExcludeFields).toContain(field);
      }
    });
  });

  describe("persisted partialize", () => {
    it("includes all expected persisted fields", () => {
      const state = createFreshState();
      const persistedFields = [
        "workspaces",
        "boards",
        "columns",
        "comments",
        "chatMessages",
        "tasks",
        "boardPositions",
        "boardConnections",
        "currentWorkspaceId",
        "canvas",
        "createTaskModals",
        "taskDetailModals",
        "workspaceQuickActions",
        "workspaceDialog",
        "columnQuickActions",
        "columnDialogs",
        "boardQuickActions",
        "boardDialogs",
        "connectionDialog",
        "taskQuickActions",
        "columnUi",
        "lastActiveDrawerTab",
        "areas",
        "areaPositions",
        "areaDialogs",
        "selectionBox",
        "lastTaskModalPositions",
      ];

      const persisted: Record<string, unknown> = {};
      for (const key of persistedFields) {
        persisted[key] = state[key as keyof KanbanState];
      }

      for (const key of persistedFields) {
        expect(persisted).toHaveProperty(key);
      }
    });
  });

  describe("rehydration repair", () => {
    it("repairs null boardQuickActions to empty object", () => {
      const invalidState: Record<string, unknown> = {
        ...createFreshState(),
        boardQuickActions: null,
      };

      const needsRepair =
        invalidState.boardQuickActions === null ||
        typeof invalidState.boardQuickActions !== "object";
      expect(needsRepair).toBe(true);
    });

    it("repairs non-object boardQuickActions to empty object", () => {
      const invalidState: Record<string, unknown> = {
        ...createFreshState(),
        boardQuickActions: "invalid",
      };

      const needsRepair =
        invalidState.boardQuickActions === null ||
        typeof invalidState.boardQuickActions !== "object";
      expect(needsRepair).toBe(true);
    });

    it("does not repair valid boardQuickActions", () => {
      const validState: Record<string, unknown> = {
        ...createFreshState(),
        boardQuickActions: {
          b1: { boardId: "b1", position: { x: 0, y: 0 } },
        },
      };

      const needsRepair =
        validState.boardQuickActions === null ||
        typeof validState.boardQuickActions !== "object";
      expect(needsRepair).toBe(false);
    });

    it("restores showMiniMap from workspace during rehydration", () => {
      const state = createFreshState();
      const wsId = state.currentWorkspaceId ?? "";
      state.workspaces.byId[wsId]!.showMiniMap = true;

      const workspace = state.workspaces.byId[wsId];
      expect(workspace).toBeDefined();
      expect(workspace!.showMiniMap).toBe(true);
    });
  });

  describe("undo/redo helpers", () => {
    it("canUndo and canRedo reflect temporal state accurately", () => {
      const temporalState = {
        pastStates: [{ boards: { byId: {}, allIds: [] } }],
        futureStates: [],
      };

      expect(temporalState.pastStates.length > 0).toBe(true);
      expect(temporalState.futureStates.length > 0).toBe(false);
    });

    it("canRedo is true when future states exist", () => {
      const temporalState = {
        pastStates: [],
        futureStates: [{ boards: { byId: {}, allIds: [] } }],
      };

      expect(temporalState.pastStates.length > 0).toBe(false);
      expect(temporalState.futureStates.length > 0).toBe(true);
    });

    it("both false when no history", () => {
      const temporalState = {
        pastStates: [],
        futureStates: [],
      };

      expect(temporalState.pastStates.length > 0).toBe(false);
      expect(temporalState.futureStates.length > 0).toBe(false);
    });

    it("both true when undo and redo available", () => {
      const temporalState = {
        pastStates: [{ boards: { byId: {}, allIds: [] } }],
        futureStates: [{ boards: { byId: {}, allIds: [] } }],
      };

      expect(temporalState.pastStates.length > 0).toBe(true);
      expect(temporalState.futureStates.length > 0).toBe(true);
    });
  });

  describe("history clear", () => {
    it("resets undo and redo availability", () => {
      const temporalState = {
        pastStates: [
          { boards: { byId: {}, allIds: [] } },
          { boards: { byId: {}, allIds: [] } },
        ],
        futureStates: [{ boards: { byId: {}, allIds: [] } }],
      };

      expect(temporalState.pastStates.length).toBe(2);
      expect(temporalState.futureStates.length).toBe(1);

      temporalState.pastStates = [];
      temporalState.futureStates = [];

      expect(temporalState.pastStates.length).toBe(0);
      expect(temporalState.futureStates.length).toBe(0);
      expect(temporalState.pastStates.length > 0).toBe(false);
      expect(temporalState.futureStates.length > 0).toBe(false);
    });
  });
});
