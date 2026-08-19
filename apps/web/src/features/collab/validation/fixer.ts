import { createLogger } from "@lumen/logger";
import type { KanbanState } from "@/src/features/kanban/store/types";
import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Task,
} from "@/src/features/kanban/types";

const logger = createLogger({ name: "collab:fixer" });

// Data repair utilities for fixing corrupted or inconsistent state.
// These fixers run after Yjs sync to ensure data integrity.
// Remove tasks that reference non-existent columns
export function fixOrphanedTasks(state: KanbanState): KanbanState {
  const validColumnIds = new Set(state.columns.allIds);
  const validBoardIds = new Set(state.boards.allIds);
  const fixedTasks: Record<string, Task> = {};
  let removedCount = 0;

  for (const task of Object.values(state.tasks.byId)) {
    if (
      validColumnIds.has(task.column_id) &&
      validBoardIds.has(task.board_id)
    ) {
      fixedTasks[task.id] = task;
    } else {
      removedCount += 1;
      logger.warn("Removed orphaned task", {
        taskId: task.id,
        columnId: task.column_id,
        boardId: task.board_id,
      });
    }
  }

  if (removedCount > 0) {
    return {
      ...state,
      tasks: { byId: fixedTasks, allIds: Object.keys(fixedTasks) },
    };
  }

  return state;
}

// Remove columns that reference non-existent boards
export function fixOrphanedColumns(state: KanbanState): KanbanState {
  const validBoardIds = new Set(state.boards.allIds);
  const fixedColumns: Record<string, Column> = {};
  let removedCount = 0;

  for (const column of Object.values(state.columns.byId)) {
    if (validBoardIds.has(column.board_id)) {
      fixedColumns[column.id] = column;
    } else {
      removedCount += 1;
      logger.warn("Removed orphaned column", {
        columnId: column.id,
        boardId: column.board_id,
      });
    }
  }

  if (removedCount > 0) {
    return {
      ...state,
      columns: { byId: fixedColumns, allIds: Object.keys(fixedColumns) },
    };
  }

  return state;
}

// Create missing board positions for boards without positions
export function fixMissingBoardPositions(state: KanbanState): KanbanState {
  const boardIds = new Set(state.boards.allIds);
  const positionIds = new Set(state.boardPositions.allIds);
  const positions: Record<string, BoardPosition> = {
    ...state.boardPositions.byId,
  };
  let addedCount = 0;

  let offsetX = 100;
  for (const boardId of boardIds) {
    if (!positionIds.has(boardId)) {
      positions[boardId] = {
        id: boardId,
        x: offsetX,
        y: 100,
        zIndex: addedCount + 1,
      };
      offsetX += 400;
      addedCount += 1;
      logger.warn("Created missing board position", { boardId });
    }
  }

  if (addedCount > 0) {
    return {
      ...state,
      boardPositions: { byId: positions, allIds: Object.keys(positions) },
    };
  }

  return state;
}

// Remove board positions for non-existent boards
export function fixOrphanedBoardPositions(state: KanbanState): KanbanState {
  const validBoardIds = new Set(state.boards.allIds);
  const fixedPositions: Record<string, BoardPosition> = {};
  let removedCount = 0;

  for (const pos of Object.values(state.boardPositions.byId)) {
    if (validBoardIds.has(pos.id)) {
      fixedPositions[pos.id] = pos;
    } else {
      removedCount += 1;
      logger.warn("Removed orphaned board position", { positionId: pos.id });
    }
  }

  if (removedCount > 0) {
    return {
      ...state,
      boardPositions: {
        byId: fixedPositions,
        allIds: Object.keys(fixedPositions),
      },
    };
  }

  return state;
}

// Remove board connections referencing non-existent boards
export function fixOrphanedConnections(state: KanbanState): KanbanState {
  const validBoardIds = new Set([
    ...(state.boards?.allIds || []),
    ...(state.textBoards?.allIds || []),
  ]);
  const fixedConnections: Record<string, BoardConnection> = {};
  let removedCount = 0;

  for (const conn of Object.values(state.boardConnections.byId)) {
    if (
      validBoardIds.has(conn.source_board_id) &&
      validBoardIds.has(conn.target_board_id)
    ) {
      fixedConnections[conn.id] = conn;
    } else {
      removedCount += 1;
      logger.warn("Removed orphaned connection", {
        connectionId: conn.id,
        source: conn.source_board_id,
        target: conn.target_board_id,
      });
    }
  }

  if (removedCount > 0) {
    return {
      ...state,
      boardConnections: {
        byId: fixedConnections,
        allIds: Object.keys(fixedConnections),
      },
    };
  }

  return state;
}

