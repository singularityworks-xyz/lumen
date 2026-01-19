import {
  type ExecutorContext,
  mapPriority,
  type ToolExecutionResult,
  type UpdateTaskParams,
} from "@lumen/ai/tools";
import { type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeUpdateTask(
  params: UpdateTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const task = tasksMap.get(params.taskId) as Task | undefined;

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const updatedTask: Task = {
      ...task,
      ...(params.updates.title !== undefined && {
        title: params.updates.title,
      }),
      ...(params.updates.description !== undefined && {
        description: params.updates.description,
      }),
      ...(params.updates.priority !== undefined && {
        priority: mapPriority(params.updates.priority),
      }),
      ...(params.updates.dueDate !== undefined && {
        due_date: params.updates.dueDate ?? undefined,
      }),
      updated_at: new Date().toISOString(),
    };

    tasksMap.set(params.taskId, updatedTask);

    logger.info("Task updated via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        taskId: params.taskId,
        message: `Updated task "${updatedTask.title}"`,
      },
    };
  } catch (error) {
    logger.error("updateTask failed", { error });
    return { success: false, error: "Failed to update task" };
  }
}
