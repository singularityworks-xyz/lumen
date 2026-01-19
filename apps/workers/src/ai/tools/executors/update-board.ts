import type {
  ExecutorContext,
  ToolExecutionResult,
  UpdateBoardParams,
} from "@lumen/ai/tools";
import { type Board, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeUpdateBoard(
  params: UpdateBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "updateBoard",
        boardId: params.boardId,
        updates: params.updates,
      },
      message: `Update board instruction for board ${params.boardId}`,
    };
  }

  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const board = boardsMap.get(params.boardId) as Board | undefined;

    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const updatedBoard: Board = {
      ...board,
      ...(params.updates.name !== undefined && { name: params.updates.name }),
      ...(params.updates.description !== undefined && {
        description: params.updates.description,
      }),
    };

    boardsMap.set(params.boardId, updatedBoard);

    logger.info("Board updated via AI", {
      boardId: params.boardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        boardId: params.boardId,
        message: `Updated board "${updatedBoard.name}"`,
      },
    };
  } catch (error) {
    logger.error("updateBoard failed", { error });
    return { success: false, error: "Failed to update board" };
  }
}
