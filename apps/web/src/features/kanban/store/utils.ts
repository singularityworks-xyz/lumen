import type { BoardPosition, EntityMap, Workspace } from "../types";
import { generateWorkspaceId } from "./ids";
import type { KanbanState } from "./types";

export function getNextZIndex(positions: EntityMap<BoardPosition>): number {
  let maxZIndex = 0;
  for (const id of positions.allIds) {
    const pos = positions.byId[id];
    if (pos && pos.zIndex > maxZIndex) {
      maxZIndex = pos.zIndex;
    }
  }
  return maxZIndex + 1;
}

export function createDefaultWorkspace(): { workspace: Workspace; id: string } {
  const id = generateWorkspaceId();
  return {
    id,
    workspace: {
      id,
      name: "Default Workspace",
      description: "Your default workspace",
      created_at: new Date().toISOString(),
      board_ids: [],
    },
  };
}

export function createInitialState(): KanbanState {
  const { workspace, id } = createDefaultWorkspace();

  return {
    workspaces: {
      byId: { [id]: workspace },
      allIds: [id],
    },
    boards: { byId: {}, allIds: [] },
    columns: { byId: {}, allIds: [] },
    tasks: { byId: {}, allIds: [] },
    comments: { byId: {}, allIds: [] },
    chatMessages: { byId: {}, allIds: [] },
    boardPositions: { byId: {}, allIds: [] },
    boardConnections: { byId: {}, allIds: [] },
    textBoards: { byId: {}, allIds: [] },
    textBoardPositions: { byId: {}, allIds: [] },
    areas: { byId: {}, allIds: [] },
    areaPositions: { byId: {}, allIds: [] },
    selectionBox: null,
    currentWorkspaceId: id,
    canvas: {
      viewport: { x: 0, y: 0, zoom: 1 },
      focusedBoardId: null,
      lastInteractionTime: Date.now(),
    },
    showCommandPalette: false,
    showMiniMap: false,
    createTaskModals: {},
    taskDetailModals: {},
    interactionMode: "drag",
    shakingTaskDetailModalId: null,
    selectedBoardId: null,
    selectedBoardIds: [],
    workspaceShareUrls: {},
    selectedTaskIds: [],
    draggedTaskId: null,
    welcomeDismissed: false,
    workspaceQuickActions: null,
    workspaceDialog: null,
    columnQuickActions: {},
    columnDialogs: {},
    boardQuickActions: {},
    boardDialogs: {},
    connectionDialog: null,
    shareDialog: null,
    taskQuickActions: {},
    dialogFocusStack: [],
    columnUi: {},
    areaDialogs: {},
    deletedSharedWorkspaceId: null,
    isProfileModalOpen: false,
    lastTaskModalPositions: {},
    areaDragOrigins: {},
    lastActiveDrawerTab: "comments",
    isGuestMode: false,
    guestToken: null,
  };
}
