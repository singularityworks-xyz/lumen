import { createLogger } from "@lumen/logger";
import type * as Y from "yjs";
import {
  needsRepair,
  repairState,
} from "@/src/features/collab/validation/fixer";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { YJS_MAP_NAMES } from "./entity-sync";
import {
  areaDialogSync,
  areaDragOriginSync,
  areaPositionSync,
  areaSync,
  boardConnectionSync,
  boardDialogSync,
  boardPositionSync,
  boardQuickActionsSync,
  boardSync,
  chatMessageSync,
  columnDialogSync,
  columnQuickActionsSync,
  columnSync,
  commentSync,
  connectionDialogSync,
  createTaskModalSync,
  taskQuickActionsSync,
  taskSync,
  workspaceSync,
} from "./syncs";

const logger = createLogger({ name: "collab:state-sync" });

export interface ApplyYjsOptions {
  // When true (default), writes metadata back to Y.Doc to track synced entities.
  // Set to false for read-only operations where you don't want to trigger
  // bidirectional sync or metadata writes that propagate to peers.
  writeMetadata?: boolean;
}

// Apply all Y.Doc data to Zustand state.
// Returns a partial state that can be merged with existing state.
// IMPORTANT: This MERGES the synced data with existing state rather than replacing it,
// to preserve workspaces and entities that are not part of the current collaboration session.
// The currentWorkspaceId is used to filter synced data to only include the workspace being collaborated on.
//
// NOTE: This function both reads from and writes to the Y.Doc. Specifically:
// - It reads entity data from the various Y.Maps (boards, columns, tasks, etc.)
// - It may write metadata back to the METADATA map to track which entities have been synced
// - Set options.writeMetadata to false to skip the metadata write (useful for read-only operations)
export function applyYjsToState(
  doc: Y.Doc,
  currentState?: Partial<KanbanState>,
  currentWorkspaceId?: string | null,
  options?: ApplyYjsOptions
): Partial<KanbanState> {
  // CRITICAL: If no workspace ID is provided, don't apply any changes
  // This prevents local workspace data from being affected by stale Yjs state
  if (!currentWorkspaceId) {
    logger.debug("Skipping Yjs sync - no workspace ID provided");
    return {};
  }

  // Read METADATA to track which entities have been synced to Yjs
  // This enables accurate deletion detection during sync
  const metadataMap = doc.getMap(YJS_MAP_NAMES.METADATA);
  const syncedEntitiesMetadata = (metadataMap.get("syncedEntities") as Record<
    string,
    string[]
  >) || {
    boards: [],
    columns: [],
    tasks: [],
    boardPositions: [],
    boardConnections: [],
    areas: [],
    areaPositions: [],
    comments: [],
    chatMessages: [],
  };

  // Build sets of IDs that were previously synced to Yjs
  const previouslySyncedIds = {
    boards: new Set(syncedEntitiesMetadata.boards),
    columns: new Set(syncedEntitiesMetadata.columns),
    tasks: new Set(syncedEntitiesMetadata.tasks),
    boardPositions: new Set(syncedEntitiesMetadata.boardPositions),
    boardConnections: new Set(syncedEntitiesMetadata.boardConnections),
    areas: new Set(syncedEntitiesMetadata.areas),
    areaPositions: new Set(syncedEntitiesMetadata.areaPositions),
    comments: new Set(syncedEntitiesMetadata.comments),
    chatMessages: new Set(syncedEntitiesMetadata.chatMessages),
  };

  // Track new synced IDs for this sync operation
  const newSyncedIds = {
    boards: new Set<string>(),
    columns: new Set<string>(),
    tasks: new Set<string>(),
    boardPositions: new Set<string>(),
    boardConnections: new Set<string>(),
    areas: new Set<string>(),
    areaPositions: new Set<string>(),
    comments: new Set<string>(),
    chatMessages: new Set<string>(),
  };

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
  // Keep references to raw Yjs maps for existence checking in merge
  const boardsYjsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
  const columnsYjsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
  const tasksYjsMap = doc.getMap(YJS_MAP_NAMES.TASKS);
  const syncedBoards = boardSync.applyFromYjs(boardsYjsMap);
  const syncedColumns = columnSync.applyFromYjs(columnsYjsMap);
  const syncedTasks = taskSync.applyFromYjs(tasksYjsMap);
  const boardPositionsYjsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
  const syncedBoardPositions =
    boardPositionSync.applyFromYjs(boardPositionsYjsMap);
  const syncedBoardConnections = boardConnectionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS)
  );
  const syncedAreas = areaSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.AREAS));
  const syncedAreaPositions = areaPositionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS)
  );
  const syncedComments = commentSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.COMMENTS)
  );
  const syncedChatMessages = chatMessageSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.CHAT_MESSAGES)
  );

  // Helper to merge entity maps, handling additions, updates, AND deletions
  // For entities belonging to the current workspace, if they exist locally but not in Yjs,
  // they should be removed (they were deleted by another collaborator)
  // NOTE: We pass the raw Yjs map to check for existence even if validation failed
  interface MergeOptions<T> {
    belongsToWorkspaceFn?: (item: T) => boolean;
    filterFn?: (item: T) => boolean;
    // Set to track newly synced IDs for this sync
    newSyncedIds?: Set<string>;
    // Set of IDs that were previously synced to Yjs (from METADATA)
    // Used to determine which entities were in Yjs (vs local-only)
    previouslySyncedIds?: Set<string>;
    rawYjsMap?: Y.Map<unknown>;
  }

  const mergeEntityMaps = <T extends { id: string }>(
    existing: { byId: Record<string, T>; allIds: string[] } | undefined,
    synced: { byId: Record<string, T>; allIds: string[] },
    options?: MergeOptions<T>
  ): { byId: Record<string, T>; allIds: string[] } => {
    const merged = existing
      ? { byId: { ...existing.byId }, allIds: [...existing.allIds] }
      : { byId: {} as Record<string, T>, allIds: [] as string[] };

    // Track which IDs from Yjs passed validation
    const syncedWorkspaceIds = new Set<string>();

    // Add/update items from Yjs
    for (const id of synced.allIds) {
      const syncedItem = synced.byId[id];
      if (syncedItem) {
        if (options?.filterFn && !options.filterFn(syncedItem)) {
          continue;
        }
        syncedWorkspaceIds.add(id);
        merged.byId[id] = syncedItem;
        if (!merged.allIds.includes(id)) {
          merged.allIds.push(id);
        }
      }
    }

    // Remove items that exist locally but not in Yjs (deleted by other collaborator)
    // Only remove if:
    // 1. They belong to the current workspace
    // 2. They were previously synced to Yjs (tracked in METADATA)
    // 3. They are not currently in Yjs
    // This preserves local-only items that were never synced to Yjs
    if (currentWorkspaceId && options?.belongsToWorkspaceFn) {
      const idsToRemove: string[] = [];
      for (const id of merged.allIds) {
        const item = merged.byId[id];
        if (!(item && options.belongsToWorkspaceFn(item))) {
          continue;
        }

        // Check if this entity was previously synced to Yjs
        // If it was, it should be deleted when absent from Yjs
        // If it was never synced (local-only), preserve it
        const wasEverSynced =
          options.previouslySyncedIds?.has(id) || syncedWorkspaceIds.has(id);

        // If it was synced and is now absent from Yjs, delete it
        const isInYjsNow = options.rawYjsMap?.has(id) ?? false;
        if (wasEverSynced && !isInYjsNow) {
          idsToRemove.push(id);
        }
      }
      for (const id of idsToRemove) {
        delete merged.byId[id];
        merged.allIds = merged.allIds.filter((i) => i !== id);
      }
    }

    // Track newly synced IDs for METADATA update
    if (options?.newSyncedIds) {
      for (const id of merged.allIds) {
        if (syncedWorkspaceIds.has(id)) {
          options.newSyncedIds.add(id);
        }
      }
    }

    return merged;
  };

  // FILTER FUNCTION: Used when adding items from Yjs to merged state
  // Be permissive - include local boards to preserve them
  const boardFilterFn = (board: {
    workspace_id?: string;
    id?: string;
  }): boolean => {
    // If no current workspace filter, include all
    if (!currentWorkspaceId) {
      return true;
    }
    // If workspace matches, include
    if (board.workspace_id === currentWorkspaceId) {
      return true;
    }
    // If board already exists in local state, keep it (don't filter out existing boards)
    if (board.id && currentState?.boards?.byId[board.id]) {
      return true;
    }

    // CRITICAL FIX: If this board has an open task detail modal, we MUST keep it
    // otherwise the modal will disappear/close because its parent board is gone
    if (board.id && currentState?.taskDetailModals) {
      const hasOpenModal = Object.values(currentState.taskDetailModals).some(
        (modal) => modal?.boardId === board.id
      );
      if (hasOpenModal) {
        return true;
      }
    }

    // Otherwise, filter out
    return false;
  };

  // BELONGS TO WORKSPACE FUNCTION: Used for deletion logic
  // STRICT - only return true for items that ACTUALLY belong to the synced workspace
  // This prevents local workspace items from being considered for deletion
  const boardBelongsToSyncedWorkspace = (board: {
    workspace_id?: string;
  }): boolean => {
    // Only return true if this board belongs to the workspace we're syncing
    // This is a STRICT check - local boards should NOT be considered
    return board.workspace_id === currentWorkspaceId;
  };

  // Get the set of board IDs that belong to current workspace (for filtering columns/tasks)
  // Be permissive - include boards that are already in local state
  const workspaceBoardIds = new Set(
    syncedBoards.allIds.filter((id) => {
      const board = syncedBoards.byId[id];
      if (!board) {
        return false;
      }
      // If board exists in local state, include it
      if (currentState?.boards?.byId[id]) {
        return true;
      }
      // Otherwise use workspace filter
      return boardBelongsToSyncedWorkspace(board);
    })
  );

  const entityBelongsToWorkspaceBoard = (entity: {
    board_id?: string;
  }): boolean =>
    !currentWorkspaceId ||
    Boolean(entity.board_id && workspaceBoardIds.has(entity.board_id));

  const areaBelongsToWorkspace = (area: { workspace_id?: string }): boolean =>
    !currentWorkspaceId || area.workspace_id === currentWorkspaceId;

  const workspaceAreaIds = new Set(
    syncedAreas.allIds.filter((id) => {
      const area = syncedAreas.byId[id];
      return area && areaBelongsToWorkspace(area);
    })
  );

  const boards = mergeEntityMaps(currentState?.boards, syncedBoards, {
    filterFn: boardFilterFn,
    belongsToWorkspaceFn: boardBelongsToSyncedWorkspace,
    rawYjsMap: boardsYjsMap,
    previouslySyncedIds: previouslySyncedIds.boards,
    newSyncedIds: newSyncedIds.boards,
  });

  // STRICT: Check if an entity's board belongs to the SYNCED workspace
  // This is used for deletion logic - only consider deleting items whose parent board
  // is in the synced workspace
  const entityBelongsToSyncedWorkspaceBoard = (entity: {
    board_id?: string;
  }): boolean => {
    if (!entity.board_id) {
      return false;
    }
    const board = boards.byId[entity.board_id];
    return board?.workspace_id === currentWorkspaceId;
  };

  const columns = mergeEntityMaps(currentState?.columns, syncedColumns, {
    filterFn: entityBelongsToWorkspaceBoard,
    belongsToWorkspaceFn: entityBelongsToSyncedWorkspaceBoard,
    rawYjsMap: columnsYjsMap,
    previouslySyncedIds: previouslySyncedIds.columns,
    newSyncedIds: newSyncedIds.columns,
  });
  const tasks = mergeEntityMaps(currentState?.tasks, syncedTasks, {
    filterFn: entityBelongsToWorkspaceBoard,
    belongsToWorkspaceFn: entityBelongsToSyncedWorkspaceBoard,
    rawYjsMap: tasksYjsMap,
    previouslySyncedIds: previouslySyncedIds.tasks,
    newSyncedIds: newSyncedIds.tasks,
  });

  // Helper: Check if a board position belongs to synced workspace
  const boardPositionBelongsToSyncedWorkspace = (pos: {
    id: string;
  }): boolean => {
    const board = boards.byId[pos.id];
    return board?.workspace_id === currentWorkspaceId;
  };

  const boardPositions = mergeEntityMaps(
    currentState?.boardPositions,
    syncedBoardPositions,
    {
      filterFn: (pos): boolean =>
        !currentWorkspaceId || workspaceBoardIds.has(pos.id),
      belongsToWorkspaceFn: boardPositionBelongsToSyncedWorkspace,
      rawYjsMap: boardPositionsYjsMap,
      previouslySyncedIds: previouslySyncedIds.boardPositions,
      newSyncedIds: newSyncedIds.boardPositions,
    }
  );

  // Helper: Check if a connection belongs to synced workspace
  const connectionBelongsToSyncedWorkspace = (conn: {
    source_board_id: string;
    target_board_id: string;
  }): boolean => {
    const sourceBoard = boards.byId[conn.source_board_id];
    const targetBoard = boards.byId[conn.target_board_id];
    return (
      sourceBoard?.workspace_id === currentWorkspaceId &&
      targetBoard?.workspace_id === currentWorkspaceId
    );
  };

  const boardConnections = mergeEntityMaps(
    currentState?.boardConnections,
    syncedBoardConnections,
    {
      filterFn: (conn): boolean =>
        !currentWorkspaceId ||
        Boolean(
          conn.source_board_id &&
            workspaceBoardIds.has(conn.source_board_id) &&
            conn.target_board_id &&
            workspaceBoardIds.has(conn.target_board_id)
        ),
      belongsToWorkspaceFn: connectionBelongsToSyncedWorkspace,
      previouslySyncedIds: previouslySyncedIds.boardConnections,
      newSyncedIds: newSyncedIds.boardConnections,
    }
  );

  // STRICT: Area belongs to synced workspace
  const areaBelongsToSyncedWorkspace = (area: {
    workspace_id?: string;
  }): boolean => area.workspace_id === currentWorkspaceId;

  const areas = mergeEntityMaps(currentState?.areas, syncedAreas, {
    filterFn: areaBelongsToWorkspace,
    belongsToWorkspaceFn: areaBelongsToSyncedWorkspace,
    previouslySyncedIds: previouslySyncedIds.areas,
    newSyncedIds: newSyncedIds.areas,
  });

  // Helper: Area position belongs to synced workspace
  const areaPositionBelongsToSyncedWorkspace = (pos: {
    id: string;
  }): boolean => {
    const area = areas.byId[pos.id];
    return area?.workspace_id === currentWorkspaceId;
  };

  const areaPositions = mergeEntityMaps(
    currentState?.areaPositions,
    syncedAreaPositions,
    {
      filterFn: (pos) => !currentWorkspaceId || workspaceAreaIds.has(pos.id),
      belongsToWorkspaceFn: areaPositionBelongsToSyncedWorkspace,
      previouslySyncedIds: previouslySyncedIds.areaPositions,
      newSyncedIds: newSyncedIds.areaPositions,
    }
  );

  const comments = mergeEntityMaps(currentState?.comments, syncedComments, {
    filterFn: (comment) =>
      !currentWorkspaceId || comment.workspaceId === currentWorkspaceId,
    belongsToWorkspaceFn: (comment) =>
      !currentWorkspaceId || comment.workspaceId === currentWorkspaceId,
    previouslySyncedIds: previouslySyncedIds.comments,
    newSyncedIds: newSyncedIds.comments,
  });

  const chatMessages = mergeEntityMaps(
    currentState?.chatMessages,
    syncedChatMessages,
    {
      filterFn: (msg) =>
        !currentWorkspaceId || msg.workspaceId === currentWorkspaceId,
      belongsToWorkspaceFn: (msg) =>
        !currentWorkspaceId || msg.workspaceId === currentWorkspaceId,
      previouslySyncedIds: previouslySyncedIds.chatMessages,
      newSyncedIds: newSyncedIds.chatMessages,
    }
  );

  // Sync dialogs - these don't need workspace filtering (ephemeral UI state)
  const syncedBoardQuickActions = boardQuickActionsSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_QUICK_ACTIONS)
  );
  const syncedBoardDialogs = boardDialogSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_DIALOGS)
  );

  // Convert board quick actions from entity map format to Record format
  const boardQuickActions: Record<
    string,
    { boardId: string; position: { x: number; y: number } }
  > = {};
  for (const id of syncedBoardQuickActions.allIds) {
    const qa = syncedBoardQuickActions.byId[id];
    if (qa) {
      boardQuickActions[qa.boardId] = {
        boardId: qa.boardId,
        position: qa.position,
      };
    }
  }

  // Convert board dialogs from entity map format to Record format
  const boardDialogs: Record<string, (typeof syncedBoardDialogs.byId)[string]> =
    {};
  for (const id of syncedBoardDialogs.allIds) {
    const dialog = syncedBoardDialogs.byId[id];
    if (dialog) {
      boardDialogs[dialog.id] = dialog;
    }
  }

  // Sync connection dialogs - ephemeral UI state
  const syncedConnectionDialogs = connectionDialogSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.CONNECTION_DIALOGS)
  );

  // Convert connection dialogs to the KanbanState format (single object or null)
  // We pick the first one if any (there should only be one per board at a time)
  let connectionDialog: {
    boardId: string;
    position: { x: number; y: number };
    selectedTargetId?: string | null;
    editingConnectionId?: string | null;
    sourceHandle?: "top" | "right" | "bottom" | "left";
    targetHandle?: "top" | "right" | "bottom" | "left";
    lineStyle?: "solid" | "dotted";
    showArrow?: boolean;
    label?: string;
    searchQuery?: string;
  } | null = null;
  if (syncedConnectionDialogs.allIds.length > 0) {
    const firstId = syncedConnectionDialogs.allIds[0];
    const dialog = firstId ? syncedConnectionDialogs.byId[firstId] : undefined;
    if (dialog) {
      connectionDialog = {
        boardId: dialog.boardId,
        position: dialog.position,
        selectedTargetId: dialog.selectedTargetId,
        editingConnectionId: dialog.editingConnectionId,
        sourceHandle: dialog.sourceHandle,
        targetHandle: dialog.targetHandle,
        lineStyle: dialog.lineStyle,
        showArrow: dialog.showArrow,
        label: dialog.label,
        searchQuery: dialog.searchQuery,
      };
    }
  }

  // Sync create task modals - ephemeral UI state
  const syncedCreateTaskModals = createTaskModalSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.CREATE_TASK_MODALS)
  );

  // Convert create task modals from entity map format to Record format
  const createTaskModals: Record<
    string,
    (typeof syncedCreateTaskModals.byId)[string]
  > = {};
  for (const id of syncedCreateTaskModals.allIds) {
    const modal = syncedCreateTaskModals.byId[id];
    if (modal) {
      createTaskModals[modal.id] = modal;
    }
  }

  logger.debug("Applied Yjs to state (merged)", {
    currentWorkspaceId,
    syncedWorkspaces: syncedWorkspaces.allIds.length,
    totalWorkspaces: workspaces.allIds.length,
    syncedBoards: syncedBoards.allIds.length,
    filteredBoards:
      boards.allIds.length - (currentState?.boards?.allIds.length ?? 0),
    totalBoards: boards.allIds.length,
    syncedDialogs: syncedBoardDialogs.allIds.length,
    syncedQuickActions: syncedBoardQuickActions.allIds.length,
    syncedConnectionDialogs: syncedConnectionDialogs.allIds.length,
    syncedCreateTaskModals: syncedCreateTaskModals.allIds.length,
  });

  // Sync column quick actions - ephemeral UI state
  const syncedColumnQuickActions = columnQuickActionsSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS)
  );

  // Convert column quick actions from entity map format to Record format
  const columnQuickActions: Record<
    string,
    {
      columnId: string;
      boardId: string;
      showAddTask: boolean;
      position: { x: number; y: number };
    }
  > = {};
  for (const id of syncedColumnQuickActions.allIds) {
    const qa = syncedColumnQuickActions.byId[id];
    if (qa) {
      columnQuickActions[qa.columnId] = {
        columnId: qa.columnId,
        boardId: qa.boardId,
        showAddTask: qa.showAddTask,
        position: qa.position,
      };
    }
  }

  // Sync column dialogs - ephemeral UI state
  const syncedColumnDialogs = columnDialogSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.COLUMN_DIALOGS)
  );

  // Sync column dialogs from entity map format to Record format
  const columnDialogs: Record<
    string,
    {
      id: string;
      type: "rename" | "delete" | "move";
      columnId: string;
      columnName: string;
      columnDescription?: string;
      boardId: string;
      boardName: string;
      inputValue?: string;
      descriptionValue?: string;
      position: { x: number; y: number };
    }
  > = {};
  for (const id of syncedColumnDialogs.allIds) {
    const dialog = syncedColumnDialogs.byId[id];
    if (dialog) {
      columnDialogs[dialog.id] = dialog;
    }
  }

  // Sync task quick actions - ephemeral UI state
  // IMPORTANT: Only ADD/UPDATE here, deletion handled by use-yjs-sync.ts
  const syncedTaskQuickActions = taskQuickActionsSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.TASK_QUICK_ACTIONS)
  );

  // Start with existing local quick actions (preserve all local state)
  const taskQuickActions: Record<
    string,
    {
      taskId: string;
      boardId: string;
      columnId: string;
      position: { x: number; y: number };
    }
  > = currentState?.taskQuickActions
    ? { ...currentState.taskQuickActions }
    : {};

  // Apply synced quick actions from Yjs (add new ones and update existing)
  for (const id of syncedTaskQuickActions.allIds) {
    const qa = syncedTaskQuickActions.byId[id];
    if (qa) {
      taskQuickActions[qa.taskId] = {
        taskId: qa.taskId,
        boardId: qa.boardId,
        columnId: qa.columnId,
        position: qa.position,
      };
    }
  }

  // NOTE: We do NOT delete quick actions here
  // Deletion is handled by taskQuickActionsSync.deleteFromYjs() in use-yjs-sync.ts

  // NOTE: Task detail modals are NOT synced here
  // They are handled by the dedicated useTaskDialogSync hook
  // This provides better ownership tracking and prevents race conditions

  // Sync area dialogs - ephemeral UI state
  const syncedAreaDialogs = areaDialogSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.AREA_DIALOGS)
  );

  // Convert area dialogs from entity map format to Record format
  const areaDialogs: Record<
    string,
    {
      id: string;
      areaId: string;
      areaName: string;
      position: { x: number; y: number };
      inputValue?: string;
    }
  > = {};
  for (const id of syncedAreaDialogs.allIds) {
    const dialog = syncedAreaDialogs.byId[id];
    if (dialog) {
      areaDialogs[dialog.id] = dialog;
    }
  }

  // Sync area drag origins - ephemeral UI state
  const syncedAreaDragOrigins = areaDragOriginSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.AREA_DRAG_ORIGINS)
  );

  // Convert area drag origins from entity map format to Record format
  const areaDragOrigins: Record<string, { originX: number; originY: number }> =
    {};
  for (const id of syncedAreaDragOrigins.allIds) {
    const origin = syncedAreaDragOrigins.byId[id];
    if (origin) {
      areaDragOrigins[origin.id] = {
        originX: origin.originX,
        originY: origin.originY,
      };
    }
  }

  // Update METADATA with newly synced IDs
  // This tracks which entities have been synced to Yjs, enabling accurate deletion detection
  const updatedSyncedEntities = {
    boards: [
      ...new Set([
        ...(syncedEntitiesMetadata.boards || []),
        ...newSyncedIds.boards,
      ]),
    ],
    columns: [
      ...new Set([
        ...(syncedEntitiesMetadata.columns || []),
        ...newSyncedIds.columns,
      ]),
    ],
    tasks: [
      ...new Set([
        ...(syncedEntitiesMetadata.tasks || []),
        ...newSyncedIds.tasks,
      ]),
    ],
    boardPositions: [
      ...new Set([
        ...(syncedEntitiesMetadata.boardPositions || []),
        ...newSyncedIds.boardPositions,
      ]),
    ],
    boardConnections: [
      ...new Set([
        ...(syncedEntitiesMetadata.boardConnections || []),
        ...newSyncedIds.boardConnections,
      ]),
    ],
    areas: [
      ...new Set([
        ...(syncedEntitiesMetadata.areas || []),
        ...newSyncedIds.areas,
      ]),
    ],
    areaPositions: [
      ...new Set([
        ...(syncedEntitiesMetadata.areaPositions || []),
        ...newSyncedIds.areaPositions,
      ]),
    ],
    comments: [
      ...new Set([
        ...(syncedEntitiesMetadata.comments || []),
        ...newSyncedIds.comments,
      ]),
    ],
    chatMessages: [
      ...new Set([
        ...(syncedEntitiesMetadata.chatMessages || []),
        ...newSyncedIds.chatMessages,
      ]),
    ],
  };

  // Persist updated syncedEntities to METADATA map
  // Only write metadata if options.writeMetadata is not explicitly false
  if (options?.writeMetadata !== false) {
    // Prune deleted IDs: filter out IDs that no longer exist in the merged state
    // This ensures deleted entities are removed from METADATA
    const prunedUpdatedSyncedEntities = {
      boards: updatedSyncedEntities.boards.filter((id) =>
        boards.allIds.includes(id)
      ),
      columns: updatedSyncedEntities.columns.filter((id) =>
        columns.allIds.includes(id)
      ),
      tasks: updatedSyncedEntities.tasks.filter((id) =>
        tasks.allIds.includes(id)
      ),
      boardPositions: updatedSyncedEntities.boardPositions.filter((id) =>
        boardPositions.allIds.includes(id)
      ),
      boardConnections: updatedSyncedEntities.boardConnections.filter((id) =>
        boardConnections.allIds.includes(id)
      ),
      areas: updatedSyncedEntities.areas.filter((id) =>
        areas.allIds.includes(id)
      ),
      areaPositions: updatedSyncedEntities.areaPositions.filter((id) =>
        areaPositions.allIds.includes(id)
      ),
      comments: updatedSyncedEntities.comments.filter((id) =>
        comments.allIds.includes(id)
      ),
      chatMessages: updatedSyncedEntities.chatMessages.filter((id) =>
        chatMessages.allIds.includes(id)
      ),
    };
    metadataMap.set("syncedEntities", prunedUpdatedSyncedEntities);
  }

  return {
    workspaces,
    boards,
    columns,
    tasks,
    boardPositions,
    boardConnections,
    areas,
    areaPositions,
    comments,
    chatMessages,
    areaDragOrigins,
    areaDialogs,
    boardQuickActions,
    boardDialogs,
    connectionDialog,
    createTaskModals,
    columnQuickActions,
    columnDialogs,
    taskQuickActions,
    // taskDetailModals are NOT included - handled by useTaskDialogSync
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

  // NOTE: State repair is temporarily disabled to debug sync issues
  // The repair was running on every sync and incorrectly recreating board positions
  // Run fixers if needed - DISABLED for debugging
  if (needsRepair(mergedState)) {
    logger.info("Running state repair after Yjs sync");
    const repairedState = repairState(mergedState);

    // Return only the repaired entity maps + dialogs from original yjsState
    return {
      workspaces: repairedState.workspaces,
      boards: repairedState.boards,
      columns: repairedState.columns,
      tasks: repairedState.tasks,
      boardPositions: repairedState.boardPositions,
      boardConnections: repairedState.boardConnections,
      areas: repairedState.areas,
      areaPositions: repairedState.areaPositions,
      areaDragOrigins: yjsState.areaDragOrigins,
      // Dialogs don't need repair, pass through from yjsState
      boardQuickActions: yjsState.boardQuickActions,
      boardDialogs: yjsState.boardDialogs,
      connectionDialog: yjsState.connectionDialog,
      createTaskModals: yjsState.createTaskModals,
      columnQuickActions: yjsState.columnQuickActions,
      columnDialogs: yjsState.columnDialogs,
      taskQuickActions: yjsState.taskQuickActions,
      areaDialogs: yjsState.areaDialogs,
      // taskDetailModals are NOT included - handled by useTaskDialogSync
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
  commentSync.initializeYjs(doc, state.comments);

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

  const workspaceComments = state.comments.allIds
    .map((id) => state.comments.byId[id])
    .filter((comment) => comment && comment.workspaceId === workspaceId);

  const commentsMap = doc.getMap(YJS_MAP_NAMES.COMMENTS);
  if (commentsMap.size === 0 && workspaceComments.length > 0) {
    doc.transact(() => {
      for (const comment of workspaceComments) {
        if (comment) {
          commentsMap.set(comment.id, comment);
        }
      }
    });
    logger.debug("Initialized comments in Yjs", {
      count: workspaceComments.length,
    });
  }

  const workspaceChatMessages =
    state.chatMessages?.allIds
      ?.map((id) => state.chatMessages.byId[id])
      ?.filter((msg) => msg && msg.workspaceId === workspaceId) ?? [];

  const chatMessagesMap = doc.getMap(YJS_MAP_NAMES.CHAT_MESSAGES);
  if (chatMessagesMap.size === 0 && workspaceChatMessages.length > 0) {
    doc.transact(() => {
      for (const msg of workspaceChatMessages) {
        if (msg) {
          chatMessagesMap.set(msg.id, msg);
        }
      }
    });
    logger.debug("Initialized chat messages in Yjs", {
      count: workspaceChatMessages.length,
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
    doc.getMap(YJS_MAP_NAMES.AREA_DRAG_ORIGINS),
    doc.getMap(YJS_MAP_NAMES.BOARD_QUICK_ACTIONS),
    doc.getMap(YJS_MAP_NAMES.BOARD_DIALOGS),
    doc.getMap(YJS_MAP_NAMES.CONNECTION_DIALOGS),
    doc.getMap(YJS_MAP_NAMES.CREATE_TASK_MODALS),
    doc.getMap(YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS),
    doc.getMap(YJS_MAP_NAMES.COLUMN_DIALOGS),
    doc.getMap(YJS_MAP_NAMES.TASK_QUICK_ACTIONS),
    doc.getMap(YJS_MAP_NAMES.AREA_DIALOGS),
    doc.getMap(YJS_MAP_NAMES.COMMENTS),
    doc.getMap(YJS_MAP_NAMES.CHAT_MESSAGES),
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
