import type { GetWorkspaceOverviewParams } from "@lumen/ai/tools";
import { type Board, type Column, YJS_MAP_NAMES } from "@lumen/yjs-shared";
import {
  type ExecutorContext,
  getWorkspaceDoc,
  logger,
  type ToolExecutionResult,
} from "./shared";

export async function executeGetWorkspaceOverview(
  _params: GetWorkspaceOverviewParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return {
        success: false,
        error: "Workspace not loaded. Open the workspace first.",
      };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    const boards: Array<{
      id: string;
      name: string;
      columnCount: number;
      taskCount: number;
    }> = [];

    boardsMap.forEach((boardData, boardId) => {
      const board = boardData as Board;
      const columnCount = board.column_ids?.length ?? 0;
      let taskCount = 0;

      for (const colId of board.column_ids ?? []) {
        const col = columnsMap.get(colId) as Column | undefined;
        taskCount += col?.task_ids?.length ?? 0;
      }

      boards.push({
        id: boardId,
        name: board.name,
        columnCount,
        taskCount,
      });
    });

    const workspaceData = workspaceMap.get("data");

    return {
      success: true,
      data: {
        workspaceId: ctx.workspaceId,
        name: (workspaceData as { name?: string })?.name ?? "Workspace",
        boardCount: boards.length,
        totalTasks: tasksMap.size,
        boards,
      },
    };
  } catch (error) {
    logger.error("getWorkspaceOverview failed", { error });
    return { success: false, error: "Failed to get workspace overview" };
  }
}
