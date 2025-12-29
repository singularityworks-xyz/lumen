"use client";

import { createLogger } from "@lumen/logger";
import { useCallback, useEffect, useRef } from "react";
import type * as Y from "yjs";
import {
  applyYjsToStateWithRepair,
  initializeYjsForWorkspace,
  observeYjsChanges,
} from "@/src/features/collab/sync/state-sync";
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
  columnDialogSync,
  columnQuickActionsSync,
  columnSync,
  commentSync,
  connectionDialogSync,
  createTaskModalSync,
  taskQuickActionsSync,
  taskSync,
  workspaceSync,
} from "@/src/features/collab/sync/syncs";
import { diffEntityMaps } from "@/src/features/collab/utils/deep-equals";
import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Comment,
  Task,
  Workspace,
} from "@/src/features/kanban";
import { useKanbanStore } from "@/src/features/kanban";

const logger = createLogger({ name: "collab:yjs-sync" });
const POSITION_THROTTLE_MS = 14;

export type YjsSyncActions = {
  // Sync a board change to Yjs
  syncBoard: (board: Board) => void;
  // Delete a board from Yjs
  deleteBoard: (id: string) => void;
  // Sync a column change to Yjs
  syncColumn: (column: Column) => void;
  // Delete a column from Yjs
  deleteColumn: (id: string) => void;
  // Sync a task change to Yjs
  syncTask: (task: Task) => void;
  // Delete a task from Yjs
  deleteTask: (id: string) => void;
  // Sync a board position change to YjsMapName
  syncBoardPosition: (position: BoardPosition) => void;
  // Delete a board position from Yjs
  deleteBoardPosition: (id: string) => void;
  // Sync a board connection to Yjs
  syncBoardConnection: (connection: BoardConnection) => void;
  // Delete a board connection from Yjs
  deleteBoardConnection: (id: string) => void;
  // Sync an area to Yjs
  syncArea: (area: Area) => void;
  // Delete an area from Yjs
  deleteArea: (id: string) => void;
  // Sync an area position to Yjs
  syncAreaPosition: (position: AreaPosition) => void;
  // Delete an area position from Yjs
  deleteAreaPosition: (id: string) => void;
  // Sync a workspace to Yjs
  syncWorkspace: (workspace: Workspace) => void;
  // Delete a workspace from Yjs
  deleteWorkspace: (id: string) => void;
  // Sync a comment to Yjs
  syncComment: (comment: Comment) => void;
  // Delete a comment from Yjs
  deleteComment: (id: string) => void;
};

