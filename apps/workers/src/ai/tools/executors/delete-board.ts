import type { DeleteBoardParams } from "@lumen/ai/tools";
import { type Board, type Column, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  type ToolExecutionResult,
} from "./shared";

export async function executeDeleteBoard(
  params: DeleteBoardParams,
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
    const boardPositionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
    const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    doc.transact(() => {
      // Delete all tasks in board's columns
      for (const colId of board.column_ids ?? []) {
        const col = columnsMap.get(colId) as Column | undefined;
        if (col) {
          for (const taskId of col.task_ids ?? []) {
            tasksMap.delete(taskId);
          }
          columnsMap.delete(colId);
        }
      }

      // Delete board
      boardsMap.delete(params.boardId);
      boardPositionsMap.delete(params.boardId);

      // Update workspace board_ids
      const wsData = workspaceMap.get("data") as
        | { board_ids?: string[] }
        | undefined;
      if (wsData) {
        workspaceMap.set("data", {
          ...wsData,
          board_ids:
            wsData.board_ids?.filter((id) => id !== params.boardId) ?? [],
        });
      }
    });

    logger.info("Board deleted via AI", {
      boardId: params.boardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        boardId: params.boardId,
        message: `Deleted board "${board.name}"`,
      },
    };
  } catch (error) {
    logger.error("deleteBoard failed", { error });
    return { success: false, error: "Failed to delete board" };
  }
}
