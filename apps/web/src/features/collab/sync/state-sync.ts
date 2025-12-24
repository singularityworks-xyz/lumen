import { createLogger } from "@lumen/logger";
import type * as Y from "yjs";
import {
  needsRepair,
  repairState,
} from "@/src/features/collab/validation/fixer";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { YJS_MAP_NAMES } from "./entity-sync";
import {
  areaPositionSync,
  areaSync,
  boardConnectionSync,
  boardPositionSync,
  boardSync,
  columnSync,
  taskSync,
  workspaceSync,
} from "./syncs";

const logger = createLogger({ name: "collab:state-sync" });

// Apply all Y.Doc data to Zustand state.
// Returns a partial state that can be merged with existing state.
// IMPORTANT: This MERGES the synced data with existing state rather than replacing it,
// to preserve workspaces and entities that are not part of the current collaboration session.
// The currentWorkspaceId is used to filter synced data to only include the workspace being collaborated on.
export function applyYjsToState(
  doc: Y.Doc,
  currentState?: Partial<KanbanState>,
  currentWorkspaceId?: string | null
): Partial<KanbanState> {
  const syncedWorkspaces = workspaceSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.WORKSPACE)
  );

  // Merge synced workspaces with existing workspaces (preserve existing ones not in Yjs)
  const workspaces = currentState?.workspaces
    ? {
        byId: { ...currentState.workspaces.byId },
        allIds: [...currentState.workspaces.allIds],
      }
    : { byId: {}, allIds: [] as string[] };

  // ONLY apply the workspace that matches currentWorkspaceId (if provided)
  // This prevents other workspaces (like owner's default) from being added to the editor's state
  for (const id of syncedWorkspaces.allIds) {
    // Skip workspaces that don't match the current workspace ID (if filtering is enabled)
    if (currentWorkspaceId && id !== currentWorkspaceId) {
      logger.debug("Skipping synced workspace - not current workspace", {
        syncedId: id,
        currentId: currentWorkspaceId,
      });
      continue;
    }

    const synced = syncedWorkspaces.byId[id];
    // Preserve local-only fields if they exist
    const existing = workspaces.byId[id];
    if (synced) {
      workspaces.byId[id] = {
        ...synced,
        isShared: existing?.isShared,
        ownerId: existing?.ownerId,
        ownerName: existing?.ownerName,
        ownerImage: existing?.ownerImage,
        shareToken: existing?.shareToken,
        isDeleted: existing?.isDeleted,
      };
      if (!workspaces.allIds.includes(id)) {
        workspaces.allIds.push(id);
      }
    }
  }

  // For other entities, merge synced data with existing data
  const syncedBoards = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));
  const syncedColumns = columnSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.COLUMNS)
  );
  const syncedTasks = taskSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.TASKS));
  const syncedBoardPositions = boardPositionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS)
  );
  const syncedBoardConnections = boardConnectionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS)
  );
  const syncedAreas = areaSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.AREAS));
  const syncedAreaPositions = areaPositionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS)
  );

  // Helper to merge entity maps, optionally filtering by workspace
  const mergeEntityMaps = <T extends { id: string }>(
    existing: { byId: Record<string, T>; allIds: string[] } | undefined,
    synced: { byId: Record<string, T>; allIds: string[] },
    filterFn?: (item: T) => boolean
  ): { byId: Record<string, T>; allIds: string[] } => {
    const merged = existing
      ? { byId: { ...existing.byId }, allIds: [...existing.allIds] }
      : { byId: {} as Record<string, T>, allIds: [] as string[] };

    for (const id of synced.allIds) {
      const syncedItem = synced.byId[id];
      if (syncedItem) {
        if (filterFn && !filterFn(syncedItem)) {
          continue;
        }
        merged.byId[id] = syncedItem;
        if (!merged.allIds.includes(id)) {
          merged.allIds.push(id);
        }
      }
    }

    return merged;
  };

  // Filter functions to only include entities belonging to the current workspace
  const boardBelongsToWorkspace = (board: { workspace_id?: string }): boolean =>
    !currentWorkspaceId || board.workspace_id === currentWorkspaceId;

  // Get the set of board IDs that belong to current workspace (for filtering columns/tasks)
  const workspaceBoardIds = new Set(
    syncedBoards.allIds.filter((id) => {
      const board = syncedBoards.byId[id];
      return board && boardBelongsToWorkspace(board);
    })
  );

  const entityBelongsToWorkspaceBoard = (entity: {
    board_id?: string;
  }): boolean =>
    !currentWorkspaceId ||
    Boolean(entity.board_id && workspaceBoardIds.has(entity.board_id));

  const areaBelongsToWorkspace = (area: { workspace_id?: string }): boolean =>
    !currentWorkspaceId || area.workspace_id === currentWorkspaceId;

  // Get the set of area IDs that belong to current workspace
  const workspaceAreaIds = new Set(
    syncedAreas.allIds.filter((id) => {
      const area = syncedAreas.byId[id];
      return area && areaBelongsToWorkspace(area);
    })
  );

  const boards = mergeEntityMaps(
    currentState?.boards,
    syncedBoards,
    boardBelongsToWorkspace
  );
  const columns = mergeEntityMaps(
    currentState?.columns,
    syncedColumns,
    entityBelongsToWorkspaceBoard
  );
  const tasks = mergeEntityMaps(
    currentState?.tasks,
    syncedTasks,
    entityBelongsToWorkspaceBoard
  );
  const boardPositions = mergeEntityMaps(
    currentState?.boardPositions,
    syncedBoardPositions,
    (pos): boolean => !currentWorkspaceId || workspaceBoardIds.has(pos.id)
  );
  const boardConnections = mergeEntityMaps(
    currentState?.boardConnections,
    syncedBoardConnections,
    (conn): boolean =>
      !currentWorkspaceId ||
      Boolean(
        conn.source_board_id &&
          workspaceBoardIds.has(conn.source_board_id) &&
          conn.target_board_id &&
          workspaceBoardIds.has(conn.target_board_id)
      )
  );
  const areas = mergeEntityMaps(
    currentState?.areas,
    syncedAreas,
    areaBelongsToWorkspace
  );
  const areaPositions = mergeEntityMaps(
    currentState?.areaPositions,
    syncedAreaPositions,
    (pos) => !currentWorkspaceId || workspaceAreaIds.has(pos.id)
  );

  logger.debug("Applied Yjs to state (merged)", {
    currentWorkspaceId,
    syncedWorkspaces: syncedWorkspaces.allIds.length,
    totalWorkspaces: workspaces.allIds.length,
    syncedBoards: syncedBoards.allIds.length,
    filteredBoards:
      boards.allIds.length - (currentState?.boards?.allIds.length ?? 0),
    totalBoards: boards.allIds.length,
  });

  return {
    workspaces,
    boards,
    columns,
    tasks,
    boardPositions,
    boardConnections,
    areas,
    areaPositions,
  };
}

