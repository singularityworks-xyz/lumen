import type { GetBoardDetailsParams } from "@lumen/ai/tools";
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

export async function executeGetBoardDetails(
  params: GetBoardDetailsParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
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

    const columns = board.column_ids
      ?.map((colId) => {
        const col = columnsMap.get(colId) as Column | undefined;
        if (!col) {
          return null;
        }

        const tasks = col.task_ids
          ?.map((taskId) => {
            const task = tasksMap.get(taskId) as Task | undefined;
            return task
              ? {
                  id: taskId,
                  title: task.title,
                  priority: task.priority,
                  status: task.status,
                  dueDate: task.due_date,
                }
              : null;
          })
          .filter(Boolean);

        return {
          id: colId,
          name: col.name,
          taskCount: tasks?.length ?? 0,
          tasks,
        };
      })
      .filter(Boolean);

    return {
      success: true,
      data: {
        id: params.boardId,
        name: board.name,
        description: board.description,
        columns,
      },
    };
  } catch (error) {
    logger.error("getBoardDetails failed", { error });
    return { success: false, error: "Failed to get board details" };
  }
}
