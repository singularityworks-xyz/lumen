import type { DenormalizedColumn } from "../types";

/**
 * Centralized constants and utility functions for smart board resizing.
 * RESIZE BEHAVIOR:
 * 1. Boards auto-grow to fit content (columns and tasks)
 * 2. User manual resize sets a minimum size that auto-resize respects
 * 3. Boards never auto-shrink automatically (only grow)
 * 4. Height is calculated based on the tallest column's visible task count
 * 5. Width is calculated based on column count (excluding skeleton)
 */

export const BOARD_RESIZE_CONSTANTS = {
  COLUMN_WIDTH: 300,
  COLUMN_GAP: 12,
  BOARD_PADDING: 24,
  HEADER_HEIGHT: 42,
  COLUMN_HEADER: 56,
  COLUMN_PADDING: 24,
  SKELETON_COLUMN_WIDTH: 225,
  TASK_HEIGHT: 120,
  TASK_GAP: 8,
  COLUMN_FOOTER_HEIGHT: 48,
} as const;

export const RESIZE_RULES = {
  GROW_TO_FIT: true,
  RESPECT_USER_SIZE: true,
} as const;

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

export function calculateMinDimensions(): { width: number; height: number } {
  const {
    COLUMN_WIDTH,
    BOARD_PADDING,
    HEADER_HEIGHT,
    COLUMN_HEADER,
    COLUMN_PADDING,
  } = BOARD_RESIZE_CONSTANTS;

  return {
    width: COLUMN_WIDTH + BOARD_PADDING + 20,
    height:
      HEADER_HEIGHT + COLUMN_HEADER + 220 + COLUMN_PADDING + BOARD_PADDING,
  };
}

export function calculateMaxDimensions(columns: DenormalizedColumn[]): {
  width: number;
  height: number;
} {
  const {
    COLUMN_WIDTH,
    COLUMN_GAP,
    BOARD_PADDING,
    HEADER_HEIGHT,
    COLUMN_HEADER,
    COLUMN_PADDING,
    SKELETON_COLUMN_WIDTH,
    TASK_HEIGHT,
    TASK_GAP,
  } = BOARD_RESIZE_CONSTANTS;

  const numColumns = columns.length;

  const maxWidth =
    numColumns * COLUMN_WIDTH +
    (numColumns > 0 ? numColumns * COLUMN_GAP : 0) +
    (numColumns > 0 ? COLUMN_GAP : 0) +
    SKELETON_COLUMN_WIDTH +
    BOARD_PADDING * 2;

  const maxTaskCount = Math.max(...columns.map((c) => c.tasks?.length ?? 0), 0);

  const maxHeight =
    HEADER_HEIGHT +
    COLUMN_HEADER +
    (maxTaskCount + 2) * TASK_HEIGHT +
    (maxTaskCount + 2 - 1) * TASK_GAP +
    COLUMN_PADDING +
    BOARD_PADDING;

  return { width: maxWidth, height: maxHeight };
}

/**
 * Calculate initial dimensions for a newly created board with empty columns.
 * This ensures consistent sizing when boards are synced across browsers.
 * Uses the same calculation logic as calculateContentDimensions for consistency.
 * @param columnCount - Number of columns in the new board
 */
export function calculateInitialBoardDimensions(columnCount: number): {
  width: number;
  height: number;
} {
  const {
    COLUMN_WIDTH,
    COLUMN_GAP,
    BOARD_PADDING,
    HEADER_HEIGHT,
    COLUMN_HEADER,
    COLUMN_PADDING,
    COLUMN_FOOTER_HEIGHT,
  } = BOARD_RESIZE_CONSTANTS;

  // Width = columns + gaps + padding (NO skeleton - same as calculateContentDimensions)
  const width =
    columnCount * COLUMN_WIDTH +
    (columnCount > 0 ? (columnCount - 1) * COLUMN_GAP : 0) +
    BOARD_PADDING * 2;

  // Height for empty columns: header + column header + empty placeholder + footer + padding
  const emptyColumnHeight =
    COLUMN_HEADER + COLUMN_PADDING + 160 + COLUMN_FOOTER_HEIGHT;
  const height = HEADER_HEIGHT + emptyColumnHeight + BOARD_PADDING;

  return { width, height };
}

/**
 * Calculate the required content dimensions based on actual column content
 * Note: Does NOT include skeleton column - that's UI chrome, not content
 */
export function calculateContentDimensions(columns: DenormalizedColumn[]): {
  width: number;
  height: number;
} {
  const { COLUMN_WIDTH, COLUMN_GAP, BOARD_PADDING, HEADER_HEIGHT } =
    BOARD_RESIZE_CONSTANTS;

  const numColumns = columns.length;

  // Width = columns + gaps + padding (NO skeleton - that's UI, not content)
  const width =
    numColumns * COLUMN_WIDTH +
    (numColumns > 0 ? (numColumns - 1) * COLUMN_GAP : 0) +
    BOARD_PADDING * 2;

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

/**
 * Determine if and how to apply resize based on content and user preferences
 *
 * SIMPLE RULE: Only grow, never shrink automatically.
 * - If content exceeds current size -> grow to fit
 * - If user resized -> respect their size as minimum
 * - Never auto-shrink (prevents flickering)
 */
export function shouldApplyResize(
  currentDimensions: { width: number; height: number },
  contentDimensions: { width: number; height: number },
  userResized: boolean,
  userDimensions?: { width?: number; height?: number }
): {
  shouldResize: boolean;
  newDimensions: { width: number; height: number };
  reason?: "grow-for-content" | "none";
} {
  const minDims = calculateMinDimensions();

  // The effective minimum is the largest of: min constraints, user size (if set), content needs
  const effectiveMinWidth = userResized
    ? Math.max(userDimensions?.width ?? minDims.width, minDims.width)
    : minDims.width;

  const effectiveMinHeight = userResized
    ? Math.max(userDimensions?.height ?? minDims.height, minDims.height)
    : minDims.height;

  // Only grow if content requires more space than we currently have
  // Use a small threshold (5px) to avoid micro-adjustments that cause flickering
  const THRESHOLD = 5;
  const needsWidthGrow =
    contentDimensions.width > currentDimensions.width + THRESHOLD;
  const needsHeightGrow =
    contentDimensions.height > currentDimensions.height + THRESHOLD;

  if (needsWidthGrow || needsHeightGrow) {
    return {
      shouldResize: true,
      newDimensions: {
        width: Math.max(
          currentDimensions.width,
          contentDimensions.width,
          effectiveMinWidth
        ),
        height: Math.max(
          currentDimensions.height,
          contentDimensions.height,
          effectiveMinHeight
        ),
      },
      reason: "grow-for-content",
    };
  }

  // Never auto-shrink - this prevents flickering
  // User can manually resize smaller if they want
  return {
    shouldResize: false,
    newDimensions: currentDimensions,
    reason: "none",
  };
}
