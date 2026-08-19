import { textToTiptapJson } from "@lumen/ai";
import type {
  ExecutorContext,
  ToolExecutionResult,
  UpdateTextBoardParams,
} from "@lumen/ai/tools";
import { type TextBoard, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeUpdateTextBoard(
  params: UpdateTextBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "updateTextBoard",
        textBoardId: params.textBoardId,
        updates: params.updates,
      },
      message: `Update text board instruction for ${params.textBoardId}`,
    };
  }

  try {
    const doc = await getWorkspaceYjsDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const textBoardsMap = doc.getMap(YJS_MAP_NAMES.TEXT_BOARDS);
    const textBoard = textBoardsMap.get(params.textBoardId) as
      | TextBoard
      | undefined;

    if (!textBoard) {
      return { success: false, error: "Text board not found" };
    }

    const updatedTextBoard: TextBoard = {
      ...textBoard,
      ...(params.updates.name !== undefined && {
        name: params.updates.name,
      }),
      ...(params.updates.description !== undefined && {
        description: params.updates.description ?? undefined,
      }),
      ...(params.updates.content !== undefined && {
        content: textToTiptapJson(params.updates.content),
      }),
      updated_at: new Date().toISOString(),
    };

    textBoardsMap.set(params.textBoardId, updatedTextBoard);

    logger.info("Text board updated via AI", {
      textBoardId: params.textBoardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        textBoardId: params.textBoardId,
        message: `Updated text board "${updatedTextBoard.name}"`,
      },
    };
  } catch (error) {
    logger.error("updateTextBoard failed", { error });
    return { success: false, error: "Failed to update text board" };
  }
}
