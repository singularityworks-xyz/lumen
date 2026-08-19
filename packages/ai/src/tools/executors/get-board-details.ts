import type { GetBoardDetailsParams } from "../schemas";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  type ToolExecutionResult,
} from "./types";

const TASK_LINE_REGEX = /^-\s+\[[ xX]\]/;
const COMPLETED_TASK_REGEX = /^-\s+\[x\]/i;

export function executeGetBoardDetails(
  params: GetBoardDetailsParams,
  ctx: ExecutorContext
): ToolExecutionResult {
  const workspace = getWorkspaceFromSnapshot(ctx);
  if (!workspace) {
    return { success: false, error: "Workspace data not available" };
  }

  const board = workspace.boards.find((b) => b.id === params.boardId);
  if (board) {
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
        type: "kanban",
        columns,
      },
    };
  }

  // Text boards are included in the snapshot as plain text (rendered from
  // the TipTap document) so Larity can answer questions about todo items.
  const textBoard = workspace.textBoards?.find(
    (tb) => tb.id === params.boardId
  );
  if (textBoard) {
    const taskLines = (textBoard.text ?? "")
      .split("\n")
      .filter((line) => TASK_LINE_REGEX.test(line));
    const completedTasks = taskLines.filter((line) =>
      COMPLETED_TASK_REGEX.test(line)
    ).length;

    return {
      success: true,
      data: {
        id: textBoard.id,
        name: textBoard.name,
        description: textBoard.description,
        type: "textBoard",
        taskCount: taskLines.length,
        completedTasks,
        content: textBoard.text ?? "",
        createdAt: textBoard.createdAt,
        updatedAt: textBoard.updatedAt,
      },
    };
  }

  return { success: false, error: "Board not found" };
}
