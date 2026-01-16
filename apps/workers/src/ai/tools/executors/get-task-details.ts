import type { GetTaskDetailsParams } from "@lumen/ai/tools";
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

export async function executeGetTaskDetails(
  params: GetTaskDetailsParams,
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

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const column = columnsMap.get(task.column_id) as Column | undefined;
    const board = boardsMap.get(task.board_id) as Board | undefined;

    return {
      success: true,
      data: {
        id: params.taskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        dueDate: task.due_date,
        tags: task.tags,
        column: column ? { id: task.column_id, name: column.name } : null,
        board: board ? { id: task.board_id, name: board.name } : null,
        createdAt: task.created_at,
      },
    };
  } catch (error) {
    logger.error("getTaskDetails failed", { error });
    return { success: false, error: "Failed to get task details" };
  }
}
