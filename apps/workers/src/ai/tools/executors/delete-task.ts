import type { DeleteTaskParams } from "@lumen/ai/tools";
import { type Column, type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  type ToolExecutionResult,
} from "./shared";

export async function executeDeleteTask(
  params: DeleteTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const column = columnsMap.get(task.column_id) as Column | undefined;

    doc.transact(() => {
      tasksMap.delete(params.taskId);

      // Remove from column's task_ids
      if (column) {
        const updatedColumn: Column = {
          ...column,
          task_ids: column.task_ids?.filter((id) => id !== params.taskId) ?? [],
        };
        columnsMap.set(task.column_id, updatedColumn);
      }
    });

    logger.info("Task deleted via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { taskId: params.taskId, message: `Deleted task "${task.title}"` },
    };
  } catch (error) {
    logger.error("deleteTask failed", { error });
    return { success: false, error: "Failed to delete task" };
  }
}
