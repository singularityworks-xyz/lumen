import { nanoid } from "nanoid";
export const generateWorkspaceId = (): string => `ws_${nanoid()}`;
export const generateBoardId = (): string => `board_${nanoid()}`;
export const generateColumnId = (): string => `col_${nanoid()}`;
export const generateTaskId = (): string => `task_${nanoid()}`;
export const generateChecklistId = (): string => `checklist_${nanoid()}`;
export const generateId = (): string => nanoid();