// Apply Yjs data and run fixers if needed.
export function applyYjsToStateWithRepair(
  doc: Y.Doc,
  currentState: KanbanState,
  currentWorkspaceId?: string | null
): Partial<KanbanState> {
  const yjsState = applyYjsToState(doc, currentState, currentWorkspaceId);

  // Merge with current state for repair check
  const mergedState = {
    ...currentState,
    ...yjsState,
  };

  // Run fixers if needed
  if (needsRepair(mergedState)) {
    logger.info("Running state repair after Yjs sync");
    const repairedState = repairState(mergedState);

    // Return only the repaired entity maps
    return {
      workspaces: repairedState.workspaces,
      boards: repairedState.boards,
      columns: repairedState.columns,
      tasks: repairedState.tasks,
      boardPositions: repairedState.boardPositions,
      boardConnections: repairedState.boardConnections,
      areas: repairedState.areas,
      areaPositions: repairedState.areaPositions,
    };
  }

  return yjsState;
}

// Initialize Y.Doc from Zustand state (only if Y.Maps are empty).
// WARNING: This pushes ALL data to Yjs. Use initializeYjsForWorkspace for workspace-specific sync.
export function initializeYjsFromState(doc: Y.Doc, state: KanbanState): void {
  workspaceSync.initializeYjs(doc, state.workspaces);
  boardSync.initializeYjs(doc, state.boards);
  columnSync.initializeYjs(doc, state.columns);
  taskSync.initializeYjs(doc, state.tasks);
  boardPositionSync.initializeYjs(doc, state.boardPositions);
  boardConnectionSync.initializeYjs(doc, state.boardConnections);
  areaSync.initializeYjs(doc, state.areas);
  areaPositionSync.initializeYjs(doc, state.areaPositions);

  logger.info("Initialized Yjs from Zustand state");
}

