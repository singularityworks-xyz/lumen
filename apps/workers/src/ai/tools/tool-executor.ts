import type {
  BulkDeleteTasksParams,
  BulkUpdateTasksParams,
  CreateBoardParams,
  CreateColumnParams,
  CreateTaskParams,
  DeleteBoardParams,
  DeleteTaskParams,
  GetBoardDetailsParams,
  GetTaskDetailsParams,
  GetWorkspaceOverviewParams,
  MoveTaskParams,
  SearchTasksParams,
  UpdateBoardParams,
  UpdateTaskParams,
} from "@lumen/ai/tools";
import { requiresConfirmation } from "@lumen/ai/tools";
import { createLogger } from "@lumen/logger";
import {
  type Board,
  type Column,
  type Task,
  YJS_MAP_NAMES,
} from "@lumen/yjs-shared";
import { roomManager } from "../../collab/room-manager";

const logger = createLogger({ name: "ai:tool-executor" });

export type ToolExecutionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
};

type ExecutorContext = {
  workspaceId: string;
  userId: string;
};

// Helper to get room doc safely
async function getWorkspaceDoc(workspaceId: string) {
  let room = roomManager.getRoom(workspaceId);
  if (!room) {
    room = roomManager.getOrCreateRoom(workspaceId);
    try {
      await roomManager.loadRoomState(workspaceId);
    } catch (error) {
      logger.error("Failed to load room state", { workspaceId, error });
      return null;
    }
  }
  return room.doc;
}

// Query tool executors
async function executeGetWorkspaceOverview(
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

async function executeGetBoardDetails(
  params: GetBoardDetailsParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const columns = board.column_ids
      ?.map((colId) => {
        const col = columnsMap.get(colId) as Column | undefined;
        if (!col) {
          return null;
        }

        const tasks = col.task_ids
          ?.map((taskId) => {
            const task = tasksMap.get(taskId) as Task | undefined;
            return task
              ? {
                  id: taskId,
                  title: task.title,
                  priority: task.priority,
                  status: task.status,
                  dueDate: task.due_date,
                }
              : null;
          })
          .filter(Boolean);

        return {
          id: colId,
          name: col.name,
          taskCount: tasks?.length ?? 0,
          tasks,
        };
      })
      .filter(Boolean);

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

async function executeGetTaskDetails(
  params: GetTaskDetailsParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const column = columnsMap.get(task.column_id) as Column | undefined;
    const board = boardsMap.get(task.board_id) as Board | undefined;

    return {
      success: true,
      data: {
        id: params.taskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        dueDate: task.due_date,
        tags: task.tags,
        column: column ? { id: task.column_id, name: column.name } : null,
        board: board ? { id: task.board_id, name: board.name } : null,
        createdAt: task.created_at,
      },
    };
  } catch (error) {
    logger.error("getTaskDetails failed", { error });
    return { success: false, error: "Failed to get task details" };
  }
}

async function executeSearchTasks(
  params: SearchTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);

    const query = params.query.toLowerCase();
    const results: Array<{
      id: string;
      title: string;
      priority: string;
      status: string;
      columnName: string;
      boardName: string;
    }> = [];

    tasksMap.forEach((taskData, taskId) => {
      const task = taskData as Task;

      // Filter by board if specified
      if (params.boardId && task.board_id !== params.boardId) {
        return;
      }

      // Filter by priority if specified
      if (params.priority && task.priority !== params.priority) {
        return;
      }

      // Filter by status if specified
      if (params.status && task.status !== params.status) {
        return;
      }

      // Search in title and description
      const matchesQuery =
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query);

      if (matchesQuery && results.length < (params.limit ?? 20)) {
        const column = columnsMap.get(task.column_id) as Column | undefined;
        const board = boardsMap.get(task.board_id) as Board | undefined;

        results.push({
          id: taskId,
          title: task.title,
          priority: task.priority,
          status: task.status,
          columnName: column?.name ?? "Unknown",
          boardName: board?.name ?? "Unknown",
        });
      }
    });

    return {
      success: true,
      data: {
        query: params.query,
        count: results.length,
        tasks: results,
      },
    };
  } catch (error) {
    logger.error("searchTasks failed", { error });
    return { success: false, error: "Failed to search tasks" };
  }
}

