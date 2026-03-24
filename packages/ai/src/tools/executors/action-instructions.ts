// Action instructions that can be executed client-side.
// Used for local workspaces where the server can't access Yjs.

import type { TaskStatus } from "../schemas";

export interface CreateTaskInstruction {
  boardId: string;
  columnId?: string;
  description?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  title: string;
  type: "createTask";
}

export interface UpdateTaskInstruction {
  taskId: string;
  type: "updateTask";
  updates: {
    title?: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
  };
}

export interface DeleteTaskInstruction {
  taskId: string;
  type: "deleteTask";
}

export interface MoveTaskInstruction {
  boardId?: string;
  columnId?: string;
  position?: number;
  taskId: string;
  type: "moveTask";
}

export interface CreateBoardInstruction {
  description?: string;
  name: string;
  position?: { x: number; y: number };
  type: "createBoard";
}

export interface UpdateBoardInstruction {
  boardId: string;
  type: "updateBoard";
  updates: {
    name?: string;
    description?: string;
  };
}

export interface DeleteBoardInstruction {
  boardId: string;
  type: "deleteBoard";
}

export interface CreateColumnInstruction {
  boardId: string;
  name: string;
  position?: number;
  type: "createColumn";
}

export interface BulkUpdateTasksInstruction {
  taskIds: string[];
  type: "bulkUpdateTasks";
  updates: {
    priority?: "low" | "medium" | "high";
    status?: TaskStatus;
    dueDate?: string | null;
    columnId?: string;
  };
}

export interface BulkDeleteTasksInstruction {
  taskIds: string[];
  type: "bulkDeleteTasks";
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
  instruction: ActionInstruction;
  message: string;
  success: true;
}
