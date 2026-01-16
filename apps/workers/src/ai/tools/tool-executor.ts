import {
  type BulkDeleteTasksParams,
  type BulkUpdateTasksParams,
  type CreateBoardParams,
  type CreateColumnParams,
  type CreateTaskParams,
  type DeleteBoardParams,
  type DeleteTaskParams,
  type GetBoardDetailsParams,
  type GetTaskDetailsParams,
  type GetWorkspaceOverviewParams,
  type MoveTaskParams,
  requiresConfirmation,
  type SearchTasksParams,
  type UpdateBoardParams,
  type UpdateTaskParams,
} from "@lumen/ai/tools";
import { executeBulkDeleteTasks } from "./executors/bulk-delete-tasks";
import { executeBulkUpdateTasks } from "./executors/bulk-update-tasks";
import { executeCreateBoard } from "./executors/create-board";
import { executeCreateColumn } from "./executors/create-column";
import { executeCreateTask } from "./executors/create-task";
import { executeDeleteBoard } from "./executors/delete-board";
import { executeDeleteTask } from "./executors/delete-task";
import { executeGetBoardDetails } from "./executors/get-board-details";
import { executeGetTaskDetails } from "./executors/get-task-details";
import { executeGetWorkspaceOverview } from "./executors/get-workspace-overview";
import { executeMoveTask } from "./executors/move-task";
import { executeSearchTasks } from "./executors/search-tasks";
import type { ExecutorContext } from "./executors/shared";
import { executeUpdateBoard } from "./executors/update-board";
import { executeUpdateTask } from "./executors/update-task";

export type {
  ExecutorContext,
  ToolExecutionResult,
} from "./executors/shared";

// Main executor function
export function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<import("./executors/shared").ToolExecutionResult> {
  // Check if confirmation is required
  if (requiresConfirmation(toolName)) {
    return Promise.resolve({
      success: false,
      requiresConfirmation: true,
      data: { toolName, args },
      error: `Action "${toolName}" requires confirmation`,
    });
  }

  return executeToolDirect(toolName, args, ctx);
}

// Execute without confirmation check (for confirmed actions)
// biome-ignore lint/suspicious/useAwait: sugarcoating is required here
export async function executeToolDirect(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<import("./executors/shared").ToolExecutionResult> {
  switch (toolName) {
    // Query tools
    case "getWorkspaceOverview":
      return executeGetWorkspaceOverview(
        args as GetWorkspaceOverviewParams,
        ctx
      );
    case "getBoardDetails":
      return executeGetBoardDetails(args as GetBoardDetailsParams, ctx);
    case "getTaskDetails":
      return executeGetTaskDetails(args as GetTaskDetailsParams, ctx);
    case "searchTasks":
      return executeSearchTasks(args as SearchTasksParams, ctx);

    // Action tools
    case "createTask":
      return executeCreateTask(args as CreateTaskParams, ctx);
    case "updateTask":
      return executeUpdateTask(args as UpdateTaskParams, ctx);
    case "deleteTask":
      return executeDeleteTask(args as DeleteTaskParams, ctx);
    case "moveTask":
      return executeMoveTask(args as MoveTaskParams, ctx);
    case "createBoard":
      return executeCreateBoard(args as CreateBoardParams, ctx);
    case "updateBoard":
      return executeUpdateBoard(args as UpdateBoardParams, ctx);
    case "deleteBoard":
      return executeDeleteBoard(args as DeleteBoardParams, ctx);
    case "createColumn":
      return executeCreateColumn(args as CreateColumnParams, ctx);
    case "bulkUpdateTasks":
      return executeBulkUpdateTasks(args as BulkUpdateTasksParams, ctx);
    case "bulkDeleteTasks":
      return executeBulkDeleteTasks(args as BulkDeleteTasksParams, ctx);

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
