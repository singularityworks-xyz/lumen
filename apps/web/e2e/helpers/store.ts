import type { Page } from "@playwright/test";

type TaskStatus = "todo" | "done" | "trash";

export function getFirstBoardId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    interface KanbanState {
      boards?: {
        allIds?: string[];
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    const boardIds = store?.getState?.().boards?.allIds;
    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      return null;
    }

    const firstBoardId = boardIds[0];
    return typeof firstBoardId === "string" ? firstBoardId : null;
  });
}

export function addColumnToFirstBoardViaStore(
  page: Page,
  columnName: string
): Promise<string> {
  return page.evaluate((name) => {
    interface BoardRecord {
      column_ids?: string[];
    }

    interface KanbanState {
      addColumn: (boardId: string, columnName: string, index: number) => string;
      boards?: {
        allIds?: string[];
        byId?: Record<string, BoardRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    const boardIds = state.boards?.allIds;
    const firstBoardId = Array.isArray(boardIds) ? boardIds[0] : null;

    if (typeof firstBoardId !== "string") {
      throw new Error("No board found for addColumn operation");
    }

    const board = state.boards?.byId?.[firstBoardId];
    const index = Array.isArray(board?.column_ids)
      ? board.column_ids.length
      : 0;

    return state.addColumn(firstBoardId, name, index);
  }, columnName);
}

export function getColumnIdByName(
  page: Page,
  columnName: string
): Promise<string | null> {
  return page.evaluate((name) => {
    interface ColumnRecord {
      name: string;
    }

    interface KanbanState {
      columns?: {
        allIds?: string[];
        byId?: Record<string, ColumnRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    const columnId = (state.columns?.allIds ?? []).find((id) => {
      const column = state.columns?.byId?.[id];
      return column?.name === name;
    });

    return columnId ?? null;
  }, columnName);
}

export function addTaskViaStore(
  page: Page,
  columnName: string,
  taskTitle: string
): Promise<string> {
  return page.evaluate(
    ({ targetColumnName, title }) => {
      interface ColumnRecord {
        board_id: string;
        id: string;
        name: string;
      }

      interface KanbanState {
        addTask: (
          columnId: string,
          boardId: string,
          taskTitle: string
        ) => string;
        columns?: {
          allIds?: string[];
          byId?: Record<string, ColumnRecord | undefined>;
        };
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      const columnId = (state.columns?.allIds ?? []).find((id) => {
        const column = state.columns?.byId?.[id];
        return column?.name === targetColumnName;
      });

      if (!columnId) {
        throw new Error(`Column not found: ${targetColumnName}`);
      }

      const column = state.columns?.byId?.[columnId];
      if (!column) {
        throw new Error(`Column record missing: ${columnId}`);
      }

      return state.addTask(columnId, column.board_id, title);
    },
    { targetColumnName: columnName, title: taskTitle }
  );
}

export function getTaskIdByTitle(page: Page, title: string): Promise<string> {
  return page.evaluate((taskTitle) => {
    interface TaskRecord {
      id: string;
      title: string;
    }

    interface KanbanState {
      tasks?: {
        allIds?: string[];
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    const taskId = (state.tasks?.allIds ?? []).find((id) => {
      const task = state.tasks?.byId?.[id];
      return task?.title === taskTitle;
    });

    if (!taskId) {
      throw new Error(`Task not found: ${taskTitle}`);
    }

    return taskId;
  }, title);
}

export function getTaskTitleById(
  page: Page,
  taskId: string
): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      title: string;
    }

    interface KanbanState {
      tasks?: {
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.tasks?.byId?.[id]?.title ?? null;
  }, taskId);
}

export function getTaskDescriptionById(
  page: Page,
  taskId: string
): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      description?: string;
    }

    interface KanbanState {
      tasks?: {
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.tasks?.byId?.[id]?.description ?? null;
  }, taskId);
}

export function getTaskColumnIdById(
  page: Page,
  taskId: string
): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      column_id: string;
    }

    interface KanbanState {
      tasks?: {
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.tasks?.byId?.[id]?.column_id ?? null;
  }, taskId);
}

export function getTaskBoardIdById(
  page: Page,
  taskId: string
): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      board_id: string;
    }

    interface KanbanState {
      tasks?: {
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.tasks?.byId?.[id]?.board_id ?? null;
  }, taskId);
}

