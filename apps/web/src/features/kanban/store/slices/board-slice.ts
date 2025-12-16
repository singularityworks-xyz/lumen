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

    set((state) => {
      state.boards.byId[boardId] = board;
      state.boards.allIds.push(boardId);
      for (const column of columns) {
        state.columns.byId[column.id] = column;
        state.columns.allIds.push(column.id);
      }
      const boardPosition: BoardPosition = {
        id: boardId,
        x: position.x,
        y: position.y,
        zIndex: getNextZIndex(state.boardPositions),
      };
      state.boardPositions.byId[boardId] = boardPosition;
      state.boardPositions.allIds.push(boardId);
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        workspace.board_ids.push(boardId);
        workspace.lastFocusedBoardId = boardId;
      }
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
});
