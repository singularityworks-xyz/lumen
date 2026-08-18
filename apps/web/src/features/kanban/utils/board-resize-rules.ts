import type { DenormalizedColumn } from "../types";

// Centralized constants and utility functions for accurate board sizing.
// SIZING BEHAVIOR:
// 1. Board width is exact and deterministic based on total columns: (N * COLUMN_WIDTH) + ((N - 1) * COLUMN_GAP) + BOARD_PADDING + BOARD_BORDER
// 2. Columns have fixed width (285px) with no horizontal scrollbar or extra spacing
// 3. Board is non-resizable width-wise to maintain exact column alignment
// 4. Height is resizable and auto-grows to fit visible tasks

export const BOARD_RESIZE_CONSTANTS = {
  COLUMN_WIDTH: 285,
  COLUMN_GAP: 12,
  BOARD_PADDING: 24,
  BOARD_BORDER: 4,
  HEADER_HEIGHT: 42,
  COLUMN_HEADER: 56,
  COLUMN_PADDING: 24,
  TASK_HEIGHT: 120,
  TASK_GAP: 8,
  COLUMN_FOOTER_HEIGHT: 48,
} as const;

export const RESIZE_RULES = {
  GROW_TO_FIT: true,
  RESPECT_USER_SIZE: true,
} as const;

// Calculate the exact pixel width for a board based on its column count.
// Perfectly accounts for column width, gap-3 (12px), p-3 padding (24px total), and border-2 (4px total).
export function calculateBoardWidth(columnCount: number): number {
  const { COLUMN_WIDTH, COLUMN_GAP, BOARD_PADDING, BOARD_BORDER } =
    BOARD_RESIZE_CONSTANTS;

  const totalChrome = BOARD_PADDING + BOARD_BORDER;

  if (columnCount <= 0) {
    return COLUMN_WIDTH + totalChrome;
  }

  return (
    columnCount * COLUMN_WIDTH + (columnCount - 1) * COLUMN_GAP + totalChrome
  );
}

export function calculateColumnHeight(
  column: DenormalizedColumn,
  includeFooter = true
): number {
  const {
    COLUMN_HEADER,
    COLUMN_PADDING,
    TASK_HEIGHT,
    TASK_GAP,
    COLUMN_FOOTER_HEIGHT,
  } = BOARD_RESIZE_CONSTANTS;

  // Count only visible (todo) tasks
  const visibleTasks = column.tasks.filter((t) => t.status === "todo");
  const taskCount = visibleTasks.length;

  // Base height = header + padding
  let height = COLUMN_HEADER + COLUMN_PADDING;

  if (taskCount > 0) {
    // Task area = tasks + gaps between them
    height += taskCount * TASK_HEIGHT + (taskCount - 1) * TASK_GAP;
  } else {
    // Empty column placeholder height
    height += 160;
  }

  // Add footer for finished/trash section
  if (includeFooter) {
    height += COLUMN_FOOTER_HEIGHT;
  }

  return height;
}

export function calculateMinDimensions(columnCount = 1): {
  width: number;
  height: number;
} {
  const { HEADER_HEIGHT, COLUMN_HEADER, COLUMN_PADDING, BOARD_PADDING } =
    BOARD_RESIZE_CONSTANTS;

  return {
    width: calculateBoardWidth(columnCount),
    height:
      HEADER_HEIGHT + COLUMN_HEADER + 220 + COLUMN_PADDING + BOARD_PADDING,
  };
}

export function calculateMaxDimensions(columns: DenormalizedColumn[]): {
  width: number;
  height: number;
} {
  const {
    HEADER_HEIGHT,
    COLUMN_HEADER,
    COLUMN_PADDING,
    BOARD_PADDING,
    TASK_HEIGHT,
    TASK_GAP,
  } = BOARD_RESIZE_CONSTANTS;

  const width = calculateBoardWidth(columns.length);
  const maxTaskCount = Math.max(...columns.map((c) => c.tasks?.length ?? 0), 0);

  const maxHeight =
    HEADER_HEIGHT +
    COLUMN_HEADER +
    (maxTaskCount + 2) * TASK_HEIGHT +
    (maxTaskCount + 2 - 1) * TASK_GAP +
    COLUMN_PADDING +
    BOARD_PADDING;

  return { width, height: maxHeight };
}

// Calculate initial dimensions for a newly created board with empty columns.
// @param columnCount - Number of columns in the new board
export function calculateInitialBoardDimensions(columnCount: number): {
  width: number;
  height: number;
} {
  const {
    HEADER_HEIGHT,
    COLUMN_HEADER,
    COLUMN_PADDING,
    COLUMN_FOOTER_HEIGHT,
    BOARD_PADDING,
  } = BOARD_RESIZE_CONSTANTS;

  const width = calculateBoardWidth(columnCount);

  // Height for empty columns: header + column header + empty placeholder + footer + padding
  const emptyColumnHeight =
    COLUMN_HEADER + COLUMN_PADDING + 160 + COLUMN_FOOTER_HEIGHT;
  const height = HEADER_HEIGHT + emptyColumnHeight + BOARD_PADDING;

  return { width, height };
}

// Calculate the required content dimensions based on actual column content.
export function calculateContentDimensions(columns: DenormalizedColumn[]): {
  width: number;
  height: number;
} {
  const { BOARD_PADDING, HEADER_HEIGHT } = BOARD_RESIZE_CONSTANTS;

  const width = calculateBoardWidth(columns.length);

  // Height = header + tallest column + padding
  let maxColumnHeight = 0;
  for (const column of columns) {
    const columnHeight = calculateColumnHeight(column);
    maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
  }

  // Ensure minimum height for empty boards
  if (maxColumnHeight === 0) {
    maxColumnHeight = 240;
  }

  const height = maxColumnHeight + HEADER_HEIGHT + BOARD_PADDING;

  return { width, height };
}

// Determine if and how to apply resize based on content and user preferences.
// Width is strictly kept in sync with the column count (non-resizable width-wise).
// Height only grows to fit content or respects user-resized height.
export function shouldApplyResize(
  currentDimensions: { width: number; height: number },
  contentDimensions: { width: number; height: number },
  userResized: boolean,
  userDimensions?: { width?: number; height?: number }
): {
  shouldResize: boolean;
  newDimensions: { width: number; height: number };
  reason?: "grow-for-content" | "width-sync" | "none";
} {
  const minDims = calculateMinDimensions();

  // Width is strictly determined by columns - no manual width resizing
  const exactWidth = contentDimensions.width;

  const effectiveMinHeight = userResized
    ? Math.max(userDimensions?.height ?? minDims.height, minDims.height)
    : minDims.height;

  const THRESHOLD = 5;
  const needsWidthSync = Math.abs(currentDimensions.width - exactWidth) > 0.5;
  const needsHeightGrow =
    contentDimensions.height > currentDimensions.height + THRESHOLD;

  if (needsWidthSync || needsHeightGrow) {
    return {
      shouldResize: true,
      newDimensions: {
        width: exactWidth,
        height: Math.max(
          currentDimensions.height,
          contentDimensions.height,
          effectiveMinHeight
        ),
      },
      reason: needsHeightGrow ? "grow-for-content" : "width-sync",
    };
  }

  return {
    shouldResize: false,
    newDimensions: currentDimensions,
    reason: "none",
  };
}
