// Action instructions that can be executed client-side.
// Used for local workspaces where the server can't access Yjs.

import type { TaskStatus } from "../schemas";

export interface CreateTaskInstruction {
  type: "createTask";
  boardId: string;
  columnId?: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
}

export interface UpdateTaskInstruction {
  type: "updateTask";
  taskId: string;
  updates: {
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
  };
}

export interface DeleteTaskInstruction {
  type: "deleteTask";
  taskId: string;
}

export interface MoveTaskInstruction {
  type: "moveTask";
  taskId: string;
  columnId?: string;
  boardId?: string;
  position?: number;
}

export interface CreateBoardInstruction {
  type: "createBoard";
  name: string;
  description?: string;
  position?: { x: number; y: number };
}

export interface UpdateBoardInstruction {
  type: "updateBoard";
  boardId: string;
  updates: {
    name?: string;
    description?: string;
  };
}

export interface DeleteBoardInstruction {
  type: "deleteBoard";
  boardId: string;
}

export interface CreateColumnInstruction {
  type: "createColumn";
  boardId: string;
  name: string;
  position?: number;
}

export interface BulkUpdateTasksInstruction {
  type: "bulkUpdateTasks";
  taskIds: string[];
  updates: {
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
    columnId?: string;
  };
}

export interface BulkDeleteTasksInstruction {
  type: "bulkDeleteTasks";
  taskIds: string[];
}

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
export interface ActionInstructionResult {
  success: true;
  instruction: ActionInstruction;
  message: string;
}
