import type { Board } from "../types";

export function calculateBoardDimensions(board: Board) {
  const columns = board.columns || [];
  const columnCount = columns.length;

  const COLUMN_WIDTH = 300;
  const COLUMN_GAP = 12;
  const BOARD_PADDING = 24;
  const HEADER_HEIGHT = 42;
  const COLUMN_HEADER = 56;
  const SKELETON_COLUMN_WIDTH = 225;
  const COLUMN_PADDING = 24;

  const width =
    columnCount * COLUMN_WIDTH +
    (columnCount > 0 ? columnCount * COLUMN_GAP : 0) +
    (columnCount > 0 ? COLUMN_GAP : 0) +
    SKELETON_COLUMN_WIDTH +
    BOARD_PADDING * 2;

  let maxColumnHeight = 0;
  for (const column of columns) {
    const taskCount = column.tasks?.length || 0;
    const columnHeight =
      COLUMN_HEADER + (taskCount > 0 ? 160 : 160) + COLUMN_PADDING;

    maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
  }

  const height = maxColumnHeight + HEADER_HEIGHT + BOARD_PADDING;

  return {
    width,
    height,
  };
}
