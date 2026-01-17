import type { GetBoardDetailsParams } from "../schemas";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  type ToolExecutionResult,
} from "./types";

export function executeGetBoardDetails(
  params: GetBoardDetailsParams,
  ctx: ExecutorContext
): ToolExecutionResult {
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
}
