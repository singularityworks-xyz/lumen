// Builders that convert tool params to action instructions.
// These are used for local workspaces where actions execute client-side.
import type {
  BulkDeleteTasksParams,
  BulkUpdateTasksParams,
  CreateBoardParams,
  CreateColumnParams,
  CreateTaskParams,
  CreateTextBoardParams,
  DeleteBoardParams,
  DeleteTaskParams,
  DeleteTextBoardParams,
  MoveTaskParams,
  UpdateBoardParams,
  UpdateTaskParams,
  UpdateTextBoardParams,
} from "../schemas";
import type { ActionInstructionResult } from "./action-instructions";
import { mapPriority } from "./types";

export function buildCreateTaskInstruction(
  params: CreateTaskParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "createTask",
      boardId: params.boardId,
      columnId: params.columnId,
      title: params.title,
      description: params.description,
      priority: params.priority ? mapPriority(params.priority) : undefined,
      dueDate: params.dueDate,
    },
    message: `Create task "${params.title}"`,
  };
}

export function buildUpdateTaskInstruction(
  params: UpdateTaskParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "updateTask",
      taskId: params.taskId,
      updates: {
        title: params.updates.title,
        description: params.updates.description,
        priority: params.updates.priority
          ? mapPriority(params.updates.priority)
          : undefined,
        status: params.updates.status,
        dueDate: params.updates.dueDate,
      },
    },
    message: `Update task ${params.taskId}`,
  };
}

export function buildDeleteTaskInstruction(
  params: DeleteTaskParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "deleteTask",
      taskId: params.taskId,
    },
    message: `Delete task ${params.taskId}`,
  };
}

export function buildMoveTaskInstruction(
  params: MoveTaskParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "moveTask",
      taskId: params.taskId,
      columnId: params.columnId,
      boardId: params.boardId,
      position: params.position,
    },
    message: `Move task ${params.taskId}`,
  };
}

export function buildCreateBoardInstruction(
  params: CreateBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "createBoard",
      name: params.name,
      description: params.description,
      position: params.position,
    },
    message: `Create board "${params.name}"`,
  };
}

export function buildUpdateBoardInstruction(
  params: UpdateBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "updateBoard",
      boardId: params.boardId,
      updates: {
        name: params.updates.name,
        description: params.updates.description,
      },
    },
    message: `Update board ${params.boardId}`,
  };
}

export function buildDeleteBoardInstruction(
  params: DeleteBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "deleteBoard",
      boardId: params.boardId,
    },
    message: `Delete board ${params.boardId}`,
  };
}

export function buildCreateTextBoardInstruction(
  params: CreateTextBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "createTextBoard",
      name: params.name,
      description: params.description,
      content: params.content,
      position: params.position,
    },
    message: `Create text board "${params.name}"`,
  };
}

export function buildUpdateTextBoardInstruction(
  params: UpdateTextBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "updateTextBoard",
      textBoardId: params.textBoardId,
      updates: {
        name: params.updates.name,
        description: params.updates.description,
        content: params.updates.content,
      },
    },
    message: `Update text board ${params.textBoardId}`,
  };
}

export function buildDeleteTextBoardInstruction(
  params: DeleteTextBoardParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "deleteTextBoard",
      textBoardId: params.textBoardId,
    },
    message: `Delete text board ${params.textBoardId}`,
  };
}

export function buildCreateColumnInstruction(
  params: CreateColumnParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "createColumn",
      boardId: params.boardId,
      name: params.name,
      position: params.position,
    },
    message: `Create column "${params.name}"`,
  };
}

export function buildBulkUpdateTasksInstruction(
  params: BulkUpdateTasksParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "bulkUpdateTasks",
      taskIds: params.taskIds,
      updates: {
        priority: params.updates.priority
          ? mapPriority(params.updates.priority)
          : undefined,
        status: params.updates.status,
        dueDate: params.updates.dueDate,
        columnId: params.updates.columnId,
      },
    },
    message: `Update ${params.taskIds.length} tasks`,
  };
}

export function buildBulkDeleteTasksInstruction(
  params: BulkDeleteTasksParams
): ActionInstructionResult {
  return {
    success: true,
    instruction: {
      type: "bulkDeleteTasks",
      taskIds: params.taskIds,
    },
    message: `Delete ${params.taskIds.length} ${params.taskIds.length === 1 ? "task" : "tasks"}`,
  };
}

// Build an action instruction for any action tool. Returns null if the tool is not an action tool
export function buildActionInstruction(
  toolName: string,
  args: Record<string, unknown>
): ActionInstructionResult | null {
  switch (toolName) {
    case "createTask":
      return buildCreateTaskInstruction(args as CreateTaskParams);
    case "updateTask":
      return buildUpdateTaskInstruction(args as UpdateTaskParams);
    case "deleteTask":
      return buildDeleteTaskInstruction(args as DeleteTaskParams);
    case "moveTask":
      return buildMoveTaskInstruction(args as MoveTaskParams);
    case "createBoard":
      return buildCreateBoardInstruction(args as CreateBoardParams);
    case "updateBoard":
      return buildUpdateBoardInstruction(args as UpdateBoardParams);
    case "deleteBoard":
      return buildDeleteBoardInstruction(args as DeleteBoardParams);
    case "createTextBoard":
      return buildCreateTextBoardInstruction(args as CreateTextBoardParams);
    case "updateTextBoard":
      return buildUpdateTextBoardInstruction(args as UpdateTextBoardParams);
    case "deleteTextBoard":
      return buildDeleteTextBoardInstruction(args as DeleteTextBoardParams);
    case "createColumn":
      return buildCreateColumnInstruction(args as CreateColumnParams);
    case "bulkUpdateTasks":
      return buildBulkUpdateTasksInstruction(args as BulkUpdateTasksParams);
    case "bulkDeleteTasks":
      return buildBulkDeleteTasksInstruction(args as BulkDeleteTasksParams);
    default:
      return null;
  }
}
