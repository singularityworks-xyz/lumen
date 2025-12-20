import { createLogger } from "@lumen/logger";
import type {
  Board,
  BoardPosition,
  Column,
  DenormalizedColumn,
  Task,
} from "../../types";
import { generateBoardId, generateColumnId } from "../ids";
import type { KanbanStore } from "../types";
import { getNextZIndex } from "../utils";

const logger = createLogger({ name: "[client] kanban/board" });

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addBoard"
  | "updateBoard"
  | "removeBoard"
  | "updateBoardPosition"
  | "updateBoardDimensions"
  | "bringBoardToFront"
  | "getDenormalizedBoard"
  | "duplicateBoard"
  | "openBoardQuickActions"
  | "closeBoardQuickActions"
  | "updateBoardQuickActionsPosition"
  | "openBoardDialog"
  | "closeBoardDialog"
  | "updateBoardDialogPosition"
  | "updateBoardDialogInputValue"
  | "updateBoardDialogDescriptionValue"
  | "updateBoardDialogNewName"
  | "updateBoardDialogCopyConnections"
  | "openConnectionDialog"
  | "closeConnectionDialog"
  | "updateConnectionDialogPosition"
>;

export const createBoardSlice: SliceCreator = (set, get) => ({
  addBoard: (name, position, description) => {
    const boardId = generateBoardId();
    const now = new Date().toISOString();
    const workspaceId = get().currentWorkspaceId ?? "";
    const col1Id = generateColumnId();
    const col2Id = generateColumnId();
    const col3Id = generateColumnId();

    const board: Board = {
      id: boardId,
      name,
      description,
      workspace_id: workspaceId,
      created_by: "current-user",
      created_at: now,
      column_ids: [col1Id, col2Id, col3Id],
    };

    const columns: Column[] = [
      {
        id: col1Id,
        board_id: boardId,
        name: "To Do",
        position: 0,
        task_ids: [],
      },
      {
        id: col2Id,
        board_id: boardId,
        name: "In Progress",
        position: 1,
        task_ids: [],
      },
      {
        id: col3Id,
        board_id: boardId,
        name: "Done",
        position: 2,
        task_ids: [],
      },
    ];

    const COLUMN_WIDTH = 300;
    const COLUMN_GAP = 12;
    const BOARD_PADDING = 24;
    const HEADER_HEIGHT = 42;
    const COLUMN_HEADER = 56;
    const COLUMN_PADDING = 24;
    const SKELETON_COLUMN_WIDTH = 225;
    const columnCount = columns.length;

    const initialWidth =
      columnCount * COLUMN_WIDTH +
      (columnCount > 0 ? columnCount * COLUMN_GAP : 0) +
      (columnCount > 0 ? COLUMN_GAP : 0) +
      SKELETON_COLUMN_WIDTH +
      BOARD_PADDING * 2;

    const initialHeight =
      HEADER_HEIGHT + COLUMN_HEADER + 160 + COLUMN_PADDING + BOARD_PADDING;

    set((state) => {
      let finalPosition: { x: number; y: number } = position || { x: 0, y: 0 };

      if (!position) {
        // Use get() to safely access current state logic, but we still need to write to 'state' (draft).
        // Actually, we can just read from 'state' carefully.
        // But to be safe against any proxy weirdness.
        const workspace = state.workspaces.byId[workspaceId];

        if (workspace) {
          const workspaceBoards = workspace.board_ids;
          const currentSelectedBoardId = state.selectedBoardId;
          const lastFocusedBoardId = workspace.lastFocusedBoardId;

          if (workspaceBoards.length > 0) {
            let targetBoardId: string | undefined;

            if (
              currentSelectedBoardId &&
              workspaceBoards.includes(currentSelectedBoardId)
            ) {
              targetBoardId = currentSelectedBoardId;
            } else if (
              lastFocusedBoardId &&
              workspaceBoards.includes(lastFocusedBoardId)
            ) {
              targetBoardId = lastFocusedBoardId;
            } else {
              targetBoardId = workspaceBoards.at(-1);
            }

            if (targetBoardId) {
              const targetBoardPos = state.boardPositions.byId[targetBoardId];
              if (targetBoardPos) {
                finalPosition = {
                  x: targetBoardPos.x,
                  y: targetBoardPos.y + (targetBoardPos.height || 500) + 50,
                };
              }
            }
          }
        }
      }

      state.boards.byId[boardId] = board;
      state.boards.allIds.push(boardId);
      for (const column of columns) {
        state.columns.byId[column.id] = column;
        state.columns.allIds.push(column.id);
      }
      const boardPosition: BoardPosition = {
        id: boardId,
        x: finalPosition.x,
        y: finalPosition.y,
        zIndex: getNextZIndex(state.boardPositions),
        width: initialWidth,
        height: initialHeight,
      };
      state.boardPositions.byId[boardId] = boardPosition;
      state.boardPositions.allIds.push(boardId);
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        workspace.board_ids.push(boardId);
        workspace.lastFocusedBoardId = boardId;
      }

      state.canvas.focusedBoardId = boardId;
      state.selectedBoardId = boardId;
    });

    logger.info({ id: boardId, name, workspaceId }, "Board created");
    return boardId;
  },

  updateBoard: (boardId, updates) =>
    set((state) => {
      const board = state.boards.byId[boardId];
      if (board) {
        Object.assign(board, updates);
        const workspace = state.workspaces.byId[board.workspace_id];
        if (workspace) {
          workspace.lastFocusedBoardId = boardId;
        }
      }
    }),

  removeBoard: (boardId) =>
    set((state) => {
      const board = state.boards.byId[boardId];
      if (!board) {
        logger.warn({ id: boardId }, "Board not found");
        return;
      }

      logger.info(
        { id: boardId, name: board.name, columnCount: board.column_ids.length },
        "Board deleted"
      );

      for (const columnId of board.column_ids) {
        const column = state.columns.byId[columnId];
        if (column) {
          for (const taskId of column.task_ids) {
            delete state.tasks.byId[taskId];
            state.tasks.allIds = state.tasks.allIds.filter(
              (id) => id !== taskId
            );
          }
        }
        delete state.columns.byId[columnId];
        state.columns.allIds = state.columns.allIds.filter(
          (id) => id !== columnId
        );
      }

      const workspace = state.workspaces.byId[board.workspace_id];
      if (workspace) {
        workspace.board_ids = workspace.board_ids.filter(
          (id) => id !== boardId
        );
      }

      delete state.boards.byId[boardId];
      state.boards.allIds = state.boards.allIds.filter((id) => id !== boardId);
      delete state.boardPositions.byId[boardId];
      state.boardPositions.allIds = state.boardPositions.allIds.filter(
        (id) => id !== boardId
      );

      if (state.selectedBoardId === boardId) {
        state.selectedBoardId = null;
      }
      state.selectedBoardIds = state.selectedBoardIds.filter(
        (id) => id !== boardId
      );
    }),

  updateBoardPosition: (boardId, position) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.x = position.x;
        boardPos.y = position.y;
      }
    }),

  updateBoardDimensions: (boardId, dimensions) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.width = dimensions.width;
        boardPos.height = dimensions.height;
      }
    }),

  bringBoardToFront: (boardId) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.zIndex = getNextZIndex(state.boardPositions);
      }
    }),

  getDenormalizedBoard: (boardId) => {
    const currentState = get();
    const board = currentState.boards.byId[boardId];
    if (!board) {
      return null;
    }

    const columns: DenormalizedColumn[] = board.column_ids
      .map((colId) => {
        const column = currentState.columns.byId[colId];
        if (!column) {
          return null;
        }

        const tasks = column.task_ids
          .map((taskId) => currentState.tasks.byId[taskId])
          .filter((task): task is Task => task !== undefined)
          .sort((a, b) => a.position - b.position);

        return {
          id: column.id,
          board_id: column.board_id,
          name: column.name,
          position: column.position,
          tasks,
        };
      })
      .filter((col): col is DenormalizedColumn => col !== null)
      .sort((a, b) => a.position - b.position);

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      workspace_id: board.workspace_id,
      created_by: board.created_by,
      created_at: board.created_at,
      columns,
    };
  },

  duplicateBoard: (boardId, newName, options = {}) => {
    const { copyConnections = false } = options;
    const state = get();
    const board = state.boards.byId[boardId];
    const boardPosition = state.boardPositions.byId[boardId];

    if (!(board && boardPosition)) {
      logger.warn({ id: boardId }, "Board not found for duplication");
      return null;
    }

    const now = new Date().toISOString();
    const newBoardId = generateBoardId();
    const columnIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();

    const newColumnIds: string[] = [];
    for (const oldColumnId of board.column_ids) {
      const oldColumn = state.columns.byId[oldColumnId];
      if (!oldColumn) {
        continue;
      }
      const newColumnId = generateColumnId();
      columnIdMap.set(oldColumnId, newColumnId);
      newColumnIds.push(newColumnId);
    }

    set((draft) => {
      const newBoard: Board = {
        id: newBoardId,
        name: newName,
        description: board.description,
        workspace_id: board.workspace_id,
        created_by: board.created_by,
        created_at: now,
        column_ids: newColumnIds,
      };
      draft.boards.byId[newBoardId] = newBoard;
      draft.boards.allIds.push(newBoardId);

      const newBoardPosition: BoardPosition = {
        id: newBoardId,
        x: boardPosition.x + 50,
        y: boardPosition.y + 50,
        zIndex: getNextZIndex(draft.boardPositions),
        width: boardPosition.width,
        height: boardPosition.height,
      };
      draft.boardPositions.byId[newBoardId] = newBoardPosition;
      draft.boardPositions.allIds.push(newBoardId);

      for (const oldColumnId of board.column_ids) {
        const oldColumn = state.columns.byId[oldColumnId];
        if (!oldColumn) {
          continue;
        }
        const newColumnId = columnIdMap.get(oldColumnId);
        if (!newColumnId) {
          continue;
        }

        const newTaskIds: string[] = [];
        for (const oldTaskId of oldColumn.task_ids) {
          const newTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          taskIdMap.set(oldTaskId, newTaskId);
          newTaskIds.push(newTaskId);
        }

        const newColumn: Column = {
          id: newColumnId,
          board_id: newBoardId,
          name: oldColumn.name,
          position: oldColumn.position,
          task_ids: newTaskIds,
        };
        draft.columns.byId[newColumnId] = newColumn;
        draft.columns.allIds.push(newColumnId);

        for (const oldTaskId of oldColumn.task_ids) {
          const oldTask = state.tasks.byId[oldTaskId];
          if (!oldTask) {
            continue;
          }
          const newTaskId = taskIdMap.get(oldTaskId);
          if (!newTaskId) {
            continue;
          }

          const newTask: Task = {
            ...oldTask,
            id: newTaskId,
            column_id: newColumnId,
            created_at: now,
          };
          draft.tasks.byId[newTaskId] = newTask;
          draft.tasks.allIds.push(newTaskId);
        }
      }

      const workspace = draft.workspaces.byId[board.workspace_id];
      if (workspace) {
        workspace.board_ids.push(newBoardId);
        workspace.lastFocusedBoardId = newBoardId;
      }

      if (copyConnections) {
        const connectionsToBoard = state.boardConnections.allIds
          .map((id) => state.boardConnections.byId[id])
          .filter((conn) => conn && conn.source_board_id === boardId);

        for (const conn of connectionsToBoard) {
          if (!conn) {
            continue;
          }
          const newConnId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          draft.boardConnections.byId[newConnId] = {
            id: newConnId,
            source_board_id: newBoardId,
            target_board_id: conn.target_board_id,
            label: conn.label,
            lineStyle: conn.lineStyle,
            sourceHandle: conn.sourceHandle,
            targetHandle: conn.targetHandle,
            showArrow: conn.showArrow,
            created_at: now,
          };
          draft.boardConnections.allIds.push(newConnId);
        }
      }
    });

    logger.info(
      { id: newBoardId, name: newName, sourceId: boardId, copyConnections },
      "Board duplicated"
    );
    return newBoardId;
  },

  openBoardQuickActions: (boardId, position) =>
    set((state) => {
      state.boardQuickActions[boardId] = { boardId, position };
    }),

  closeBoardQuickActions: (boardId) =>
    set((state) => {
      delete state.boardQuickActions[boardId];
    }),

  updateBoardQuickActionsPosition: (boardId, position) =>
    set((state) => {
      const quickActions = state.boardQuickActions[boardId];
      if (quickActions) {
        quickActions.position = position;

        for (const modalId of Object.keys(state.createTaskModals)) {
          const modal = state.createTaskModals[modalId];
          if (
            modal?.boardId === boardId &&
            modal?.sourceType === "board-menu" &&
            modal?.sourceRect
          ) {
            modal.sourceRect = {
              ...modal.sourceRect,
              left: position.x,
              top: position.y + 80,
              right: position.x + 220,
              bottom: position.y + 110,
            };
          }
        }
      }
    }),

  openBoardDialog: (options) => {
    const id = crypto.randomUUID();
    set((state) => {
      state.boardDialogs[id] = {
        ...options,
        id,
        position: options.position ?? { x: 0, y: 0 },
        zIndex: getNextZIndex(state.boardPositions),
      };
    });
    return id;
  },

  closeBoardDialog: (id) =>
    set((state) => {
      delete state.boardDialogs[id];
    }),

  updateBoardDialogPosition: (id, position) =>
    set((state) => {
      if (state.boardDialogs[id]) {
        state.boardDialogs[id].position = position;
      }
    }),

  updateBoardDialogInputValue: (id, value) =>
    set((state) => {
      if (state.boardDialogs[id]) {
        state.boardDialogs[id].inputValue = value;
      }
    }),

  updateBoardDialogNewName: (id, value) =>
    set((state) => {
      if (state.boardDialogs[id]) {
        state.boardDialogs[id].newName = value;
      }
    }),

  updateBoardDialogDescriptionValue: (id, value) =>
    set((state) => {
      if (state.boardDialogs[id]) {
        state.boardDialogs[id].descriptionValue = value;
      }
    }),

  updateBoardDialogCopyConnections: (id, value) =>
    set((state) => {
      if (state.boardDialogs[id]) {
        state.boardDialogs[id].copyConnections = value;
      }
    }),

  openConnectionDialog: (boardId, position) =>
    set((state) => {
      state.connectionDialog = {
        boardId,
        position,
      };
    }),

  closeConnectionDialog: () =>
    set((state) => {
      state.connectionDialog = null;
    }),

  updateConnectionDialogPosition: (position) =>
    set((state) => {
      if (state.connectionDialog) {
        state.connectionDialog.position = position;
      }
    }),
});
