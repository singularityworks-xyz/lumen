import type { SearchTasksParams } from "@lumen/ai/tools";
import {
  type Board,
  type Column,
  type Task,
  YJS_MAP_NAMES,
} from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  type ToolExecutionResult,
} from "./shared";

export async function executeSearchTasks(
  params: SearchTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);

    const query = params.query.toLowerCase();
    const results: Array<{
      id: string;
      title: string;
      priority: string;
      status: string;
      columnName: string;
      boardName: string;
    }> = [];

    tasksMap.forEach((taskData, taskId) => {
      const task = taskData as Task;

      // Filter by board if specified
      if (params.boardId && task.board_id !== params.boardId) {
        return;
      }

      // Filter by priority if specified
      if (params.priority && task.priority !== params.priority) {
        return;
      }

      // Filter by status if specified
      if (params.status && task.status !== params.status) {
        return;
      }

      // Search in title and description
      const matchesQuery =
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query);

      if (matchesQuery && results.length < (params.limit ?? 20)) {
        const column = columnsMap.get(task.column_id) as Column | undefined;
        const board = boardsMap.get(task.board_id) as Board | undefined;

        results.push({
          id: taskId,
          title: task.title,
          priority: task.priority,
          status: task.status,
          columnName: column?.name ?? "Unknown",
          boardName: board?.name ?? "Unknown",
        });
      }
    });

    return {
      success: true,
      data: {
        query: params.query,
        count: results.length,
        tasks: results,
      },
    };
  } catch (error) {
    logger.error("searchTasks failed", { error });
    return { success: false, error: "Failed to search tasks" };
  }
}
