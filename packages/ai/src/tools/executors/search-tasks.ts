import type { SearchTasksParams } from "../schemas";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  type ToolExecutionResult,
} from "./types";

export function executeSearchTasks(
  params: SearchTasksParams,
  ctx: ExecutorContext
): ToolExecutionResult {
  const workspace = getWorkspaceFromSnapshot(ctx);
  if (!workspace) {
    return { success: false, error: "Workspace data not available" };
  }

  const query = params.query.toLowerCase();
  const limit = params.limit ?? 20;
  const results: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    columnName: string;
    boardName: string;
  }> = [];

  for (const board of workspace.boards) {
    // Filter by board if specified
    if (params.boardId && board.id !== params.boardId) {
      continue;
    }

    for (const column of board.columns) {
      for (const task of column.tasks) {
        // Check limit
        if (results.length >= limit) {
          break;
        }

        // Filter by priority if specified
        if (params.priority && task.priority !== params.priority) {
          continue;
        }

        // Filter by status if specified
        if (params.status && task.status !== params.status) {
          continue;
        }

        // Search in title and description
        const matchesQuery =
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query);

        if (matchesQuery) {
          results.push({
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            columnName: column.name,
            boardName: board.name,
          });
        }
      }

      if (results.length >= limit) {
        break;
      }
    }

    if (results.length >= limit) {
      break;
    }
  }

  return {
    success: true,
    data: {
      query: params.query,
      count: results.length,
      tasks: results,
    },
  };
}