// Initialize Y.Doc with data for a SPECIFIC workspace only.
// This prevents other workspaces' data from being synced to the collab room.
export function initializeYjsForWorkspace(
  doc: Y.Doc,
  state: KanbanState,
  workspaceId: string
): void {
  const workspace = state.workspaces.byId[workspaceId];
  if (!workspace) {
    logger.warn("Cannot initialize Yjs: workspace not found", { workspaceId });
    return;
  }

  // Only sync the specific workspace
  const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
  if (workspaceMap.size === 0) {
    doc.transact(() => {
      workspaceMap.set(workspaceId, workspace);
    });
    logger.debug("Initialized workspace in Yjs", { workspaceId });
  }

  // Only sync boards that belong to this workspace
  const workspaceBoards = state.boards.allIds
    .map((id) => state.boards.byId[id])
    .filter((board) => board && board.workspace_id === workspaceId);

  const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
  if (boardsMap.size === 0 && workspaceBoards.length > 0) {
    doc.transact(() => {
      for (const board of workspaceBoards) {
        if (board) {
          boardsMap.set(board.id, board);
        }
      }
    });
    logger.debug("Initialized boards in Yjs", {
      count: workspaceBoards.length,
    });
  }

  // Collect column IDs from workspace boards
  const workspaceBoardIds = new Set(
    workspaceBoards.map((b) => b?.id).filter(Boolean)
  );
  const workspaceColumnIds = new Set<string>();
  for (const board of workspaceBoards) {
    if (board) {
      for (const colId of board.column_ids) {
        workspaceColumnIds.add(colId);
      }
    }
  }

  // Only sync columns that belong to workspace boards
  const workspaceColumns = state.columns.allIds
    .map((id) => state.columns.byId[id])
    .filter((col) => col && workspaceBoardIds.has(col.board_id));

  const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
  if (columnsMap.size === 0 && workspaceColumns.length > 0) {
    doc.transact(() => {
      for (const column of workspaceColumns) {
        if (column) {
          columnsMap.set(column.id, column);
        }
      }
    });
    logger.debug("Initialized columns in Yjs", {
      count: workspaceColumns.length,
    });
  }

  // Only sync tasks that belong to workspace boards
  const workspaceTasks = state.tasks.allIds
    .map((id) => state.tasks.byId[id])
    .filter((task) => task && workspaceBoardIds.has(task.board_id));

  const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
  if (tasksMap.size === 0 && workspaceTasks.length > 0) {
    doc.transact(() => {
      for (const task of workspaceTasks) {
        if (task) {
          tasksMap.set(task.id, task);
        }
      }
    });
    logger.debug("Initialized tasks in Yjs", { count: workspaceTasks.length });
  }

  // Only sync board positions for workspace boards
  const workspaceBoardPositions = state.boardPositions.allIds
    .map((id) => state.boardPositions.byId[id])
    .filter((pos) => pos && workspaceBoardIds.has(pos.id));

  const boardPositionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
  if (boardPositionsMap.size === 0 && workspaceBoardPositions.length > 0) {
    doc.transact(() => {
      for (const pos of workspaceBoardPositions) {
        if (pos) {
          boardPositionsMap.set(pos.id, pos);
        }
      }
    });
    logger.debug("Initialized board positions in Yjs", {
      count: workspaceBoardPositions.length,
    });
  }

  // Only sync board connections where both boards belong to this workspace
  const workspaceBoardConnections = state.boardConnections.allIds
    .map((id) => state.boardConnections.byId[id])
    .filter(
      (conn) =>
        conn &&
        workspaceBoardIds.has(conn.source_board_id) &&
        workspaceBoardIds.has(conn.target_board_id)
    );

  const boardConnectionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS);
  if (boardConnectionsMap.size === 0 && workspaceBoardConnections.length > 0) {
    doc.transact(() => {
      for (const conn of workspaceBoardConnections) {
        if (conn) {
          boardConnectionsMap.set(conn.id, conn);
        }
      }
    });
    logger.debug("Initialized board connections in Yjs", {
      count: workspaceBoardConnections.length,
    });
  }

  // Only sync areas that belong to this workspace
  const workspaceAreas = state.areas.allIds
    .map((id) => state.areas.byId[id])
    .filter((area) => area && area.workspace_id === workspaceId);

  const areasMap = doc.getMap(YJS_MAP_NAMES.AREAS);
  if (areasMap.size === 0 && workspaceAreas.length > 0) {
    doc.transact(() => {
      for (const area of workspaceAreas) {
        if (area) {
          areasMap.set(area.id, area);
        }
      }
    });
    logger.debug("Initialized areas in Yjs", { count: workspaceAreas.length });
  }

  // Only sync area positions for workspace areas
  const workspaceAreaIds = new Set(
    workspaceAreas.map((a) => a?.id).filter(Boolean)
  );
  const workspaceAreaPositions = state.areaPositions.allIds
    .map((id) => state.areaPositions.byId[id])
    .filter((pos) => pos && workspaceAreaIds.has(pos.id));

  const areaPositionsMap = doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS);
  if (areaPositionsMap.size === 0 && workspaceAreaPositions.length > 0) {
    doc.transact(() => {
      for (const pos of workspaceAreaPositions) {
        if (pos) {
          areaPositionsMap.set(pos.id, pos);
        }
      }
    });
    logger.debug("Initialized area positions in Yjs", {
      count: workspaceAreaPositions.length,
    });
  }

  logger.info("Initialized Yjs for workspace", {
    workspaceId,
    boards: workspaceBoards.length,
    columns: workspaceColumns.length,
    tasks: workspaceTasks.length,
  });
}

// Observe all Y.Maps for changes and call handler.
export function observeYjsChanges(
  doc: Y.Doc,
  onChange: () => void
): () => void {
  const maps = [
    doc.getMap(YJS_MAP_NAMES.WORKSPACE),
    doc.getMap(YJS_MAP_NAMES.BOARDS),
    doc.getMap(YJS_MAP_NAMES.COLUMNS),
    doc.getMap(YJS_MAP_NAMES.TASKS),
    doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS),
    doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS),
    doc.getMap(YJS_MAP_NAMES.AREAS),
    doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS),
  ];

  for (const map of maps) {
    map.observe(onChange);
  }

  return () => {
    for (const map of maps) {
      map.unobserve(onChange);
    }
  };
}