export function getCurrentWorkspaceIdViaStore(
  page: Page
): Promise<string | null> {
  return page.evaluate(() => {
    interface KanbanState {
      currentWorkspaceId?: string | null;
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    return store.getState().currentWorkspaceId ?? null;
  });
}

export function updateTaskTitleViaStore(
  page: Page,
  taskId: string,
  title: string
): Promise<void> {
  return page.evaluate(
    ({ id, nextTitle }) => {
      interface KanbanState {
        updateTask: (taskId: string, updates: { title: string }) => void;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      state.updateTask(id, { title: nextTitle });
    },
    { id: taskId, nextTitle: title }
  );
}

export function updateTaskDescriptionViaStore(
  page: Page,
  taskId: string,
  description: string
): Promise<void> {
  return page.evaluate(
    ({ id, nextDescription }) => {
      interface KanbanState {
        updateTask: (taskId: string, updates: { description: string }) => void;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      state.updateTask(id, { description: nextDescription });
    },
    { id: taskId, nextDescription: description }
  );
}

export function updateTaskStatusByTitleViaStore(
  page: Page,
  taskTitle: string,
  status: TaskStatus
): Promise<void> {
  return page.evaluate(
    ({ title, nextStatus }) => {
      interface TaskRecord {
        id: string;
        title: string;
      }

      interface KanbanState {
        tasks?: {
          allIds?: string[];
          byId?: Record<string, TaskRecord | undefined>;
        };
        updateTask: (
          taskId: string,
          updates: { status: "todo" | "done" | "trash" }
        ) => void;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      const taskId = (state.tasks?.allIds ?? []).find((id) => {
        const task = state.tasks?.byId?.[id];
        return task?.title === title;
      });

      if (!taskId) {
        throw new Error(`Task not found: ${title}`);
      }

      state.updateTask(taskId, { status: nextStatus });
    },
    { title: taskTitle, nextStatus: status }
  );
}

export function moveTaskToColumnViaStore(
  page: Page,
  taskId: string,
  targetColumnName: string
): Promise<void> {
  return page.evaluate(
    ({ id, targetName }) => {
      interface TaskRecord {
        board_id: string;
        column_id: string;
      }

      interface ColumnRecord {
        name: string;
      }

      interface KanbanState {
        columns?: {
          allIds?: string[];
          byId?: Record<string, ColumnRecord | undefined>;
        };
        moveTask: (
          taskId: string,
          fromColumnId: string,
          toColumnId: string,
          targetBoardId: string
        ) => void;
        tasks?: {
          byId?: Record<string, TaskRecord | undefined>;
        };
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      const task = state.tasks?.byId?.[id];
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const targetColumnId = (state.columns?.allIds ?? []).find((columnId) => {
        const column = state.columns?.byId?.[columnId];
        return column?.name === targetName;
      });

      if (!targetColumnId) {
        throw new Error(`Target column not found: ${targetName}`);
      }

      state.moveTask(id, task.column_id, targetColumnId, task.board_id);
    },
    { id: taskId, targetName: targetColumnName }
  );
}

export function deleteTaskByTitleViaStore(
  page: Page,
  taskTitle: string
): Promise<void> {
  return page.evaluate((title) => {
    interface TaskRecord {
      id: string;
      title: string;
    }

    interface KanbanState {
      deleteTask: (taskId: string) => void;
      tasks?: {
        allIds?: string[];
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    const taskId = (state.tasks?.allIds ?? []).find((id) => {
      const task = state.tasks?.byId?.[id];
      return task?.title === title;
    });

    if (!taskId) {
      throw new Error(`Task not found: ${title}`);
    }

    state.deleteTask(taskId);
  }, taskTitle);
}

export function removeBoardByIdViaStore(
  page: Page,
  boardId: string
): Promise<void> {
  return page.evaluate((id) => {
    interface KanbanState {
      removeBoard: (boardId: string) => void;
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    state.removeBoard(id);
  }, boardId);
}

export async function addCommentViaStore(
  page: Page,
  content: string,
  position: { x: number; y: number } = { x: 240, y: 180 }
): Promise<string> {
  await page.waitForFunction(() => {
    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState?: () => {
          addComment?: unknown;
          comments?: { allIds?: string[] };
          currentWorkspaceId?: string | null;
          workspaces?: { allIds?: string[] };
        };
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    const state = store?.getState?.();
    if (!state || typeof state.addComment !== "function") {
      return false;
    }

    if (state.currentWorkspaceId) {
      return true;
    }

    return (state.workspaces?.allIds?.length ?? 0) > 0;
  });

  return page.evaluate(
    ({ nextContent, nextPosition }) => {
      interface CommentRecord {
        content?: string;
        id: string;
      }

      interface KanbanState {
        addComment: (
          position: { x: number; y: number },
          content: string,
          author: { id: string; name?: string; image?: string }
        ) => void;
        comments?: {
          allIds?: string[];
          byId?: Record<string, CommentRecord | undefined>;
        };
        currentWorkspaceId?: string | null;
        setCurrentWorkspace?: (workspaceId: string | null) => void;
        workspaces?: {
          allIds?: string[];
        };
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      if (!state.currentWorkspaceId) {
        const firstWorkspaceId = state.workspaces?.allIds?.[0] ?? null;
        if (firstWorkspaceId && state.setCurrentWorkspace) {
          state.setCurrentWorkspace(firstWorkspaceId);
        }
      }

      const beforeIds = new Set(state.comments?.allIds ?? []);

      state.addComment(nextPosition, nextContent, {
        id: "e2e-user",
        name: "E2E User",
      });

      const afterState = store.getState();
      const afterIds = afterState.comments?.allIds ?? [];
      const addedId = afterIds.find((id) => !beforeIds.has(id));
      if (!addedId) {
        const fallbackId = [...afterIds].reverse().find((id) => {
          const comment = afterState.comments?.byId?.[id];
          return comment?.content === nextContent;
        });

        if (!fallbackId) {
          throw new Error("Failed to create comment");
        }

        return fallbackId;
      }

      return addedId;
    },
    { nextContent: content, nextPosition: position }
  );
}

export function getCommentIdByContent(
  page: Page,
  content: string
): Promise<string | null> {
  return page.evaluate((targetContent) => {
    interface CommentRecord {
      content: string;
    }

    interface KanbanState {
      comments?: {
        allIds?: string[];
        byId?: Record<string, CommentRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    const id = (state.comments?.allIds ?? []).find((commentId) => {
      const comment = state.comments?.byId?.[commentId];
      return comment?.content === targetContent;
    });

    return id ?? null;
  }, content);
}

export function getCommentContentById(
  page: Page,
  commentId: string
): Promise<string | null> {
  return page.evaluate((id) => {
    interface CommentRecord {
      content: string;
    }

    interface KanbanState {
      comments?: {
        byId?: Record<string, CommentRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.comments?.byId?.[id]?.content ?? null;
  }, commentId);
}

export function updateCommentContentViaStore(
  page: Page,
  commentId: string,
  content: string
): Promise<void> {
  return page.evaluate(
    ({ id, nextContent }) => {
      interface KanbanState {
        updateComment: (id: string, updates: { content: string }) => void;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      state.updateComment(id, { content: nextContent });
    },
    { id: commentId, nextContent: content }
  );
}

export function removeCommentByIdViaStore(
  page: Page,
  commentId: string
): Promise<void> {
  return page.evaluate((id) => {
    interface KanbanState {
      removeComment: (id: string) => void;
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    state.removeComment(id);
  }, commentId);
}