function mapPriority(priority?: string): "low" | "medium" | "high" {
  if (!priority) {
    return "medium";
  }
  if (priority === "urgent") {
    return "high";
  }
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}

// Action tool executors - these modify Yjs state
async function executeCreateTask(
  params: CreateTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    // Get target column
    let columnId = params.columnId;
    if (!columnId) {
      columnId = board.column_ids?.[0];
    }
    if (!columnId) {
      return { success: false, error: "Board has no columns" };
    }

    const column = columnsMap.get(columnId) as Column | undefined;
    if (!column) {
      return { success: false, error: "Column not found" };
    }

    // Create task
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newTask: Task = {
      id: taskId,
      board_id: params.boardId,
      column_id: columnId,
      title: params.title,
      description: params.description,
      priority: mapPriority(params.priority),
      progress: 0,
      position: column.task_ids?.length ?? 0,
      due_date: params.dueDate,
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
      status: "todo",
    };

    // Update Yjs state
    doc.transact(() => {
      tasksMap.set(taskId, newTask);

      // Add task to column's task_ids
      const updatedColumn: Column = {
        ...column,
        task_ids: [...(column.task_ids ?? []), taskId],
      };
      columnsMap.set(columnId, updatedColumn);
    });

    logger.info("Task created via AI", {
      taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        taskId,
        title: params.title,
        message: `Created task "${params.title}"`,
      },
    };
  } catch (error) {
    logger.error("createTask failed", { error });
    return { success: false, error: "Failed to create task" };
  }
}

async function executeUpdateTask(
  params: UpdateTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const task = tasksMap.get(params.taskId) as Task | undefined;

    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const updatedTask: Task = {
      ...task,
      ...(params.updates.title !== undefined && {
        title: params.updates.title,
      }),
      ...(params.updates.description !== undefined && {
        description: params.updates.description,
      }),
      ...(params.updates.priority !== undefined && {
        priority: mapPriority(params.updates.priority),
      }),
      ...(params.updates.dueDate !== undefined && {
        due_date: params.updates.dueDate ?? undefined,
      }),
      updated_at: new Date().toISOString(),
    };

    tasksMap.set(params.taskId, updatedTask);

    logger.info("Task updated via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        taskId: params.taskId,
        message: `Updated task "${updatedTask.title}"`,
      },
    };
  } catch (error) {
    logger.error("updateTask failed", { error });
    return { success: false, error: "Failed to update task" };
  }
}

async function executeDeleteTask(
  params: DeleteTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const column = columnsMap.get(task.column_id) as Column | undefined;

    doc.transact(() => {
      tasksMap.delete(params.taskId);

      // Remove from column's task_ids
      if (column) {
        const updatedColumn: Column = {
          ...column,
          task_ids: column.task_ids?.filter((id) => id !== params.taskId) ?? [],
        };
        columnsMap.set(task.column_id, updatedColumn);
      }
    });

    logger.info("Task deleted via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { taskId: params.taskId, message: `Deleted task "${task.title}"` },
    };
  } catch (error) {
    logger.error("deleteTask failed", { error });
    return { success: false, error: "Failed to delete task" };
  }
}

