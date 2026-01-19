import type {
  ExecutorContext,
  MoveTaskParams,
  ToolExecutionResult,
} from "@lumen/ai/tools";
import { type Column, type Task, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeMoveTask(
  params: MoveTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const targetColumnId = params.columnId ?? task.column_id;
    const targetColumn = columnsMap.get(targetColumnId) as Column | undefined;
    if (!targetColumn) {
      return { success: false, error: "Target column not found" };
    }

    const sourceColumn = columnsMap.get(task.column_id) as Column | undefined;

    doc.transact(() => {
      // Update task
      const updatedTask: Task = {
        ...task,
        column_id: targetColumnId,
        board_id: targetColumn.board_id,
        position: params.position ?? targetColumn.task_ids?.length ?? 0,
        updated_at: new Date().toISOString(),
      };
      tasksMap.set(params.taskId, updatedTask);

      // Remove from source column
      if (sourceColumn && task.column_id !== targetColumnId) {
        const updatedSourceColumn: Column = {
          ...sourceColumn,
          task_ids:
            sourceColumn.task_ids?.filter((id) => id !== params.taskId) ?? [],
        };
        columnsMap.set(task.column_id, updatedSourceColumn);
      }

      // Add to target column
      if (task.column_id !== targetColumnId) {
        const updatedTargetColumn: Column = {
          ...targetColumn,
          task_ids: [...(targetColumn.task_ids ?? []), params.taskId],
        };
        columnsMap.set(targetColumnId, updatedTargetColumn);
      }
    });

    logger.info("Task moved via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { taskId: params.taskId, message: `Moved task "${task.title}"` },
    };
  } catch (error) {
    logger.error("moveTask failed", { error });
    return { success: false, error: "Failed to move task" };
  }
}
