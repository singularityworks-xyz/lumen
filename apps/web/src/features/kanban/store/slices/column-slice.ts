import { createLogger } from "@lumen/logger";
import type { Column } from "../../types";
import { generateColumnId } from "../ids";
import type { KanbanStore } from "../types";

const logger = createLogger({ name: "[client] kanban/column" });

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addColumn"
  | "updateColumn"
  | "deleteColumn"
  | "moveColumn"
  | "moveColumnToBoard"
  | "openColumnQuickActions"
  | "closeColumnQuickActions"
  | "updateColumnQuickActionsPosition"
  | "openColumnDialog"
  | "closeColumnDialog"
  | "updateColumnDialogPosition"
  | "updateColumnDialogInputValue"
>;

export const createColumnSlice: SliceCreator = (set, get) => ({
  addColumn: (boardId, name, position) => {
    const columnId = generateColumnId();
    const currentState = get();

    let finalPosition = position ?? 0;
    if (position === undefined) {
      const board = currentState.boards.byId[boardId];
      finalPosition = board?.column_ids.length ?? 0;
    }

    const column: Column = {
      id: columnId,
      board_id: boardId,
      name,
      position: finalPosition,
      task_ids: [],
    };

    set((state) => {
      state.columns.byId[columnId] = column;
      state.columns.allIds.push(columnId);

      const board = state.boards.byId[boardId];
      if (board) {
        board.column_ids.push(columnId);
        const workspace = state.workspaces.byId[board.workspace_id];
        if (workspace) {
          workspace.lastFocusedBoardId = boardId;
        }
      }
    });

    logger.info({ id: columnId, name, boardId }, "Column created");
    return columnId;
  },

  updateColumn: (columnId, updates) =>
    set((state) => {
      const column = state.columns.byId[columnId];
      if (column) {
        Object.assign(column, updates);
      }
    }),

  deleteColumn: (boardId, columnId) =>
    set((state) => {
      const column = state.columns.byId[columnId];
      if (!column) {
        logger.warn({ id: columnId, boardId }, "Column not found");
        return;
      }

      logger.info(
        {
          id: columnId,
          name: column.name,
          boardId,
          taskCount: column.task_ids.length,
        },
        "Column deleted"
      );

      for (const taskId of column.task_ids) {
        delete state.tasks.byId[taskId];
        state.tasks.allIds = state.tasks.allIds.filter((id) => id !== taskId);
        state.selectedTaskIds = state.selectedTaskIds.filter(
          (id) => id !== taskId
        );
      }

      const board = state.boards.byId[boardId];
      if (board) {
        board.column_ids = board.column_ids.filter((id) => id !== columnId);
      }

      delete state.columns.byId[columnId];
      state.columns.allIds = state.columns.allIds.filter(
        (id) => id !== columnId
      );
    }),

  moveColumn: (boardId, columnId, newPosition) =>
    set((state) => {
      const board = state.boards.byId[boardId];
      if (!board) {
        return;
      }

      const currentIndex = board.column_ids.indexOf(columnId);
      if (currentIndex === -1 || currentIndex === newPosition) {
        return;
      }

      board.column_ids.splice(currentIndex, 1);
      board.column_ids.splice(newPosition, 0, columnId);

      for (const [index, colId] of board.column_ids.entries()) {
        const col = state.columns.byId[colId];
        if (col) {
          col.position = index;
        }
      }
    }),

  moveColumnToBoard: (sourceBoardId, columnId, targetBoardId) =>
    set((state) => {
      if (sourceBoardId === targetBoardId) {
        return;
      }

      const sourceBoard = state.boards.byId[sourceBoardId];
      const targetBoard = state.boards.byId[targetBoardId];
      const column = state.columns.byId[columnId];

      if (!(sourceBoard && targetBoard && column)) {
        return;
      }

      sourceBoard.column_ids = sourceBoard.column_ids.filter(
        (id) => id !== columnId
      );
      column.board_id = targetBoardId;
      column.position = targetBoard.column_ids.length;
      for (const taskId of column.task_ids) {
        const task = state.tasks.byId[taskId];
        if (task) {
          task.board_id = targetBoardId;
        }
      }

      targetBoard.column_ids.push(columnId);

      for (const [index, colId] of sourceBoard.column_ids.entries()) {
        const col = state.columns.byId[colId];
        if (col) {
          col.position = index;
        }
      }
    }),

  openColumnQuickActions: (columnId, showAddTask, position) =>
    set((state) => {
      state.columnQuickActions = { columnId, showAddTask, position };
    }),

  closeColumnQuickActions: () =>
    set((state) => {
      state.columnQuickActions = null;
    }),

  updateColumnQuickActionsPosition: (position) =>
    set((state) => {
      if (state.columnQuickActions) {
        state.columnQuickActions.position = position;

        const columnId = state.columnQuickActions.columnId;
        for (const modalId of Object.keys(state.createTaskModals)) {
          const modal = state.createTaskModals[modalId];
          if (
            modal?.columnId === columnId &&
            modal?.sourceType === "column-menu" &&
            modal?.sourceRect
          ) {
            modal.sourceRect = {
              ...modal.sourceRect,
              left: position.x,
              top: position.y + 160,
              right: position.x + 220,
              bottom: position.y + 190,
            };
          }
        }
      }
    }),

  openColumnDialog: (options) =>
    set((state) => {
      const {
        type,
        columnId,
        columnName,
        boardId,
        boardName,
        inputValue,
        position,
      } = options;
      state.columnDialog = {
        type,
        columnId,
        columnName,
        boardId,
        boardName,
        inputValue,
        position,
      };
    }),

  closeColumnDialog: () =>
    set((state) => {
      state.columnDialog = null;
    }),

  updateColumnDialogPosition: (position) =>
    set((state) => {
      if (state.columnDialog) {
        state.columnDialog.position = position;
      }
    }),

  updateColumnDialogInputValue: (value) =>
    set((state) => {
      if (state.columnDialog) {
        state.columnDialog.inputValue = value;
      }
    }),
});
