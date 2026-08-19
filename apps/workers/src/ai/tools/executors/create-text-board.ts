import { textToTiptapJson } from "@lumen/ai";
import type {
  CreateTextBoardParams,
  ExecutorContext,
  ToolExecutionResult,
} from "@lumen/ai/tools";
import { type TextBoard, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { getWorkspaceYjsDoc, logger } from "./yjs-accessor";

export async function executeCreateTextBoard(
  params: CreateTextBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // For local workspaces, return a client-side instruction
  if (ctx.ephemeral) {
    return {
      success: true,
      instruction: {
        type: "createTextBoard",
        name: params.name,
        description: params.description,
        content: params.content,
        position: params.position,
      },
      message: `Create text board instruction for "${params.name}"`,
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

    const textBoardId = `tb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const textBoard: TextBoard = {
      id: textBoardId,
      workspace_id: ctx.workspaceId,
      name: params.name,
      description: params.description,
      content: params.content ? textToTiptapJson(params.content) : undefined,
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
    };

    doc.transact(() => {
      textBoardsMap.set(textBoardId, textBoard);
      textBoardPositionsMap.set(textBoardId, {
        id: textBoardId,
        x: params.position?.x ?? 100,
        y: params.position?.y ?? 100,
        zIndex: textBoardsMap.size,
      });

      // Update workspace text_board_ids (best effort - both key shapes exist)
      for (const key of [ctx.workspaceId, "data"]) {
        const wsData = workspaceMap.get(key) as
          | { text_board_ids?: string[] }
          | undefined;
        if (wsData) {
          workspaceMap.set(key, {
            ...wsData,
            text_board_ids: [...(wsData.text_board_ids ?? []), textBoardId],
          });
        }
      }
    });

    logger.info("Text board created via AI", {
      textBoardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        textBoardId,
        name: params.name,
        message: `Created text board "${params.name}"`,
      },
    };
  } catch (error) {
    logger.error("createTextBoard failed", { error });
    return { success: false, error: "Failed to create text board" };
  }
}
