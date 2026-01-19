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
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "moveTask",
        taskId: params.taskId,
        columnId: params.columnId,
        position: params.position,
      },
      message: `Move task instruction for task ${params.taskId}`,
    };
  }

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
    const currentTaskIds = targetColumn.task_ids ?? [];
    const insertIndex = Math.max(
      0,
      Math.min(params.position ?? currentTaskIds.length, currentTaskIds.length)
    );

    doc.transact(() => {
      // Update task
      const updatedTask: Task = {
        ...task,
        column_id: targetColumnId,
        board_id: targetColumn.board_id,
        position: insertIndex,
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
        // Insert taskId at the specified position
        const updatedTaskIds = [...currentTaskIds];
        updatedTaskIds.splice(insertIndex, 0, params.taskId);

        const updatedTargetColumn: Column = {
          ...targetColumn,
          task_ids: updatedTaskIds,
        };
        columnsMap.set(targetColumnId, updatedTargetColumn);

        // Update positions for all tasks in the target column
        for (let i = 0; i < updatedTaskIds.length; i++) {
          const taskId = updatedTaskIds[i];
          const columnTask = tasksMap.get(taskId) as Task | undefined;
          if (columnTask) {
            const updatedColumnTask: Task = {
              ...columnTask,
              position: i,
              updated_at: new Date().toISOString(),
            };
            tasksMap.set(taskId, updatedColumnTask);
          }
        }
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
