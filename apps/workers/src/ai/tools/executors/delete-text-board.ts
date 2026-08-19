import type {
  DeleteTextBoardParams,
  ExecutorContext,
  ToolExecutionResult,
} from "@lumen/ai/tools";
import { type TextBoard, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeDeleteTextBoard(
  params: DeleteTextBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "deleteTextBoard",
        textBoardId: params.textBoardId,
      },
      message: `Delete text board instruction for ${params.textBoardId}`,
    };
  }

  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const textBoardsMap = doc.getMap(YJS_MAP_NAMES.TEXT_BOARDS);
    const textBoardPositionsMap = doc.getMap(
      YJS_MAP_NAMES.TEXT_BOARD_POSITIONS
    );
    const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    const textBoard = textBoardsMap.get(params.textBoardId) as
      | TextBoard
      | undefined;
    if (!textBoard) {
      return { success: false, error: "Text board not found" };
    }

    doc.transact(() => {
      textBoardsMap.delete(params.textBoardId);
      textBoardPositionsMap.delete(params.textBoardId);

      // Update workspace text_board_ids (best effort - both key shapes exist)
      for (const key of [ctx.workspaceId, "data"]) {
        const wsData = workspaceMap.get(key) as
          | { text_board_ids?: string[] }
          | undefined;
        if (wsData) {
          workspaceMap.set(key, {
            ...wsData,
            text_board_ids:
              wsData.text_board_ids?.filter(
                (id) => id !== params.textBoardId
              ) ?? [],
          });
        }
      }
    });

    logger.info("Text board deleted via AI", {
      textBoardId: params.textBoardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        textBoardId: params.textBoardId,
        message: `Deleted text board "${textBoard.name}"`,
      },
    };
  } catch (error) {
    logger.error("deleteTextBoard failed", { error });
    return { success: false, error: "Failed to delete text board" };
  }
}