async function executeMoveTask(
  params: MoveTaskParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const task = tasksMap.get(params.taskId) as Task | undefined;
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const targetColumnId = params.columnId ?? task.column_id;
    const targetColumn = columnsMap.get(targetColumnId) as Column | undefined;
    if (!targetColumn) {
      return { success: false, error: "Target column not found" };
    }

    const sourceColumn = columnsMap.get(task.column_id) as Column | undefined;

    doc.transact(() => {
      // Update task
      const updatedTask: Task = {
        ...task,
        column_id: targetColumnId,
        board_id: targetColumn.board_id,
        position: params.position ?? targetColumn.task_ids?.length ?? 0,
        updated_at: new Date().toISOString(),
      };
      tasksMap.set(params.taskId, updatedTask);

      // Remove from source column
      if (sourceColumn && task.column_id !== targetColumnId) {
        const updatedSourceColumn: Column = {
          ...sourceColumn,
          task_ids:
            sourceColumn.task_ids?.filter((id) => id !== params.taskId) ?? [],
        };
        columnsMap.set(task.column_id, updatedSourceColumn);
      }

      // Add to target column
      if (task.column_id !== targetColumnId) {
        const updatedTargetColumn: Column = {
          ...targetColumn,
          task_ids: [...(targetColumn.task_ids ?? []), params.taskId],
        };
        columnsMap.set(targetColumnId, updatedTargetColumn);
      }
    });

    logger.info("Task moved via AI", {
      taskId: params.taskId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { taskId: params.taskId, message: `Moved task "${task.title}"` },
    };
  } catch (error) {
    logger.error("moveTask failed", { error });
    return { success: false, error: "Failed to move task" };
  }
}

async function executeCreateBoard(
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

async function executeUpdateBoard(
  params: UpdateBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const board = boardsMap.get(params.boardId) as Board | undefined;

    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const updatedBoard: Board = {
      ...board,
      ...(params.updates.name !== undefined && { name: params.updates.name }),
      ...(params.updates.description !== undefined && {
        description: params.updates.description,
      }),
    };

    boardsMap.set(params.boardId, updatedBoard);

    logger.info("Board updated via AI", {
      boardId: params.boardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        boardId: params.boardId,
        message: `Updated board "${updatedBoard.name}"`,
      },
    };
  } catch (error) {
    logger.error("updateBoard failed", { error });
    return { success: false, error: "Failed to update board" };
  }
}

async function executeDeleteBoard(
  params: DeleteBoardParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const boardPositionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
    const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    doc.transact(() => {
      // Delete all tasks in board's columns
      for (const colId of board.column_ids ?? []) {
        const col = columnsMap.get(colId) as Column | undefined;
        if (col) {
          for (const taskId of col.task_ids ?? []) {
            tasksMap.delete(taskId);
          }
          columnsMap.delete(colId);
        }
      }

      // Delete board
      boardsMap.delete(params.boardId);
      boardPositionsMap.delete(params.boardId);

      // Update workspace board_ids
      const wsData = workspaceMap.get("data") as
        | { board_ids?: string[] }
        | undefined;
      if (wsData) {
        workspaceMap.set("data", {
          ...wsData,
          board_ids:
            wsData.board_ids?.filter((id) => id !== params.boardId) ?? [],
        });
      }
    });

    logger.info("Board deleted via AI", {
      boardId: params.boardId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        boardId: params.boardId,
        message: `Deleted board "${board.name}"`,
      },
    };
  } catch (error) {
    logger.error("deleteBoard failed", { error });
    return { success: false, error: "Failed to delete board" };
  }
}

