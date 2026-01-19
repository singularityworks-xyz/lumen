// Action instructions that can be executed client-side.
// Used for local workspaces where the server can't access Yjs.

import type { TaskStatus } from "../schemas";

export type CreateTaskInstruction = {
  type: "createTask";
  boardId: string;
  columnId?: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
};

export type UpdateTaskInstruction = {
  type: "updateTask";
  taskId: string;
  updates: {
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
  };
};

export type DeleteTaskInstruction = {
  type: "deleteTask";
  taskId: string;
};

export type MoveTaskInstruction = {
  type: "moveTask";
  taskId: string;
  columnId?: string;
  boardId?: string;
  position?: number;
};

export type CreateBoardInstruction = {
  type: "createBoard";
  name: string;
  description?: string;
  position?: { x: number; y: number };
};

export type UpdateBoardInstruction = {
  type: "updateBoard";
  boardId: string;
  updates: {
    name?: string;
    description?: string;
  };
};

export type DeleteBoardInstruction = {
  type: "deleteBoard";
  boardId: string;
};

export type CreateColumnInstruction = {
  type: "createColumn";
  boardId: string;
  name: string;
  position?: number;
};

export type BulkUpdateTasksInstruction = {
  type: "bulkUpdateTasks";
  taskIds: string[];
  updates: {
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
    columnId?: string;
  };
};

export type BulkDeleteTasksInstruction = {
  type: "bulkDeleteTasks";
  taskIds: string[];
};

export type ActionInstruction =
  | CreateTaskInstruction
  | UpdateTaskInstruction
  | DeleteTaskInstruction
  | MoveTaskInstruction
  | CreateBoardInstruction
  | UpdateBoardInstruction
  | DeleteBoardInstruction
  | CreateColumnInstruction
  | BulkUpdateTasksInstruction
  | BulkDeleteTasksInstruction;

// Result of building an action instruction from tool params.
// The instruction can be executed client-side for local workspaces.
export type ActionInstructionResult = {
  success: true;
  instruction: ActionInstruction;
  message: string;
};
