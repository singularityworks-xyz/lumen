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
    boardPositions: { byId: {}, allIds: [] },
    boardConnections: { byId: {}, allIds: [] },
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
    selectedTaskIds: [],
    draggedTaskId: null,
    workspaceQuickActions: null,
    workspaceDialog: null,
    columnQuickActions: null,
    columnDialog: null,
    boardQuickActions: null,
    boardDialogs: {},
    connectionDialog: null,
  };
}
