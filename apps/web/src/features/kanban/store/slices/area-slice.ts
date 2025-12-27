"use client";

import type { Area } from "../../types";
import { generateAreaId, generateDialogId } from "../ids";
import type { KanbanStore } from "../types";

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addArea"
  | "updateArea"
  | "removeArea"
  | "updateAreaPosition"
  | "updateAreaDimensions"
  | "setSelectionBox"
  | "clearSelectionBox"
  | "attachBoardToArea"
  | "detachBoardFromArea"
  | "openAreaDialog"
  | "closeAreaDialog"
  | "updateAreaDialogPosition"
  | "updateAreaDialogInputValue"
>;

const DEFAULT_AREA_COLOR = "#9ca3af";

export const createAreaSlice: SliceCreator = (set, get) => ({
  addArea: (name, position, dimensions, workspaceId) => {
    const wsId = workspaceId ?? get().currentWorkspaceId;

    if (!wsId) {
      return "";
    }

    const id = generateAreaId();
    const area: Area = {
      id,
      name,
      workspace_id: wsId,
      color: DEFAULT_AREA_COLOR,
      board_ids: [],
      created_at: new Date().toISOString(),
    };

    set((state) => {
      state.areas.byId[id] = area;
      state.areas.allIds.push(id);

      state.areaPositions.byId[id] = {
        id,
        x: position.x,
        y: position.y,
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 10,
      };
      state.areaPositions.allIds.push(id);
    });

    return id;
  },

  updateArea: (areaId, updates) =>
    set((state) => {
      const area = state.areas.byId[areaId];
      if (area) {
        Object.assign(area, updates);
      }
    }),

  removeArea: (areaId) =>
    set((state) => {
      delete state.areas.byId[areaId];
      state.areas.allIds = state.areas.allIds.filter((id) => id !== areaId);

      delete state.areaPositions.byId[areaId];
      state.areaPositions.allIds = state.areaPositions.allIds.filter(
        (id) => id !== areaId
      );
    }),

  updateAreaPosition: (areaId, position) =>
    set((state) => {
      const area = state.areas.byId[areaId];
      const areaPos = state.areaPositions.byId[areaId];
      if (!(areaPos && area)) {
        return;
      }

      const deltaX = position.x - areaPos.x;
      const deltaY = position.y - areaPos.y;
      areaPos.x = position.x;
      areaPos.y = position.y;

      for (const boardId of area.board_ids ?? []) {
        const boardPos = state.boardPositions.byId[boardId];
        if (boardPos) {
          boardPos.x += deltaX;
          boardPos.y += deltaY;
        }
      }
    }),

  updateAreaDimensions: (areaId, dimensions) =>
    set((state) => {
      const areaPos = state.areaPositions.byId[areaId];
      if (areaPos) {
        areaPos.width = dimensions.width;
        areaPos.height = dimensions.height;
      }
    }),

  setSelectionBox: (box) =>
    set((state) => {
      state.selectionBox = box;
    }),

  clearSelectionBox: () =>
    set((state) => {
      state.selectionBox = null;
    }),

  attachBoardToArea: (areaId, boardId) =>
    set((state) => {
      const area = state.areas.byId[areaId];
      if (!area) {
        return;
      }

      if (!area.board_ids) {
        area.board_ids = [];
      }

      if (!area.board_ids.includes(boardId)) {
        for (const otherAreaId of state.areas.allIds) {
          const otherArea = state.areas.byId[otherAreaId];
          if (otherArea?.board_ids?.includes(boardId)) {
            otherArea.board_ids = otherArea.board_ids.filter(
              (id) => id !== boardId
            );
          }
        }
        area.board_ids.push(boardId);
      }
    }),

  detachBoardFromArea: (areaId, boardId) =>
    set((state) => {
      const area = state.areas.byId[areaId];
      if (area?.board_ids) {
        area.board_ids = area.board_ids.filter((id) => id !== boardId);
      }
    }),

  openAreaDialog: (options) => {
    const id = generateDialogId();
    set((state) => {
      state.areaDialogs[id] = {
        id,
        areaId: options.areaId,
        areaName: options.areaName,
        position: options.position,
        inputValue: options.areaName,
      };
    });
    return id;
  },

  closeAreaDialog: (id) =>
    set((state) => {
      delete state.areaDialogs[id];
    }),

  updateAreaDialogPosition: (id, position) =>
    set((state) => {
      if (state.areaDialogs[id]) {
        state.areaDialogs[id].position = position;
      }
    }),

  updateAreaDialogInputValue: (id, value) =>
    set((state) => {
      if (state.areaDialogs[id]) {
        state.areaDialogs[id].inputValue = value;
      }
    }),
});
