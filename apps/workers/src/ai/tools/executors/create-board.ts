import type { CreateBoardParams } from "@lumen/ai/tools";
import { type Board, type Column, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  type ToolExecutionResult,
} from "./shared";

export async function executeCreateBoard(
  params: CreateBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const boardPositionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
    const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    const boardId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    // Create default columns
    const columnIds: string[] = [];
    const defaultColumns = ["To Do", "In Progress", "Done"];

    doc.transact(() => {
      for (let i = 0; i < defaultColumns.length; i++) {
        const colId = `col_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`;
        const column: Column = {
          id: colId,
          board_id: boardId,
          name: defaultColumns[i],
          position: i,
          task_ids: [],
        };
        columnsMap.set(colId, column);
        columnIds.push(colId);
      }

      // Create board
      const board: Board = {
        id: boardId,
        name: params.name,
        description: params.description,
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        created_at: now,
        column_ids: columnIds,
      };
      boardsMap.set(boardId, board);

      // Set board position
      boardPositionsMap.set(boardId, {
        id: boardId,
        x: params.position?.x ?? 100,
        y: params.position?.y ?? 100,
        zIndex: boardsMap.size,
      });

      // Update workspace board_ids
      const wsData = workspaceMap.get("data") as
        | { board_ids?: string[] }
        | undefined;
      if (wsData) {
        workspaceMap.set("data", {
          ...wsData,
          board_ids: [...(wsData.board_ids ?? []), boardId],
        });
      }
    });

    logger.info("Board created via AI", {
      boardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        boardId,
        name: params.name,
        message: `Created board "${params.name}"`,
      },
    };
  } catch (error) {
    logger.error("createBoard failed", { error });
    return { success: false, error: "Failed to create board" };
  }
}