// Fix column task_ids to only include existing tasks
export function fixColumnTaskIds(state: KanbanState): KanbanState {
  const validTaskIds = new Set(state.tasks.allIds);
  const fixedColumns: Record<string, Column> = {};
  let fixedCount = 0;

  for (const column of Object.values(state.columns.byId)) {
    const validColumnTaskIds = column.task_ids.filter((id) =>
      validTaskIds.has(id)
    );
    if (validColumnTaskIds.length === column.task_ids.length) {
      fixedColumns[column.id] = column;
    } else {
      fixedColumns[column.id] = { ...column, task_ids: validColumnTaskIds };
      fixedCount += 1;
      logger.warn("Fixed column task_ids", {
        columnId: column.id,
        removed: column.task_ids.length - validColumnTaskIds.length,
      });
    }
  }

  if (fixedCount > 0) {
    return {
      ...state,
      columns: { byId: fixedColumns, allIds: Object.keys(fixedColumns) },
    };
  }

  return state;
}

// Fix board column_ids to only include existing Columns
export function fixBoardColumnIds(state: KanbanState): KanbanState {
  const validColumnIds = new Set(state.columns.allIds);
  const fixedBoards: Record<string, Board> = {};
  let fixedCount = 0;

  for (const board of Object.values(state.boards.byId)) {
    const validBoardColumnIds = board.column_ids.filter((id) =>
      validColumnIds.has(id)
    );
    if (validBoardColumnIds.length === board.column_ids.length) {
      fixedBoards[board.id] = board;
    } else {
      fixedBoards[board.id] = { ...board, column_ids: validBoardColumnIds };
      fixedCount += 1;
      logger.warn("Fixed board column_ids", {
        boardId: board.id,
        removed: board.column_ids.length - validBoardColumnIds.length,
      });
    }
  }

  if (fixedCount > 0) {
    return {
      ...state,
      boards: { byId: fixedBoards, allIds: Object.keys(fixedBoards) },
    };
  }

  return state;
}

// Fix area board_ids to only include existing boards
export function fixAreaBoardIds(state: KanbanState): KanbanState {
  const validBoardIds = new Set(state.boards.allIds);
  const fixedAreas: Record<string, Area> = {};
  let fixedCount = 0;

  for (const area of Object.values(state.areas.byId)) {
    const validAreaBoardIds = area.board_ids.filter((id) =>
      validBoardIds.has(id)
    );
    if (validAreaBoardIds.length === area.board_ids.length) {
      fixedAreas[area.id] = area;
    } else {
      fixedAreas[area.id] = { ...area, board_ids: validAreaBoardIds };
      fixedCount += 1;
      logger.warn("Fixed area board_ids", {
        areaId: area.id,
        removed: area.board_ids.length - validAreaBoardIds.length,
      });
    }
  }

  if (fixedCount > 0) {
    return {
      ...state,
      areas: { byId: fixedAreas, allIds: Object.keys(fixedAreas) },
    };
  }

  return state;
}

export function fixOrphanedAreaPositions(state: KanbanState): KanbanState {
  const validAreaIds = new Set(state.areas.allIds);
  const fixedPositions: Record<string, AreaPosition> = {};
  let removedCount = 0;

  for (const pos of Object.values(state.areaPositions.byId)) {
    if (validAreaIds.has(pos.id)) {
      fixedPositions[pos.id] = pos;
    } else {
      removedCount += 1;
      logger.warn("Removed orphaned area position", { positionId: pos.id });
    }
  }

  if (removedCount > 0) {
    return {
      ...state,
      areaPositions: {
        byId: fixedPositions,
        allIds: Object.keys(fixedPositions),
      },
    };
  }

  return state;
}

// Master Fixer
// Run all fixers in correct order (parent entities first)
export function repairState(state: KanbanState): KanbanState {
  let fixed = state;

  // Fix orphaned entities (order matters: parent -> child)
  fixed = fixOrphanedColumns(fixed);
  fixed = fixOrphanedTasks(fixed);
  fixed = fixOrphanedBoardPositions(fixed);
  fixed = fixOrphanedConnections(fixed);
  fixed = fixOrphanedAreaPositions(fixed);

  // Fix reference arrays
  fixed = fixColumnTaskIds(fixed);
  fixed = fixBoardColumnIds(fixed);
  fixed = fixAreaBoardIds(fixed);

  // Fix missing required entities
  fixed = fixMissingBoardPositions(fixed);

  return fixed;
}

// Check if state needs repair (for optimization)
export function needsRepair(state: KanbanState): boolean {
  const boardIds = new Set(state.boards.allIds);
  const columnIds = new Set(state.columns.allIds);

  // Check for orphaned columns
  for (const column of Object.values(state.columns.byId)) {
    if (!boardIds.has(column.board_id)) {
      return true;
    }
  }

  // Check for orphaned tasks
  for (const task of Object.values(state.tasks.byId)) {
    if (!(columnIds.has(task.column_id) && boardIds.has(task.board_id))) {
      return true;
    }
  }

  // Check for missing board positions
  for (const boardId of boardIds) {
    if (!state.boardPositions.byId[boardId]) {
      return true;
    }
  }

  return false;
}