async function executeCreateColumn(
  params: CreateColumnParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);

    const board = boardsMap.get(params.boardId) as Board | undefined;
    if (!board) {
      return { success: false, error: "Board not found" };
    }

    const columnId = `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    doc.transact(() => {
      const column: Column = {
        id: columnId,
        board_id: params.boardId,
        name: params.name,
        position: params.position ?? board.column_ids?.length ?? 0,
        task_ids: [],
      };
      columnsMap.set(columnId, column);
      const updatedBoard: Board = {
        ...board,
        column_ids: [...(board.column_ids ?? []), columnId],
      };
      boardsMap.set(params.boardId, updatedBoard);
    });

    logger.info("Column created via AI", {
      columnId,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: {
        columnId,
        name: params.name,
        message: `Created column "${params.name}"`,
      },
    };
  } catch (error) {
    logger.error("createColumn failed", { error });
    return { success: false, error: "Failed to create column" };
  }
}

async function executeBulkUpdateTasks(
  params: BulkUpdateTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    let updatedCount = 0;

    doc.transact(() => {
      for (const taskId of params.taskIds) {
        const task = tasksMap.get(taskId) as Task | undefined;
        if (task) {
          const updatedTask: Task = {
            ...task,
            ...(params.updates.priority !== undefined && {
              priority: mapPriority(params.updates.priority),
            }),
            ...(params.updates.dueDate !== undefined && {
              due_date: params.updates.dueDate ?? undefined,
            }),
            updated_at: new Date().toISOString(),
          };
          tasksMap.set(taskId, updatedTask);
          updatedCount += 1;
        }
      }
    });

    logger.info("Bulk update via AI", {
      count: updatedCount,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { updatedCount, message: `Updated ${updatedCount} tasks` },
    };
  } catch (error) {
    logger.error("bulkUpdateTasks failed", { error });
    return { success: false, error: "Failed to bulk update tasks" };
  }
}

async function executeBulkDeleteTasks(
  params: BulkDeleteTasksParams,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  try {
    const doc = await getWorkspaceDoc(ctx.workspaceId);
    if (!doc) {
      return { success: false, error: "Workspace not loaded" };
    }

    const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    let deletedCount = 0;

    doc.transact(() => {
      for (const taskId of params.taskIds) {
        const task = tasksMap.get(taskId) as Task | undefined;
        if (task) {
          tasksMap.delete(taskId);

          // Remove from column
          const column = columnsMap.get(task.column_id) as Column | undefined;
          if (column) {
            columnsMap.set(task.column_id, {
              ...column,
              task_ids: column.task_ids?.filter((id) => id !== taskId) ?? [],
            });
          }
          deletedCount += 1;
        }
      }
    });

    logger.info("Bulk delete via AI", {
      count: deletedCount,
      workspaceId: ctx.workspaceId,
    });

    return {
      success: true,
      data: { deletedCount, message: `Deleted ${deletedCount} tasks` },
    };
  } catch (error) {
    logger.error("bulkDeleteTasks failed", { error });
    return { success: false, error: "Failed to bulk delete tasks" };
  }
}

// Main executor function
export function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  // Check if confirmation is required
  if (requiresConfirmation(toolName)) {
    return Promise.resolve({
      success: false,
      requiresConfirmation: true,
      data: { toolName, args },
      error: `Action "${toolName}" requires confirmation`,
    });
  }

  return executeToolDirect(toolName, args, ctx);
}

// Execute without confirmation check (for confirmed actions)
// biome-ignore lint/suspicious/useAwait: sugarcoating is required here
export async function executeToolDirect(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    // Query tools
    case "getWorkspaceOverview":
      return executeGetWorkspaceOverview(
        args as GetWorkspaceOverviewParams,
        ctx
      );
    case "getBoardDetails":
      return executeGetBoardDetails(args as GetBoardDetailsParams, ctx);
    case "getTaskDetails":
      return executeGetTaskDetails(args as GetTaskDetailsParams, ctx);
    case "searchTasks":
      return executeSearchTasks(args as SearchTasksParams, ctx);

    // Action tools
    case "createTask":
      return executeCreateTask(args as CreateTaskParams, ctx);
    case "updateTask":
      return executeUpdateTask(args as UpdateTaskParams, ctx);
    case "deleteTask":
      return executeDeleteTask(args as DeleteTaskParams, ctx);
    case "moveTask":
      return executeMoveTask(args as MoveTaskParams, ctx);
    case "createBoard":
      return executeCreateBoard(args as CreateBoardParams, ctx);
    case "updateBoard":
      return executeUpdateBoard(args as UpdateBoardParams, ctx);
    case "deleteBoard":
      return executeDeleteBoard(args as DeleteBoardParams, ctx);
    case "createColumn":
      return executeCreateColumn(args as CreateColumnParams, ctx);
    case "bulkUpdateTasks":
      return executeBulkUpdateTasks(args as BulkUpdateTasksParams, ctx);
    case "bulkDeleteTasks":
      return executeBulkDeleteTasks(args as BulkDeleteTasksParams, ctx);

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
