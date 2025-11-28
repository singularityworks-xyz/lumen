import { nanoid } from "nanoid";

/**
 * Generate a unique workspace ID with prefix
 */
export const generateWorkspaceId = (): string => `ws_${nanoid()}`;

/**
 * Generate a unique board ID with prefix
 */
export const generateBoardId = (): string => `board_${nanoid()}`;

/**
 * Generate a unique column ID with prefix
 */
export const generateColumnId = (): string => `col_${nanoid()}`;

/**
 * Generate a unique task ID with prefix
 */
export const generateTaskId = (): string => `task_${nanoid()}`;

/**
 * Generate a unique checklist ID with prefix
 */
export const generateChecklistId = (): string => `checklist_${nanoid()}`;

/**
 * Generate a generic unique ID (no prefix)
 */
export const generateId = (): string => nanoid();
