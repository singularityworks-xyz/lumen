import type {
  BulkDeleteTasksParams,
  ExecutorContext,
  ToolExecutionResult,
} from "@lumen/ai/tools";
import { type Column, type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeBulkDeleteTasks(
  params: BulkDeleteTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    let deletedCount = 0;

    doc.transact(() => {
      for (const taskId of params.taskIds) {
        const task = tasksMap.get(taskId) as Task | undefined;
        if (task) {
          tasksMap.delete(taskId);

          // Remove from column
          const column = columnsMap.get(task.column_id) as Column | undefined;
          if (column) {
            columnsMap.set(task.column_id, {
              ...column,
              task_ids: column.task_ids?.filter((id) => id !== taskId) ?? [],
            });
          }
          deletedCount += 1;
        }
      }
    });

    logger.info("Bulk delete via AI", {
      count: deletedCount,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { deletedCount, message: `Deleted ${deletedCount} tasks` },
    };
  } catch (error) {
    logger.error("bulkDeleteTasks failed", { error });
    return { success: false, error: "Failed to bulk delete tasks" };
  }
}
