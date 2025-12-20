import { createLogger } from "@lumen/logger";
import type { Task } from "../../types";
import { generateTaskId } from "../ids";
import type { KanbanStore } from "../types";

const logger = createLogger({ name: "[client] kanban/task" });

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addTask"
  | "updateTask"
  | "deleteTask"
  | "moveTask"
  | "bulkUpdateTasks"
  | "bulkDeleteTasks"
  | "setDraggedTask"
  | "openTaskQuickActions"
  | "closeTaskQuickActions"
  | "updateTaskQuickActionsPosition"
>;

export const createTaskSlice: SliceCreator = (set, _get) => ({
  addTask: (columnId, boardId, title, options = {}) => {
    const taskId = generateTaskId();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      board_id: boardId,
      column_id: columnId,
      title,
      description: options.description,
      priority: options.priority ?? "medium",
      progress: options.progress ?? 0,
      position: 0,
      due_date: options.due_date,
      created_by: "current-user",
      created_at: now,
      updated_at: now,
      tags: options.tags,
      status: "todo",
    };

    set((state) => {
      state.tasks.byId[taskId] = task;
      state.tasks.allIds.push(taskId);

      const column = state.columns.byId[columnId];
      if (column) {
        task.position = column.task_ids.length;
        column.task_ids.push(taskId);
      }

      const board = state.boards.byId[boardId];
      if (board) {
        const workspace = state.workspaces.byId[board.workspace_id];
        if (workspace) {
          workspace.lastFocusedBoardId = boardId;
        }
      }
    });

    logger.info({ id: taskId, title, columnId, boardId }, "Task created");
    return taskId;
  },

  updateTask: (taskId, updates) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      if (task) {
        Object.assign(task, {
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }
    }),

  deleteTask: (taskId) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      if (!task) {
        logger.warn({ id: taskId }, "Task not found");
        return;
      }

      logger.info(
        { id: taskId, title: task.title, columnId: task.column_id },
        "Task deleted"
      );

      const column = state.columns.byId[task.column_id];
      if (column) {
        column.task_ids = column.task_ids.filter((id) => id !== taskId);
      }

      delete state.tasks.byId[taskId];
      state.tasks.allIds = state.tasks.allIds.filter((id) => id !== taskId);
      state.selectedTaskIds = state.selectedTaskIds.filter(
        (id) => id !== taskId
      );
    }),

  moveTask: (taskId, fromColumnId, toColumnId, targetBoardId) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      const fromColumn = state.columns.byId[fromColumnId];
      const toColumn = state.columns.byId[toColumnId];

      if (!(task && fromColumn && toColumn)) {
        logger.warn(
          { taskId, fromColumnId, toColumnId },
          "Move task failed - missing entities"
        );
        return;
      }
      fromColumn.task_ids = fromColumn.task_ids.filter((id) => id !== taskId);
      task.column_id = toColumnId;
      task.board_id = targetBoardId;
      task.position = toColumn.task_ids.length;
      task.updated_at = new Date().toISOString();
      toColumn.task_ids.push(taskId);
    }),

  bulkUpdateTasks: (taskIds, updates) =>
    set((state) => {
      const now = new Date().toISOString();
      for (const taskId of taskIds) {
        const task = state.tasks.byId[taskId];
        if (task) {
          Object.assign(task, {
            ...updates,
            updated_at: now,
          });
        }
      }
    }),

  bulkDeleteTasks: (taskIds) =>
    set((state) => {
      logger.info({ count: taskIds.length, ids: taskIds }, "Bulk delete tasks");
      for (const taskId of taskIds) {
        const task = state.tasks.byId[taskId];
        if (task) {
          const column = state.columns.byId[task.column_id];
          if (column) {
            column.task_ids = column.task_ids.filter((id) => id !== taskId);
          }
          delete state.tasks.byId[taskId];
        }
      }
      state.tasks.allIds = state.tasks.allIds.filter(
        (id) => !taskIds.includes(id)
      );
      state.selectedTaskIds = state.selectedTaskIds.filter(
        (id) => !taskIds.includes(id)
      );
    }),

  setDraggedTask: (taskId) =>
    set((state) => {
      state.draggedTaskId = taskId;
    }),

  openTaskQuickActions: (taskId, boardId, columnId, position) =>
    set((state) => {
      state.taskQuickActions[taskId] = { taskId, boardId, columnId, position };
    }),

  closeTaskQuickActions: (taskId) =>
    set((state) => {
      delete state.taskQuickActions[taskId];
    }),

  updateTaskQuickActionsPosition: (taskId, position) =>
    set((state) => {
      const quickActions = state.taskQuickActions[taskId];
      if (quickActions) {
        quickActions.position = position;
      }
    }),
});
