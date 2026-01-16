import type { GetBoardDetailsParams } from "@lumen/ai/tools";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  logger,
  type ToolExecutionResult,
} from "./shared";

export function executeGetBoardDetails(
  params: GetBoardDetailsParams,
  ctx: ExecutorContext
): ToolExecutionResult {
  try {
    const workspace = getWorkspaceFromSnapshot(ctx);
    if (!workspace) {
      return { success: false, error: "Workspace data not available" };
    }

    const board = workspace.boards.find((b) => b.id === params.boardId);
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const columns = board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      taskCount: col.tasks.length,
      tasks: col.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
      })),
    }));

    return {
      success: true,
      data: {
        id: params.boardId,
        name: board.name,
        description: board.description,
        columns,
      },
    };
  } catch (error) {
    logger.error("getBoardDetails failed", { error });
    return { success: false, error: "Failed to get board details" };
  }
}
