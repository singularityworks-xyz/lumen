import type { GetTaskDetailsParams } from "../schemas";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  type ToolExecutionResult,
} from "./types";

export function executeGetTaskDetails(
  params: GetTaskDetailsParams,
  ctx: ExecutorContext
): ToolExecutionResult {
  const workspace = getWorkspaceFromSnapshot(ctx);
  if (!workspace) {
    return { success: false, error: "Workspace data not available" };
  }

  // Search for the task across all boards and columns
  for (const board of workspace.boards) {
    for (const column of board.columns) {
      const task = column.tasks.find((t) => t.id === params.taskId);
      if (task) {
        return {
          success: true,
          data: {
            id: params.taskId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            progress: task.progress,
            dueDate: task.dueDate,
            tags: task.tags,
            column: { id: column.id, name: column.name },
            board: { id: board.id, name: board.name },
          },
        };
      }
    }
  }

  return { success: false, error: "Task not found" };
}
