import {
  type BulkDeleteTasksParams,
  type BulkUpdateTasksParams,
  // Action instruction builder for ephemeral mode
  buildActionInstruction,
  type CreateBoardParams,
  type CreateColumnParams,
  type CreateTaskParams,
  type DeleteBoardParams,
  type DeleteTaskParams,
  type ExecutorContext,
  // Query executors from @lumen/ai (snapshot-based, privacy-first)
  executeGetBoardDetails,
  executeGetTaskDetails,
  executeGetWorkspaceOverview,
  executeSearchTasks,
  type GetBoardDetailsParams,
  type GetTaskDetailsParams,
  type GetWorkspaceOverviewParams,
  type MoveTaskParams,
  requiresConfirmation,
  type SearchTasksParams,
  type ToolExecutionResult,
  type UpdateBoardParams,
  type UpdateTaskParams,
} from "@lumen/ai/tools";

// Action executors (still need Yjs for real-time sync)
import { executeBulkDeleteTasks } from "./executors/bulk-delete-tasks";
import { executeBulkUpdateTasks } from "./executors/bulk-update-tasks";
import { executeCreateBoard } from "./executors/create-board";
import { executeCreateColumn } from "./executors/create-column";
import { executeCreateTask } from "./executors/create-task";
import { executeDeleteBoard } from "./executors/delete-board";
import { executeDeleteTask } from "./executors/delete-task";
import { executeMoveTask } from "./executors/move-task";
import { executeUpdateBoard } from "./executors/update-board";
import { executeUpdateTask } from "./executors/update-task";

export type { ExecutorContext, ToolExecutionResult } from "@lumen/ai/tools";

// Main executor function
export function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
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
): Promise<ToolExecutionResult> {
  switch (toolName) {
    // Query tools (from @lumen/ai - snapshot-based)
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

    // Action tools - check ephemeral mode
    case "createTask":
    case "updateTask":
    case "deleteTask":
    case "moveTask":
    case "createBoard":
    case "updateBoard":
    case "deleteBoard":
    case "createColumn":
    case "bulkUpdateTasks":
    case "bulkDeleteTasks":
      return executeActionTool(toolName, args, ctx);

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

// Helper to execute action tools, returning instructions for ephemeral mode
// biome-ignore lint/suspicious/useAwait: async is needed for consistent return type
async function executeActionTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For ephemeral (local) workspaces, return instructions instead of executing
  if (ctx.ephemeral) {
    const instructionResult = buildActionInstruction(toolName, args);
    if (instructionResult) {
      return {
        success: true,
        data: {
          actionInstruction: instructionResult.instruction,
          message: instructionResult.message,
        },
      };
    }
    return { success: false, error: `Unknown action tool: ${toolName}` };
  }

  // For shared workspaces, execute via Yjs
  switch (toolName) {
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
      return { success: false, error: `Unknown action tool: ${toolName}` };
  }
}
