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
  areaPositionSync,
  areaSync,
  boardConnectionSync,
  boardPositionSync,
  boardSync,
  columnSync,
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
  Task,
  Workspace,
} from "@/src/features/kanban";
import { useKanbanStore } from "@/src/features/kanban";

const logger = createLogger({ name: "collab:yjs-sync" });

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
};

// Hook for bidirectional Yjs <-> Zustand synchronization.
// @param doc - Y.Doc instance (null when not connected)
// @param isConnected - Whether WebSocket is connected
// @returns Sync actions to call when Zustand state changes
export function useYjsSync(
  doc: Y.Doc | null,
  isConnected: boolean,
  currentWorkspaceId: string | null
): YjsSyncActions {
  const isUpdatingFromYjsRef = useRef(false);
  const prevStateRef = useRef<ReturnType<
    typeof useKanbanStore.getState
  > | null>(null);

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
            for (const boardId of syncedBoardIds) {
              const board = newState.boards?.byId[boardId];
              if (
                board &&
                board.workspace_id === workspaceId &&
                !workspace.board_ids.includes(boardId)
              ) {
                workspace.board_ids.push(boardId);
              }
            }
          }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: na
  useEffect(() => {
    if (!(doc && isConnected)) {
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
  }, [doc, isConnected, applyYjsChanges]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: na
  useEffect(() => {
    if (!(doc && isConnected)) {
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

      // Diff and sync board positions
      const posDiff = diffEntityMaps(
        prevState.boardPositions.byId,
        state.boardPositions.byId
      );
      for (const pos of [...posDiff.added, ...posDiff.changed]) {
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

      // Diff and sync area positions
      const areaPosDiff = diffEntityMaps(
        prevState.areaPositions.byId,
        state.areaPositions.byId
      );
      for (const pos of [...areaPosDiff.added, ...areaPosDiff.changed]) {
        areaPositionSync.setInYjs(doc, pos);
      }
      for (const id of areaPosDiff.removed) {
        areaPositionSync.deleteFromYjs(doc, id);
      }
    });

    return unsubscribe;
  }, [doc, isConnected]);

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
  };
}
