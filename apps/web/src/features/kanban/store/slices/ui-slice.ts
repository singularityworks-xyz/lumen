import type { KanbanStore } from "../types";

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "setViewport"
  | "setFocusedBoard"
  | "setShowCommandPalette"
  | "setShowMiniMap"
  | "setInteractionMode"
  | "setSelectedBoard"
  | "toggleBoardSelection"
  | "clearBoardSelection"
  | "toggleTaskSelection"
  | "clearTaskSelection"
>;

export const createUiSlice: SliceCreator = (set, _get) => ({
  setViewport: (viewport) =>
    set((state) => {
      state.canvas.viewport = viewport;
      state.canvas.lastInteractionTime = Date.now();
    }),

  setFocusedBoard: (boardId) =>
    set((state) => {
      state.canvas.focusedBoardId = boardId;
    }),

  setShowCommandPalette: (show) =>
    set((state) => {
      state.showCommandPalette = show;
    }),

  setShowMiniMap: (show) =>
    set((state) => {
      state.showMiniMap = show;
      const workspaceId = state.currentWorkspaceId;
      if (workspaceId && state.workspaces.byId[workspaceId]) {
        state.workspaces.byId[workspaceId].showMiniMap = show;
      }
    }),

  setInteractionMode: (mode) =>
    set((state) => {
      state.interactionMode = mode;
      if (mode === "drag") {
        state.selectedBoardIds = [];
      }
    }),

  setSelectedBoard: (boardId) =>
    set((state) => {
      state.selectedBoardId = boardId;
      if (boardId && state.currentWorkspaceId) {
        const workspace = state.workspaces.byId[state.currentWorkspaceId];
        if (workspace) {
          workspace.lastFocusedBoardId = boardId;
        }
      }
    }),

  toggleBoardSelection: (boardId) =>
    set((state) => {
      const index = state.selectedBoardIds.indexOf(boardId);
      if (index === -1) {
        state.selectedBoardIds.push(boardId);
      } else {
        state.selectedBoardIds.splice(index, 1);
      }
    }),

  clearBoardSelection: () =>
    set((state) => {
      state.selectedBoardIds = [];
    }),

  toggleTaskSelection: (taskId) =>
    set((state) => {
      const index = state.selectedTaskIds.indexOf(taskId);
      if (index === -1) {
        state.selectedTaskIds.push(taskId);
      } else {
        state.selectedTaskIds.splice(index, 1);
      }
    }),

  clearTaskSelection: () =>
    set((state) => {
      state.selectedTaskIds = [];
    }),
});
