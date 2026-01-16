import type { GetWorkspaceOverviewParams } from "@lumen/ai/tools";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  logger,
  type ToolExecutionResult,
} from "./shared";

export function executeGetWorkspaceOverview(
  _params: GetWorkspaceOverviewParams,
  ctx: ExecutorContext
): ToolExecutionResult {
  try {
    const snapshot = getWorkspaceFromSnapshot(ctx);

    if (!snapshot) {
      return {
        success: false,
        error: "Workspace data not available. Please refresh and try again.",
      };
    }

    const boards = snapshot.boards.map((board) => {
      const columnCount = board.columns.length;
      const taskCount = board.columns.reduce(
        (acc, col) => acc + col.tasks.length,
        0
      );

      return {
        id: board.id,
        name: board.name,
        columnCount,
        taskCount,
      };
    });

    const totalTasks = boards.reduce((acc, b) => acc + b.taskCount, 0);

    return {
      success: true,
      data: {
        workspaceId: ctx.workspaceId,
        name: snapshot.name,
        boardCount: boards.length,
        totalTasks,
        boards,
      },
    };
  } catch (error) {
    logger.error("getWorkspaceOverview failed", { error });
    return { success: false, error: "Failed to get workspace overview" };
  }
}
