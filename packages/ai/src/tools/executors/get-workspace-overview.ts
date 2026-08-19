import type { GetWorkspaceOverviewParams } from "../schemas";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  type ToolExecutionResult,
} from "./types";

export function executeGetWorkspaceOverview(
  _params: GetWorkspaceOverviewParams,
  ctx: ExecutorContext
): ToolExecutionResult {
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

  const textBoards = (snapshot.textBoards ?? []).map((textBoard) => ({
    id: textBoard.id,
    name: textBoard.name,
  }));

  return {
    success: true,
    data: {
      workspaceId: ctx.workspaceId,
      name: snapshot.name,
      boardCount: boards.length,
      totalTasks,
      textBoardCount: textBoards.length,
      boards,
      textBoards,
    },
  };
}
