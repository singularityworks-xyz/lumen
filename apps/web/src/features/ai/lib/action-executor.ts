// Client-side action executor for local workspaces.
// Executes action instructions returned from the AI server.
// This is used when the server can't execute actions via Yjs (local workspaces).

import type { ActionInstruction } from "@lumen/ai/tools";
import { createLogger } from "@lumen/logger";
import type { KanbanStore } from "../../kanban/store/types";

const logger = createLogger({ name: "[client] ai/action-executor" });

// Execute an action instruction against the kanban store.
// Returns a description of what was done.
export function executeActionInstruction(
  store: KanbanStore,
  instruction: ActionInstruction
): string {
  logger.info({ type: instruction.type }, "Executing action instruction");

  switch (instruction.type) {
    case "createTask":
      return executeCreateTask(store, instruction);
    case "updateTask":
      return executeUpdateTask(store, instruction);
    case "deleteTask":
      return executeDeleteTask(store, instruction);
    case "moveTask":
      return executeMoveTask(store, instruction);
    case "createBoard":
      return executeCreateBoard(store, instruction);
    case "updateBoard":
      return executeUpdateBoard(store, instruction);
    case "deleteBoard":
      return executeDeleteBoard(store, instruction);
    case "createColumn":
      return executeCreateColumn(store, instruction);
    case "bulkUpdateTasks":
      return executeBulkUpdateTasks(store, instruction);
    case "bulkDeleteTasks":
      return executeBulkDeleteTasks(store, instruction);
    default: {
      const unknownInstruction = instruction as { type: string };
      logger.warn(
        { type: unknownInstruction.type },
        "Unknown action instruction type"
      );
      return `Unknown action type: ${unknownInstruction.type}`;
    }
  }
}

function executeCreateTask(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "createTask" }
): string {
  const { boardId, columnId, title, description, priority, dueDate } =
    instruction;

  // Find the first column if no columnId specified
  const board = store.boards.byId[boardId];
  if (!board) {
    logger.warn({ boardId }, "Board not found for createTask");
    return "Failed to create task: board not found";
  }

  const targetColumnId = columnId ?? board.column_ids[0];
  if (!targetColumnId) {
    logger.warn({ boardId }, "No columns in board for createTask");
    return "Failed to create task: no columns in board";
  }

  const taskId = store.addTask(targetColumnId, boardId, title, {
    description,
    priority,
    due_date: dueDate,
  });

  logger.info({ taskId, title }, "Created task via AI action");
  return `Created task "${title}"`;
}

function executeUpdateTask(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "updateTask" }
): string {
  const { taskId, updates } = instruction;

  const task = store.tasks.byId[taskId];
  if (!task) {
    logger.warn({ taskId }, "Task not found for updateTask");
    return "Failed to update task: task not found";
  }

  store.updateTask(taskId, {
    title: updates.title,
    description: updates.description,
    priority: updates.priority,
    due_date: updates.dueDate === null ? undefined : updates.dueDate,
  });

  logger.info({ taskId }, "Updated task via AI action");
  return `Updated task "${task.title}"`;
}

function executeDeleteTask(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "deleteTask" }
): string {
  const { taskId } = instruction;

  const task = store.tasks.byId[taskId];
  if (!task) {
    logger.warn({ taskId }, "Task not found for deleteTask");
    return "Failed to delete task: task not found";
  }

  const title = task.title;
  store.deleteTask(taskId);

  logger.info({ taskId, title }, "Deleted task via AI action");
  return `Deleted task "${title}"`;
}

function executeMoveTask(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "moveTask" }
): string {
  const { taskId, columnId, boardId } = instruction;

  const task = store.tasks.byId[taskId];
  if (!task) {
    logger.warn({ taskId }, "Task not found for moveTask");
    return "Failed to move task: task not found";
  }

  const targetBoardId = boardId ?? task.board_id;
  const targetColumnId =
    columnId ?? store.boards.byId[targetBoardId]?.column_ids[0];

  if (!targetColumnId) {
    logger.warn({ targetBoardId }, "Target column not found for moveTask");
    return "Failed to move task: target column not found";
  }

  store.moveTask(taskId, task.column_id, targetColumnId, targetBoardId);

  logger.info({ taskId, targetColumnId, targetBoardId }, "Moved task via AI");
  return `Moved task "${task.title}"`;
}

function executeCreateBoard(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "createBoard" }
): string {
  const { name, description, position } = instruction;

  const boardId = store.addBoard(name, position, description);

  logger.info({ boardId, name }, "Created board via AI action");
  return `Created board "${name}"`;
}

function executeUpdateBoard(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "updateBoard" }
): string {
  const { boardId, updates } = instruction;

  const board = store.boards.byId[boardId];
  if (!board) {
    logger.warn({ boardId }, "Board not found for updateBoard");
    return "Failed to update board: board not found";
  }

  store.updateBoard(boardId, {
    name: updates.name,
    description: updates.description,
  });

  logger.info({ boardId }, "Updated board via AI action");
  return `Updated board "${board.name}"`;
}

function executeDeleteBoard(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "deleteBoard" }
): string {
  const { boardId } = instruction;

  const board = store.boards.byId[boardId];
  if (!board) {
    logger.warn({ boardId }, "Board not found for deleteBoard");
    return "Failed to delete board: board not found";
  }

  const name = board.name;
  store.removeBoard(boardId);

  logger.info({ boardId, name }, "Deleted board via AI action");
  return `Deleted board "${name}"`;
}

function executeCreateColumn(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "createColumn" }
): string {
  const { boardId, name, position } = instruction;

  const board = store.boards.byId[boardId];
  if (!board) {
    logger.warn({ boardId }, "Board not found for createColumn");
    return "Failed to create column: board not found";
  }

  const columnId = store.addColumn(boardId, name, position);

  logger.info({ columnId, name, boardId }, "Created column via AI action");
  return `Created column "${name}" in board "${board.name}"`;
}

function executeBulkUpdateTasks(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "bulkUpdateTasks" }
): string {
  const { taskIds, updates } = instruction;

  // Filter to only existing tasks
  const existingTaskIds = taskIds.filter((id) => store.tasks.byId[id]);
  if (existingTaskIds.length === 0) {
    logger.warn({ taskIds }, "No valid tasks found for bulkUpdateTasks");
    return "Failed to update tasks: no valid tasks found";
  }

  store.bulkUpdateTasks(existingTaskIds, {
    priority: updates.priority,
    due_date: updates.dueDate === null ? undefined : updates.dueDate,
    column_id: updates.columnId,
  });

  logger.info(
    { count: existingTaskIds.length },
    "Bulk updated tasks via AI action"
  );
  return `Updated ${existingTaskIds.length} tasks`;
}

function executeBulkDeleteTasks(
  store: KanbanStore,
  instruction: ActionInstruction & { type: "bulkDeleteTasks" }
): string {
  const { taskIds } = instruction;

  // Filter to only existing tasks
  const existingTaskIds = taskIds.filter((id) => store.tasks.byId[id]);
  if (existingTaskIds.length === 0) {
    logger.warn({ taskIds }, "No valid tasks found for bulkDeleteTasks");
    return "Failed to delete tasks: no valid tasks found";
  }

  store.bulkDeleteTasks(existingTaskIds);

  logger.info(
    { count: existingTaskIds.length },
    "Bulk deleted tasks via AI action"
  );
  return `Deleted ${existingTaskIds.length} tasks`;
}
