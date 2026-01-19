import {
  type CreateTaskParams,
  type ExecutorContext,
  mapPriority,
  type ToolExecutionResult,
} from "@lumen/ai/tools";
import {
  type Board,
  type Column,
  type Task,
  YJS_MAP_NAMES,
} from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeCreateTask(
  params: CreateTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    // Get target column
    let columnId = params.columnId;
    if (!columnId) {
      columnId = board.column_ids?.[0];
    }
    if (!columnId) {
      return { success: false, error: "Board has no columns" };
    }

    const column = columnsMap.get(columnId) as Column | undefined;
    if (!column) {
      return { success: false, error: "Column not found" };
    }

    // Create task
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newTask: Task = {
      id: taskId,
      board_id: params.boardId,
      column_id: columnId,
      title: params.title,
      description: params.description,
      priority: mapPriority(params.priority),
      progress: 0,
      position: column.task_ids?.length ?? 0,
      due_date: params.dueDate,
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
      status: "todo",
    };

    // Update Yjs state
    doc.transact(() => {
      tasksMap.set(taskId, newTask);

      // Add task to column's task_ids
      const updatedColumn: Column = {
        ...column,
        task_ids: [...(column.task_ids ?? []), taskId],
      };
      columnsMap.set(columnId, updatedColumn);
    });

    logger.info("Task created via AI", {
      taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        taskId,
        title: params.title,
        message: `Created task "${params.title}"`,
      },
    };
  } catch (error) {
    logger.error("createTask failed", { error });
    return { success: false, error: "Failed to create task" };
  }
}
