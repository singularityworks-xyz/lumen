import type { BulkUpdateTasksParams } from "@lumen/ai/tools";
import { type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  mapPriority,
  type ToolExecutionResult,
} from "./shared";

export async function executeBulkUpdateTasks(
  params: BulkUpdateTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    let updatedCount = 0;

    doc.transact(() => {
      for (const taskId of params.taskIds) {
        const task = tasksMap.get(taskId) as Task | undefined;
        if (task) {
          const updatedTask: Task = {
            ...task,
            ...(params.updates.priority !== undefined && {
              priority: mapPriority(params.updates.priority),
            }),
            ...(params.updates.dueDate !== undefined && {
              due_date: params.updates.dueDate ?? undefined,
            }),
            updated_at: new Date().toISOString(),
          };
          tasksMap.set(taskId, updatedTask);
          updatedCount += 1;
        }
      }
    });

    logger.info("Bulk update via AI", {
      count: updatedCount,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { updatedCount, message: `Updated ${updatedCount} tasks` },
    };
  } catch (error) {
    logger.error("bulkUpdateTasks failed", { error });
    return { success: false, error: "Failed to bulk update tasks" };
  }
}
