import {
  type BulkUpdateTasksParams,
  type ExecutorContext,
  mapPriority,
  type ToolExecutionResult,
} from "@lumen/ai/tools";
import { type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeBulkUpdateTasks(
  params: BulkUpdateTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "bulkUpdateTasks",
        taskIds: params.taskIds,
        updates: params.updates,
      },
      message: `Bulk update instruction for ${params.taskIds.length} tasks`,
    };
  }

  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
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
