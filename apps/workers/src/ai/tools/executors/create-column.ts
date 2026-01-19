import type {
  CreateColumnParams,
  ExecutorContext,
  ToolExecutionResult,
} from "@lumen/ai/tools";
import { type Board, type Column, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeCreateColumn(
  params: CreateColumnParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "createColumn",
        boardId: params.boardId,
        name: params.name,
        position: params.position,
      },
      message: `Create column instruction for "${params.name}"`,
    };
  }

  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const columnId = `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    doc.transact(() => {
      const column: Column = {
        id: columnId,
        board_id: params.boardId,
        name: params.name,
        position: params.position ?? board.column_ids?.length ?? 0,
        task_ids: [],
      };
      columnsMap.set(columnId, column);
      const updatedBoard: Board = {
        ...board,
        column_ids: [...(board.column_ids ?? []), columnId],
      };
      boardsMap.set(params.boardId, updatedBoard);
    });

    logger.info("Column created via AI", {
      columnId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        columnId,
        name: params.name,
        message: `Created column "${params.name}"`,
      },
    };
  } catch (error) {
    logger.error("createColumn failed", { error });
    return { success: false, error: "Failed to create column" };
  }
}