// Hook for bidirectional Yjs <-> Zustand synchronization.
export function useYjsSync(
  doc: Y.Doc | null,
  isConnected: boolean,
  currentWorkspaceId: string | null
): YjsSyncActions {
  const isUpdatingFromYjsRef = useRef(false);
  const prevStateRef = useRef<ReturnType<
    typeof useKanbanStore.getState
  > | null>(null);

  // Track last sync times for throttling position updates
  const lastAreaPosSyncRef = useRef<Record<string, number>>({});

  const applyYjsChanges = useCallback(() => {
    if (!doc || isUpdatingFromYjsRef.current) {
      return;
    }

    isUpdatingFromYjsRef.current = true;

    try {
      const currentState = useKanbanStore.getState();
      const newState = applyYjsToStateWithRepair(
        doc,
        currentState,
        currentWorkspaceId
      );
      useKanbanStore.setState(newState);

      // Update workspace.board_ids to match synced boards
      // This ensures shared workspace users see boards instead of welcome screen
      // IMPORTANT: Only add boards that actually belong to this workspace (by checking workspace_id)
      const workspaceId = currentState.currentWorkspaceId;
      if (workspaceId && newState.boards) {
        useKanbanStore.setState((state) => {
          const workspace = state.workspaces.byId[workspaceId];
          if (workspace) {
            const syncedBoardIds = newState.boards?.allIds ?? [];
            const newBoardIds: string[] = [];

            for (const boardId of syncedBoardIds) {
              const board = newState.boards?.byId[boardId];
              if (
                board &&
                board.workspace_id === workspaceId &&
                !workspace.board_ids.includes(boardId)
              ) {
                newBoardIds.push(boardId);
              }
            }

            // Only update if there are new boards to add (immutable update)
            if (newBoardIds.length > 0) {
              return {
                workspaces: {
                  ...state.workspaces,
                  byId: {
                    ...state.workspaces.byId,
                    [workspaceId]: {
                      ...workspace,
                      board_ids: [...workspace.board_ids, ...newBoardIds],
                    },
                  },
                },
              };
            }
          }
          return state;
        });
        logger.debug("Synced workspace.board_ids with Yjs boards", {
          workspaceId,
          boardCount: newState.boards.allIds.length,
        });
      }

      logger.debug("Applied Yjs changes to Zustand");
    } finally {
      isUpdatingFromYjsRef.current = false;
    }
  }, [doc, currentWorkspaceId]);

  useEffect(() => {
    // CRITICAL: Only initialize Yjs sync when connected AND we have a valid workspace ID
    if (!(doc && isConnected && currentWorkspaceId)) {
      return;
    }

    const state = useKanbanStore.getState();
    const boardsMap = doc.getMap("boards");

    // Server is source of truth - only push local state if server is empty
    // IMPORTANT: Only push data for the CURRENT workspace, not all workspaces
    if (boardsMap.size === 0 && currentWorkspaceId) {
      const workspaceBoards = state.boards.allIds.filter(
        (id) => state.boards.byId[id]?.workspace_id === currentWorkspaceId
      );
      if (workspaceBoards.length > 0) {
        logger.info("Server empty, pushing current workspace state to Yjs", {
          workspaceId: currentWorkspaceId,
          boardCount: workspaceBoards.length,
        });
        initializeYjsForWorkspace(doc, state, currentWorkspaceId);
      }
    } else if (boardsMap.size > 0) {
      logger.info("Server has data, pulling from Yjs", {
        serverBoards: boardsMap.size,
      });
      applyYjsChanges();
    }

    prevStateRef.current = state;
    const unobserve = observeYjsChanges(doc, applyYjsChanges);
    return unobserve;
  }, [doc, isConnected, applyYjsChanges, currentWorkspaceId]);

  useEffect(() => {
    // CRITICAL: Only sync to Yjs when connected AND we have a valid workspace ID
    // This prevents local data from being synced to the wrong workspace
    if (!(doc && isConnected && currentWorkspaceId)) {
      return;
    }
    const unsubscribe = useKanbanStore.subscribe((state, prevState) => {
      if (isUpdatingFromYjsRef.current) {
        return;
      }

      // Diff and sync workspaces (Only for current workspace)
      // We only sync the current workspace to avoid polluting the room with other workspaces
      if (currentWorkspaceId) {
        const workspaceDiff = diffEntityMaps(
          prevState.workspaces.byId,
          state.workspaces.byId
        );
        for (const workspace of [
          ...workspaceDiff.added,
          ...workspaceDiff.changed,
        ]) {
          if (workspace.id === currentWorkspaceId) {
            workspaceSync.setInYjs(doc, workspace);
          }
        }
        // We don't delete workspaces from Yjs here usually as it might affect other users
        // But if needed:
        // for (const id of workspaceDiff.removed) {
        //   if (id === currentWorkspaceId) workspaceSync.deleteFromYjs(doc, id);
        // }
      }

      // Diff and sync boards
      const boardDiff = diffEntityMaps(
        prevState.boards.byId,
        state.boards.byId
      );
      for (const board of [...boardDiff.added, ...boardDiff.changed]) {
        boardSync.setInYjs(doc, board);
      }
      for (const id of boardDiff.removed) {
        boardSync.deleteFromYjs(doc, id);
      }

      // Diff and sync columns
      const columnDiff = diffEntityMaps(
        prevState.columns.byId,
        state.columns.byId
      );
      for (const column of [...columnDiff.added, ...columnDiff.changed]) {
        columnSync.setInYjs(doc, column);
      }
      for (const id of columnDiff.removed) {
        columnSync.deleteFromYjs(doc, id);
      }

      // Diff and sync tasks
      const taskDiff = diffEntityMaps(prevState.tasks.byId, state.tasks.byId);
      for (const task of [...taskDiff.added, ...taskDiff.changed]) {
        taskSync.setInYjs(doc, task);
      }
      for (const id of taskDiff.removed) {
        taskSync.deleteFromYjs(doc, id);
      }

      // Diff and sync board positions - with throttling for drag performance
      const posDiff = diffEntityMaps(
        prevState.boardPositions.byId,
        state.boardPositions.byId
      );
      const now = Date.now();
      for (const pos of [...posDiff.added, ...posDiff.changed]) {
        // For board positions, always sync immediately since board dragging is infrequent
        // and we want to ensure final positions are always captured (especially on removal)
        boardPositionSync.setInYjs(doc, pos);
      }
      for (const id of posDiff.removed) {
        boardPositionSync.deleteFromYjs(doc, id);
      }

      // Diff and sync board connections
      const connDiff = diffEntityMaps(
        prevState.boardConnections.byId,
        state.boardConnections.byId
      );
      for (const conn of [...connDiff.added, ...connDiff.changed]) {
        boardConnectionSync.setInYjs(doc, conn);
      }
      for (const id of connDiff.removed) {
        boardConnectionSync.deleteFromYjs(doc, id);
      }

      // Diff and sync areas
      const areaDiff = diffEntityMaps(prevState.areas.byId, state.areas.byId);
      for (const area of [...areaDiff.added, ...areaDiff.changed]) {
        areaSync.setInYjs(doc, area);
      }
      for (const id of areaDiff.removed) {
        areaSync.deleteFromYjs(doc, id);
      }

      // Diff and sync area positions - with throttling for drag performance
      const areaPosDiff = diffEntityMaps(
        prevState.areaPositions.byId,
        state.areaPositions.byId
      );
      for (const pos of [...areaPosDiff.added, ...areaPosDiff.changed]) {
        const lastSync = lastAreaPosSyncRef.current[pos.id] || 0;
        // Throttle position updates during drag
        if (now - lastSync >= POSITION_THROTTLE_MS) {
          lastAreaPosSyncRef.current[pos.id] = now;
          areaPositionSync.setInYjs(doc, pos);
        }
      }
      for (const id of areaPosDiff.removed) {
        delete lastAreaPosSyncRef.current[id];
        delete lastAreaPosSyncRef.current[id];
        areaPositionSync.deleteFromYjs(doc, id);
      }

      // Diff and sync comments
      const commentDiff = diffEntityMaps(
        prevState.comments.byId,
        state.comments.byId
      );
      for (const comment of [...commentDiff.added, ...commentDiff.changed]) {
        commentSync.setInYjs(doc, comment);
      }
      for (const id of commentDiff.removed) {
        commentSync.deleteFromYjs(doc, id);
      }

      // Diff and sync area dialogs
      const areaDialogDiff = diffEntityMaps(
        prevState.areaDialogs,
        state.areaDialogs
      );
      for (const dialog of [
        ...areaDialogDiff.added,
        ...areaDialogDiff.changed,
      ]) {
        areaDialogSync.setInYjs(doc, dialog);
      }
      for (const id of areaDialogDiff.removed) {
        areaDialogSync.deleteFromYjs(doc, id);
      }

      // Diff and sync board quick actions (dialog menus)
      const prevQuickActions = Object.entries(
        prevState.boardQuickActions
      ).reduce(
        (acc, [boardId, qa]) => {
          if (qa) {
            acc[boardId] = { id: boardId, boardId, position: qa.position };
          }
          return acc;
        },
        {} as Record<
          string,
          { id: string; boardId: string; position: { x: number; y: number } }
        >
      );
      const currQuickActions = Object.entries(state.boardQuickActions).reduce(
        (acc, [boardId, qa]) => {
          if (qa) {
            acc[boardId] = { id: boardId, boardId, position: qa.position };
          }
          return acc;
        },
        {} as Record<
          string,
          { id: string; boardId: string; position: { x: number; y: number } }
        >
      );
      const qaDiff = diffEntityMaps(prevQuickActions, currQuickActions);
      if (
        qaDiff.added.length > 0 ||
        qaDiff.changed.length > 0 ||
        qaDiff.removed.length > 0
      ) {
        logger.debug("Syncing quick actions to Yjs", {
          added: qaDiff.added.length,
          changed: qaDiff.changed.length,
          removed: qaDiff.removed.length,
        });
      }
      for (const qa of [...qaDiff.added, ...qaDiff.changed]) {
        boardQuickActionsSync.setInYjs(doc, qa);
      }
      for (const id of qaDiff.removed) {
        boardQuickActionsSync.deleteFromYjs(doc, id);
      }

      // Diff and sync board dialogs
      const dialogDiff = diffEntityMaps(
        prevState.boardDialogs,
        state.boardDialogs
      );
      if (
        dialogDiff.added.length > 0 ||
        dialogDiff.changed.length > 0 ||
        dialogDiff.removed.length > 0
      ) {
        logger.debug("Syncing board dialogs to Yjs", {
          added: dialogDiff.added.length,
          changed: dialogDiff.changed.length,
          removed: dialogDiff.removed.length,
        });
      }
      for (const dialog of [...dialogDiff.added, ...dialogDiff.changed]) {
        boardDialogSync.setInYjs(doc, dialog);
      }
      for (const id of dialogDiff.removed) {
        boardDialogSync.deleteFromYjs(doc, id);
      }

      // Diff and sync connection dialog
      // connectionDialog is a single object or null, so we handle it specially
      const prevConnDialog = prevState.connectionDialog;
      const currConnDialog = state.connectionDialog;

      // Full connection dialog type for syncing
      type ConnDialogSync = {
        id: string;
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
      };

      // Convert to record format for diffing (using boardId as key)
      const prevConnDialogMap: Record<string, ConnDialogSync> = {};
      if (prevConnDialog) {
        prevConnDialogMap[prevConnDialog.boardId] = {
          id: prevConnDialog.boardId,
          boardId: prevConnDialog.boardId,
          position: prevConnDialog.position,
          selectedTargetId: prevConnDialog.selectedTargetId,
          editingConnectionId: prevConnDialog.editingConnectionId,
          sourceHandle: prevConnDialog.sourceHandle,
          targetHandle: prevConnDialog.targetHandle,
          lineStyle: prevConnDialog.lineStyle,
          showArrow: prevConnDialog.showArrow,
          label: prevConnDialog.label,
          searchQuery: prevConnDialog.searchQuery,
        };
      }

      const currConnDialogMap: Record<string, ConnDialogSync> = {};
      if (currConnDialog) {
        currConnDialogMap[currConnDialog.boardId] = {
          id: currConnDialog.boardId,
          boardId: currConnDialog.boardId,
          position: currConnDialog.position,
          selectedTargetId: currConnDialog.selectedTargetId,
          editingConnectionId: currConnDialog.editingConnectionId,
          sourceHandle: currConnDialog.sourceHandle,
          targetHandle: currConnDialog.targetHandle,
          lineStyle: currConnDialog.lineStyle,
          showArrow: currConnDialog.showArrow,
          label: currConnDialog.label,
          searchQuery: currConnDialog.searchQuery,
        };
      }

      const connDialogDiff = diffEntityMaps(
        prevConnDialogMap,
        currConnDialogMap
      );
      for (const dialog of [
        ...connDialogDiff.added,
        ...connDialogDiff.changed,
      ]) {
        connectionDialogSync.setInYjs(doc, dialog);
        logger.debug("Synced connection dialog to Yjs", {
          boardId: dialog.boardId,
        });
      }
      for (const id of connDialogDiff.removed) {
        connectionDialogSync.deleteFromYjs(doc, id);
        logger.debug("Removed connection dialog from Yjs", { boardId: id });
      }

      // Diff and sync create task modals
      const createTaskModalDiff = diffEntityMaps(
        prevState.createTaskModals,
        state.createTaskModals
      );
      if (
        createTaskModalDiff.added.length > 0 ||
        createTaskModalDiff.changed.length > 0 ||
        createTaskModalDiff.removed.length > 0
      ) {
        logger.debug("Syncing create task modals to Yjs", {
          added: createTaskModalDiff.added.length,
          changed: createTaskModalDiff.changed.length,
          removed: createTaskModalDiff.removed.length,
        });
      }
      for (const modal of [
        ...createTaskModalDiff.added,
        ...createTaskModalDiff.changed,
      ]) {
        createTaskModalSync.setInYjs(doc, modal);
      }
      for (const id of createTaskModalDiff.removed) {
        createTaskModalSync.deleteFromYjs(doc, id);
      }

      // Diff and sync column quick actions
      // Convert column quick actions to entity map format for diffing
      const prevColumnQAMap: Record<
        string,
        {
          id: string;
          columnId: string;
          boardId: string;
          showAddTask: boolean;
          position: { x: number; y: number };
        }
      > = {};
      for (const [columnId, qa] of Object.entries(
        prevState.columnQuickActions
      )) {
        if (qa) {
          prevColumnQAMap[columnId] = {
            id: columnId,
            columnId: qa.columnId,
            boardId: qa.boardId,
            showAddTask: qa.showAddTask,
            position: qa.position,
          };
        }
      }

      const currColumnQAMap: Record<
        string,
        {
          id: string;
          columnId: string;
          boardId: string;
          showAddTask: boolean;
          position: { x: number; y: number };
        }
      > = {};
      for (const [columnId, qa] of Object.entries(state.columnQuickActions)) {
        if (qa) {
          currColumnQAMap[columnId] = {
            id: columnId,
            columnId: qa.columnId,
            boardId: qa.boardId,
            showAddTask: qa.showAddTask,
            position: qa.position,
          };
        }
      }

      const columnQADiff = diffEntityMaps(prevColumnQAMap, currColumnQAMap);
      for (const qa of [...columnQADiff.added, ...columnQADiff.changed]) {
        columnQuickActionsSync.setInYjs(doc, qa);
      }
      for (const id of columnQADiff.removed) {
        columnQuickActionsSync.deleteFromYjs(doc, id);
      }

      // Diff and sync column dialogs
      const prevColumnDialogMap: Record<
        string,
        (typeof state.columnDialogs)[string] & { id: string }
      > = {};
      for (const [dialogId, dialog] of Object.entries(
        prevState.columnDialogs
      )) {
        if (dialog) {
          prevColumnDialogMap[dialogId] = { ...dialog, id: dialogId };
        }
      }

      const currColumnDialogMap: Record<
        string,
        (typeof state.columnDialogs)[string] & { id: string }
      > = {};
      for (const [dialogId, dialog] of Object.entries(state.columnDialogs)) {
        if (dialog) {
          currColumnDialogMap[dialogId] = { ...dialog, id: dialogId };
        }
      }

      const columnDialogDiff = diffEntityMaps(
        prevColumnDialogMap,
        currColumnDialogMap
      );
      for (const dialog of [
        ...columnDialogDiff.added,
        ...columnDialogDiff.changed,
      ]) {
        columnDialogSync.setInYjs(doc, dialog);
      }
      for (const id of columnDialogDiff.removed) {
        columnDialogSync.deleteFromYjs(doc, id);
      }

      const prevTaskQAMap: Record<
        string,
        {
          id: string;
          taskId: string;
          boardId: string;
          columnId: string;
          position: { x: number; y: number };
        }
      > = {};
      for (const [taskId, qa] of Object.entries(prevState.taskQuickActions)) {
        if (qa) {
          prevTaskQAMap[taskId] = {
            id: taskId,
            taskId: qa.taskId,
            boardId: qa.boardId,
            columnId: qa.columnId,
            position: qa.position,
          };
        }
      }

      const currTaskQAMap: Record<
        string,
        {
          id: string;
          taskId: string;
          boardId: string;
          columnId: string;
          position: { x: number; y: number };
        }
      > = {};
      for (const [taskId, qa] of Object.entries(state.taskQuickActions)) {
        if (qa) {
          currTaskQAMap[taskId] = {
            id: taskId,
            taskId: qa.taskId,
            boardId: qa.boardId,
            columnId: qa.columnId,
            position: qa.position,
          };
        }
      }

      const taskQADiff = diffEntityMaps(prevTaskQAMap, currTaskQAMap);
      for (const qa of [...taskQADiff.added, ...taskQADiff.changed]) {
        taskQuickActionsSync.setInYjs(doc, qa);
      }
      for (const id of taskQADiff.removed) {
        taskQuickActionsSync.deleteFromYjs(doc, id);
      }

      // NOTE: Task detail modals are synced by dedicated useTaskDialogSync hook
      // This provides better ownership tracking and prevents race conditions
      // Diff and sync area drag origins
      // Convert to entity map format for diffing
      const prevAreaDragOriginsMap: Record<
        string,
        { id: string; originX: number; originY: number }
      > = {};
      for (const [areaId, origin] of Object.entries(
        prevState.areaDragOrigins
      )) {
        if (origin) {
          prevAreaDragOriginsMap[areaId] = {
            id: areaId,
            originX: origin.originX,
            originY: origin.originY,
          };
        }
      }

      const currAreaDragOriginsMap: Record<
        string,
        { id: string; originX: number; originY: number }
      > = {};
      for (const [areaId, origin] of Object.entries(state.areaDragOrigins)) {
        if (origin) {
          currAreaDragOriginsMap[areaId] = {
            id: areaId,
            originX: origin.originX,
            originY: origin.originY,
          };
        }
      }

      const areaDragOriginDiff = diffEntityMaps(
        prevAreaDragOriginsMap,
        currAreaDragOriginsMap
      );
      for (const origin of [
        ...areaDragOriginDiff.added,
        ...areaDragOriginDiff.changed,
      ]) {
        // We probably don't need throttling for origins since they are constant during drag
        // But for safety/consistency and to handle cleanup well:
        areaDragOriginSync.setInYjs(doc, origin);
      }
      for (const id of areaDragOriginDiff.removed) {
        areaDragOriginSync.deleteFromYjs(doc, id);

        // Force sync the final area position to ensure Yjs is up to date.
        // This handles cases where the final drag position update was throttled and skipped.
        // We use the current state (post-drag) to get the final position.
        const areaPos = state.areaPositions.byId[id];
        if (areaPos) {
          areaPositionSync.setInYjs(doc, areaPos);
          lastAreaPosSyncRef.current[id] = Date.now();
        }
      }
    });

    return unsubscribe;
  }, [doc, isConnected, currentWorkspaceId]);

  // Manual sync actions (for explicit sync when needed)
  const syncBoard = useCallback(
    (board: Board) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardSync.setInYjs(doc, board);
      }
    },
    [doc, isConnected]
  );

  const deleteBoard = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncColumn = useCallback(
    (column: Column) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        columnSync.setInYjs(doc, column);
      }
    },
    [doc, isConnected]
  );

  const deleteColumn = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        columnSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncTask = useCallback(
    (task: Task) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        taskSync.setInYjs(doc, task);
      }
    },
    [doc, isConnected]
  );

  const deleteTask = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        taskSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncBoardPosition = useCallback(
    (position: BoardPosition) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardPositionSync.setInYjs(doc, position);
      }
    },
    [doc, isConnected]
  );

  const deleteBoardPosition = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardPositionSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncBoardConnection = useCallback(
    (connection: BoardConnection) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardConnectionSync.setInYjs(doc, connection);
      }
    },
    [doc, isConnected]
  );

  const deleteBoardConnection = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        boardConnectionSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncArea = useCallback(
    (area: Area) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        areaSync.setInYjs(doc, area);
      }
    },
    [doc, isConnected]
  );

  const deleteArea = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        areaSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncAreaPosition = useCallback(
    (position: AreaPosition) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        areaPositionSync.setInYjs(doc, position);
      }
    },
    [doc, isConnected]
  );

  const deleteAreaPosition = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        areaPositionSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncWorkspace = useCallback(
    (workspace: Workspace) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        workspaceSync.setInYjs(doc, workspace);
      }
    },
    [doc, isConnected]
  );

  const deleteWorkspace = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        workspaceSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  const syncComment = useCallback(
    (comment: Comment) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        commentSync.setInYjs(doc, comment);
      }
    },
    [doc, isConnected]
  );

  const deleteComment = useCallback(
    (id: string) => {
      if (doc && isConnected && !isUpdatingFromYjsRef.current) {
        commentSync.deleteFromYjs(doc, id);
      }
    },
    [doc, isConnected]
  );

  return {
    syncBoard,
    deleteBoard,
    syncColumn,
    deleteColumn,
    syncTask,
    deleteTask,
    syncBoardPosition,
    deleteBoardPosition,
    syncBoardConnection,
    deleteBoardConnection,
    syncArea,
    deleteArea,
    syncAreaPosition,
    deleteAreaPosition,
    syncWorkspace,
    deleteWorkspace,
    syncComment,
    deleteComment,
  };
}
