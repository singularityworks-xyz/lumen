import { createLogger } from "@lumen/logger";
import { authClient } from "@/src/lib/auth-client";
import type { Workspace } from "../../types";
import {
  generateBoardId,
  generateColumnId,
  generateTaskId,
  generateWorkspaceId,
} from "../ids";
import type { KanbanStore } from "../types";
import { getNextZIndex } from "../utils";

const logger = createLogger({ name: "[client] kanban/workspace" });
const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "setCurrentWorkspace"
  | "addWorkspace"
  | "syncWorkspace"
  | "updateWorkspace"
  | "deleteWorkspace"
  | "setDeletedSharedWorkspace"
  | "resetWorkspace"
  | "duplicateWorkspace"
  | "openWorkspaceQuickActions"
  | "closeWorkspaceQuickActions"
  | "updateWorkspaceQuickActionsPosition"
  | "openWorkspaceDialog"
  | "closeWorkspaceDialog"
  | "updateWorkspaceDialogPosition"
  | "updateWorkspaceDialogInputValue"
  | "setWorkspaceShareUrl"
  | "clearWorkspaceShareUrl"
  | "markWorkspaceDeleted"
>;

export const createWorkspaceSlice: SliceCreator = (set, get) => ({
  setCurrentWorkspace: (workspaceId) =>
    set((state) => {
      if (workspaceId === null || state.workspaces.byId[workspaceId]) {
        const oldWorkspaceId = state.currentWorkspaceId;
        // Save current dialog state to the OLD workspace before switching
        if (oldWorkspaceId && state.workspaces.byId[oldWorkspaceId]) {
          state.workspaces.byId[oldWorkspaceId].lastViewport = {
            ...state.canvas.viewport,
          };
          state.workspaces.byId[oldWorkspaceId].showMiniMap = state.showMiniMap;
          // Save all dialog/modal state to the old workspace
          state.workspaces.byId[oldWorkspaceId].savedDialogState = {
            taskDetailModals: { ...state.taskDetailModals },
            createTaskModals: { ...state.createTaskModals },
            boardQuickActions: { ...state.boardQuickActions },
            boardDialogs: { ...state.boardDialogs },
            columnQuickActions: { ...state.columnQuickActions },
            columnDialogs: { ...state.columnDialogs },
            taskQuickActions: { ...state.taskQuickActions },
            connectionDialog: state.connectionDialog
              ? { ...state.connectionDialog }
              : null,
            areaDialogs: { ...state.areaDialogs },
            dialogFocusStack: [...state.dialogFocusStack],
            selectedTaskIds: [...state.selectedTaskIds],
            selectedBoardId: state.selectedBoardId,
            selectedBoardIds: [...state.selectedBoardIds],
          };
        }

        state.currentWorkspaceId = workspaceId;

        // Restore dialog state from the NEW workspace (or reset to empty)
        if (workspaceId && state.workspaces.byId[workspaceId]) {
          const savedState =
            state.workspaces.byId[workspaceId].savedDialogState;
          const workspace = state.workspaces.byId[workspaceId];
          const shareUrl = state.workspaceShareUrls[workspaceId];
          // Check if workspace is shared/collaborative
          // In collaborative mode, task modals are managed by Yjs sync, not local state
          const isSharedWorkspace =
            workspace.isShared === true || !!shareUrl || !!workspace.shareToken;
          if (savedState) {
            // Restore exactly as the user left it
            // IMPORTANT: Create shallow copies to avoid reference sharing between
            // active state and savedDialogState. This prevents modifications to
            // active state from inadvertently affecting the saved state.
            // IMPORTANT: Skip task modals in collaborative workspaces - they're managed by Yjs
            if (isSharedWorkspace) {
              // In collaborative mode, reset modals - Yjs will restore them if needed
              state.taskDetailModals = {};
              state.createTaskModals = {};
            } else {
              state.taskDetailModals = { ...savedState.taskDetailModals };
              state.createTaskModals = { ...savedState.createTaskModals };
            }
            state.boardQuickActions = { ...savedState.boardQuickActions };
            state.boardDialogs = { ...savedState.boardDialogs };
            state.columnQuickActions = { ...savedState.columnQuickActions };
            state.columnDialogs = { ...savedState.columnDialogs };
            state.taskQuickActions = { ...savedState.taskQuickActions };
            state.connectionDialog = savedState.connectionDialog
              ? { ...savedState.connectionDialog }
              : null;
            state.areaDialogs = { ...savedState.areaDialogs };
            state.dialogFocusStack = [...savedState.dialogFocusStack];
            state.selectedTaskIds = [...savedState.selectedTaskIds];
            state.selectedBoardId = savedState.selectedBoardId;
            state.selectedBoardIds = [...savedState.selectedBoardIds];
          } else {
            // No saved state - reset to defaults
            state.taskDetailModals = {};
            state.createTaskModals = {};
            state.boardQuickActions = {};
            state.boardDialogs = {};
            state.columnQuickActions = {};
            state.columnDialogs = {};
            state.taskQuickActions = {};
            state.connectionDialog = null;
            state.areaDialogs = {};
            state.dialogFocusStack = [];
            state.selectedTaskIds = [];
            state.selectedBoardId = null;
            state.selectedBoardIds = [];
          }
          state.showMiniMap =
            state.workspaces.byId[workspaceId].showMiniMap ?? false;
        } else {
          // Switching to null workspace - clear everything
          state.taskDetailModals = {};
          state.createTaskModals = {};
          state.boardQuickActions = {};
          state.boardDialogs = {};
          state.columnQuickActions = {};
          state.columnDialogs = {};
          state.taskQuickActions = {};
          state.connectionDialog = null;
          state.areaDialogs = {};
          state.dialogFocusStack = [];
          state.selectedTaskIds = [];
          state.selectedBoardId = null;
          state.selectedBoardIds = [];
        }
        // These are always reset when switching workspaces
        state.workspaceQuickActions = null;
        state.workspaceDialog = null;
        state.shakingTaskDetailModalId = null;
        state.draggedTaskId = null;
      }
    }),

  addWorkspace: (name, description) => {
    const id = generateWorkspaceId();
    const workspace: Workspace = {
      id,
      name,
      description,
      created_at: new Date().toISOString(),
      board_ids: [],
    };

    set((state) => {
      state.workspaces.byId[id] = workspace;
      state.workspaces.allIds.push(id);
    });

    logger.info({ id, name }, "Workspace created");

    // Persist to backend metadata table (fire and forget)
    fetch(`${NEXT_PUBLIC_API_URL}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, name, description }),
    }).catch((error) => {
      logger.error({ id, error }, "Failed to create workspace metadata");
    });

    return id;
  },

  updateWorkspace: (workspaceId, updates) =>
    set((state) => {
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        Object.assign(workspace, updates);

        // Persist to backend metadata table (fire and forget)
        if (updates.name || updates.description) {
          fetch(`${NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: updates.name,
              description: updates.description,
            }),
          }).catch((error) => {
            logger.error(
              { id: workspaceId, error },
              "Failed to update workspace metadata"
            );
          });
        }
      }
    }),

  syncWorkspace: (workspace: Partial<Workspace> & { id: string }) =>
    set((state) => {
      const existing = state.workspaces.byId[workspace.id];
      if (existing) {
        Object.assign(existing, workspace);
      } else {
        state.workspaces.byId[workspace.id] = {
          name: "Shared Workspace",
          created_at: new Date().toISOString(),
          board_ids: [],
          ...workspace,
        } as Workspace;
        state.workspaces.allIds.push(workspace.id);
      }
    }),

  deleteWorkspace: async (workspaceId) => {
    const state = get();
    if (state.workspaces.allIds[0] === workspaceId) {
      logger.warn({ id: workspaceId }, "Cannot delete default workspace");
      return false;
    }

    const workspace = state.workspaces.byId[workspaceId];
    if (!workspace) {
      logger.warn({ id: workspaceId }, "Workspace not found");
      return false;
    }

    const shareUrl = state.workspaceShareUrls[workspaceId];
    const isSharedWorkspace =
      workspace.isShared === true || !!shareUrl || !!workspace.shareToken;

    logger.info(
      {
        workspaceId,
        isShared: isSharedWorkspace,
        ownerId: workspace.ownerId,
      },
      "Deleting workspace"
    );

    if (isSharedWorkspace) {
      const sessionResult = await authClient.getSession();
      const currentUserId = sessionResult.data?.user?.id ?? null;

      // For shared workspaces, only allow deletion if ownerId is present and matches.
      // Defaulting to `true` for legacy shared workspaces is risky.
      const isOwner = workspace.ownerId
        ? workspace.ownerId === currentUserId
        : false;

      logger.info(
        {
          workspaceId,
          isOwner,
          workspaceOwnerId: workspace.ownerId,
          currentUserId,
        },
        "Shared workspace - checking ownership"
      );

      if (isOwner) {
        try {
          const response = await fetch(
            `${NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}`,
            {
              method: "DELETE",
              credentials: "include",
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            logger.error(
              { workspaceId, status: response.status, error: errorData },
              "Server rejected workspace delete"
            );
            return false;
          }

          logger.info({ workspaceId }, "Server confirmed workspace deletion");
        } catch (err) {
          logger.error(
            { workspaceId, err },
            "Failed to delete workspace on server"
          );
          return false;
        }
      }
    } else {
      logger.info({ workspaceId }, "Local workspace - skipping server call");
    }

    // Now clean up local state (only reached if server call succeeded or user is not owner)
    set((currentState) => {
      const currentWorkspace = currentState.workspaces.byId[workspaceId];
      if (!currentWorkspace) {
        return;
      }

      logger.info(
        {
          id: workspaceId,
          name: currentWorkspace.name,
          boardCount: currentWorkspace.board_ids.length,
        },
        "Workspace deleted locally"
      );

      // Clean up local state
      for (const boardId of currentWorkspace.board_ids) {
        const board = currentState.boards.byId[boardId];
        if (board) {
          for (const columnId of board.column_ids) {
            const column = currentState.columns.byId[columnId];
            if (column) {
              for (const taskId of column.task_ids) {
                delete currentState.tasks.byId[taskId];
                currentState.tasks.allIds = currentState.tasks.allIds.filter(
                  (id) => id !== taskId
                );
              }
            }
            delete currentState.columns.byId[columnId];
            currentState.columns.allIds = currentState.columns.allIds.filter(
              (id) => id !== columnId
            );
          }
        }
        delete currentState.boards.byId[boardId];
        currentState.boards.allIds = currentState.boards.allIds.filter(
          (id) => id !== boardId
        );
        delete currentState.boardPositions.byId[boardId];
        currentState.boardPositions.allIds =
          currentState.boardPositions.allIds.filter((id) => id !== boardId);
      }
      delete currentState.workspaces.byId[workspaceId];
      currentState.workspaces.allIds = currentState.workspaces.allIds.filter(
        (id) => id !== workspaceId
      );

      // Switch to default workspace if currently viewing deleted workspace
      if (currentState.currentWorkspaceId === workspaceId) {
        currentState.currentWorkspaceId =
          currentState.workspaces.allIds[0] ?? null;
      }
    });

    return true;
  },

  setDeletedSharedWorkspace: (workspaceId) =>
    set((state) => {
      state.deletedSharedWorkspaceId = workspaceId;
    }),

  markWorkspaceDeleted: (workspaceId: string) =>
    set((state) => {
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        workspace.isDeleted = true;
        logger.info(
          { workspaceId },
          "Workspace marked as deleted (offline copy)"
        );
      }
    }),

  resetWorkspace: (workspaceId, options) =>
    set((state) => {
      const workspace = state.workspaces.byId[workspaceId];
      if (!workspace) {
        return;
      }

      const clearBoardsAndColumns = options?.clearBoardsAndColumns ?? false;

      for (const boardId of workspace.board_ids) {
        const board = state.boards.byId[boardId];
        if (board) {
          for (const columnId of board.column_ids) {
            const column = state.columns.byId[columnId];
            if (column) {
              for (const taskId of column.task_ids) {
                delete state.tasks.byId[taskId];
                state.tasks.allIds = state.tasks.allIds.filter(
                  (id) => id !== taskId
                );
              }
              column.task_ids = [];
            }

            if (clearBoardsAndColumns) {
              delete state.columns.byId[columnId];
              state.columns.allIds = state.columns.allIds.filter(
                (id) => id !== columnId
              );
            }
          }

          if (clearBoardsAndColumns) {
            board.column_ids = [];
          }
        }

        if (clearBoardsAndColumns) {
          delete state.boards.byId[boardId];
          state.boards.allIds = state.boards.allIds.filter(
            (id) => id !== boardId
          );
          delete state.boardPositions.byId[boardId];
          state.boardPositions.allIds = state.boardPositions.allIds.filter(
            (id) => id !== boardId
          );
        }
      }

      if (clearBoardsAndColumns) {
        workspace.board_ids = [];
      }

      logger.info(
        {
          id: workspaceId,
          name: workspace.name,
          clearBoardsAndColumns,
        },
        "Workspace reset"
      );
    }),

  duplicateWorkspace: (workspaceId, newName) => {
    const state = get();
    const sourceWorkspace = state.workspaces.byId[workspaceId];
    if (!sourceWorkspace) {
      logger.warn({ id: workspaceId }, "Source workspace not found");
      return null;
    }

    const newWorkspaceId = generateWorkspaceId();
    const now = new Date().toISOString();
    const boardIdMap = new Map<string, string>();
    const columnIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();

    for (const boardId of sourceWorkspace.board_ids) {
      boardIdMap.set(boardId, generateBoardId());
      const board = state.boards.byId[boardId];
      if (board) {
        for (const columnId of board.column_ids) {
          columnIdMap.set(columnId, generateColumnId());
          const column = state.columns.byId[columnId];
          if (column) {
            for (const taskId of column.task_ids) {
              taskIdMap.set(taskId, generateTaskId());
            }
          }
        }
      }
    }

    set((mutableState) => {
      const newWorkspace: Workspace = {
        id: newWorkspaceId,
        name: newName,
        description: sourceWorkspace.description,
        created_at: now,
        board_ids: [],
      };

      for (const oldBoardId of sourceWorkspace.board_ids) {
        const oldBoard = state.boards.byId[oldBoardId];
        const newBoardId = boardIdMap.get(oldBoardId);
        if (!(oldBoard && newBoardId)) {
          continue;
        }

        const newColumnIds: string[] = [];

        for (const oldColumnId of oldBoard.column_ids) {
          const oldColumn = state.columns.byId[oldColumnId];
          const newColumnId = columnIdMap.get(oldColumnId);
          if (!(oldColumn && newColumnId)) {
            continue;
          }

          const newTaskIds: string[] = [];

          for (const oldTaskId of oldColumn.task_ids) {
            const oldTask = state.tasks.byId[oldTaskId];
            const newTaskId = taskIdMap.get(oldTaskId);
            if (!(oldTask && newTaskId)) {
              continue;
            }

            mutableState.tasks.byId[newTaskId] = {
              ...oldTask,
              id: newTaskId,
              board_id: newBoardId,
              column_id: newColumnId,
              created_at: now,
              updated_at: now,
            };
            mutableState.tasks.allIds.push(newTaskId);
            newTaskIds.push(newTaskId);
          }

          mutableState.columns.byId[newColumnId] = {
            ...oldColumn,
            id: newColumnId,
            board_id: newBoardId,
            task_ids: newTaskIds,
          };
          mutableState.columns.allIds.push(newColumnId);
          newColumnIds.push(newColumnId);
        }

        mutableState.boards.byId[newBoardId] = {
          ...oldBoard,
          id: newBoardId,
          workspace_id: newWorkspaceId,
          column_ids: newColumnIds,
          created_at: now,
        };
        mutableState.boards.allIds.push(newBoardId);
        newWorkspace.board_ids.push(newBoardId);

        const oldPosition = state.boardPositions.byId[oldBoardId];
        if (oldPosition) {
          mutableState.boardPositions.byId[newBoardId] = {
            id: newBoardId,
            x: oldPosition.x + 50,
            y: oldPosition.y + 50,
            zIndex: getNextZIndex(mutableState.boardPositions),
            width: oldPosition.width,
            height: oldPosition.height,
          };
          mutableState.boardPositions.allIds.push(newBoardId);
        }
      }

      mutableState.workspaces.byId[newWorkspaceId] = newWorkspace;
      mutableState.workspaces.allIds.push(newWorkspaceId);
    });

    logger.info(
      {
        sourceId: workspaceId,
        newId: newWorkspaceId,
        newName,
        boardCount: sourceWorkspace.board_ids.length,
      },
      "Workspace duplicated"
    );

    return newWorkspaceId;
  },

  openWorkspaceQuickActions: (workspaceId, position) =>
    set((state) => {
      state.workspaceQuickActions = { workspaceId, position };
    }),

  closeWorkspaceQuickActions: () =>
    set((state) => {
      state.workspaceQuickActions = null;
    }),

  updateWorkspaceQuickActionsPosition: (position) =>
    set((state) => {
      if (state.workspaceQuickActions) {
        state.workspaceQuickActions.position = position;
      }
    }),

  openWorkspaceDialog: (options) =>
    set((state) => {
      const { type, workspaceId, workspaceName, position, inputValue } =
        options;
      let defaultInputValue: string | undefined;
      if (type === "rename") {
        defaultInputValue = workspaceName;
      } else if (type === "duplicate") {
        defaultInputValue = `${workspaceName} (Copy)`;
      }

      state.workspaceDialog = {
        type,
        workspaceId,
        workspaceName,
        position,
        inputValue: inputValue ?? defaultInputValue,
      };
    }),

  closeWorkspaceDialog: () =>
    set((state) => {
      state.workspaceDialog = null;
    }),

  updateWorkspaceDialogPosition: (position) =>
    set((state) => {
      if (state.workspaceDialog) {
        state.workspaceDialog.position = position;
      }
    }),

  updateWorkspaceDialogInputValue: (value) =>
    set((state) => {
      if (state.workspaceDialog) {
        state.workspaceDialog.inputValue = value;
      }
    }),

  setWorkspaceShareUrl: (workspaceId, url) =>
    set((state) => {
      state.workspaceShareUrls[workspaceId] = url;
    }),

  clearWorkspaceShareUrl: (workspaceId) =>
    set((state) => {
      delete state.workspaceShareUrls[workspaceId];
    }),
});
