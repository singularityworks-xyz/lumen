import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  setCurrentWorkspaceFromStore,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import { waitForConnectionState } from "../helpers/waits";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

async function addColumnToFirstBoardViaStore(
  page: Page,
  columnName: string
): Promise<void> {
  await page.evaluate((name) => {
    interface BoardRecord {
      column_ids?: string[];
    }

    interface KanbanState {
      addColumn: (boardId: string, columnName: string, index: number) => void;
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

    state.addColumn(firstBoardId, name, index);
  }, columnName);
}

async function addTaskViaStore(
  page: Page,
  columnName: string,
  taskTitle: string
): Promise<void> {
  await page.evaluate(
    ({ targetColumnName, title }) => {
      interface ColumnRecord {
        board_id: string;
        id: string;
        name: string;
      }

      interface KanbanState {
        addTask: (columnId: string, boardId: string, taskTitle: string) => void;
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

      state.addTask(columnId, column.board_id, title);
    },
    { targetColumnName: columnName, title: taskTitle }
  );
}

async function deleteTaskByIdViaStore(
  page: Page,
  taskId: string
): Promise<void> {
  await page.evaluate((id) => {
    interface KanbanState {
      deleteTask: (taskId: string) => void;
      tasks?: {
        byId?: Record<string, unknown>;
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
    if (!state.tasks?.byId?.[id]) {
      throw new Error(`Task not found by id: ${id}`);
    }

    state.deleteTask(id);
  }, taskId);
}

function getTaskTitleById(page: Page, taskId: string): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      title: string;
    }

    interface ColumnRecord {
      task_ids?: string[];
    }

    interface KanbanState {
      columns?: {
        byId?: Record<string, ColumnRecord | undefined>;
      };
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
    const task = state.tasks?.byId?.[id];
    if (!task) {
      return null;
    }

    const isActiveInAnyColumn = Object.values(state.columns?.byId ?? {}).some(
      (column) =>
        Array.isArray(column?.task_ids) && column.task_ids.includes(id)
    );

    return isActiveInAnyColumn ? task.title : null;
  }, taskId);
}

async function updateTaskStatusByIdViaStore(
  page: Page,
  taskId: string,
  status: "todo" | "done" | "trash"
): Promise<void> {
  await page.evaluate(
    ({ id, nextStatus }) => {
      interface KanbanState {
        tasks?: {
          byId?: Record<string, unknown>;
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
      if (!state.tasks?.byId?.[id]) {
        throw new Error(`Task not found by id: ${id}`);
      }

      state.updateTask(id, { status: nextStatus });
    },
    { id: taskId, nextStatus: status }
  );
}

function getTaskIdByTitle(page: Page, title: string): Promise<string> {
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

async function updateTaskTitleByIdViaStore(
  page: Page,
  taskId: string,
  nextTitle: string
): Promise<void> {
  await page.evaluate(
    ({ id, updatedTitle }) => {
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
      state.updateTask(id, { title: updatedTitle });
    },
    { id: taskId, updatedTitle: nextTitle }
  );
}

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

function getCurrentWorkspaceIdViaStore(page: Page): Promise<string | null> {
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

async function ensureAlignedWorkspaceContext(
  ownerPage: Page,
  editorPage: Page
): Promise<string | null> {
  const ownerWorkspaceId = await getCurrentWorkspaceIdViaStore(ownerPage);
  if (!ownerWorkspaceId) {
    return null;
  }

  await setCurrentWorkspaceFromStore(ownerPage, ownerWorkspaceId);
  await setCurrentWorkspaceFromStore(editorPage, ownerWorkspaceId);

  await expect
    .poll(
      async () => {
        const ownerCurrent = await getCurrentWorkspaceIdViaStore(ownerPage);
        const editorCurrent = await getCurrentWorkspaceIdViaStore(editorPage);
        return (
          ownerCurrent === ownerWorkspaceId &&
          editorCurrent === ownerWorkspaceId
        );
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  return ownerWorkspaceId;
}

test.describe("E2E-20: Conflict - Offline Edit vs Remote Delete", () => {
  test.describe.configure({ timeout: 90_000 });

  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("user A goes offline, edits task, user B deletes task, user A comes online", async () => {
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      15_000
    );
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      15_000
    );
    const alignedWorkspaceId = await ensureAlignedWorkspaceContext(
      ownerPage,
      editorPage
    );

    await addColumnToFirstBoardViaStore(ownerPage, "Offline Delete Column");
    await addTaskViaStore(
      ownerPage,
      "Offline Delete Column",
      "Offline Delete Task"
    );

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Offline Delete Task")')
      .waitFor({ state: "visible", timeout: 10_000 });
    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Delete Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(editorPage, "Offline Delete Task");
    await editorPage.context().setOffline(true);
    await editorPage.waitForFunction(() => navigator.onLine === false, {
      timeout: 10_000,
    });
    await editorPage.waitForTimeout(1000);

    await updateTaskTitleByIdViaStore(
      editorPage,
      taskId,
      "Edited while offline - will be deleted"
    );

    await deleteTaskByIdViaStore(ownerPage, taskId);

    await editorPage.context().setOffline(false);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      30_000
    );
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      30_000
    );
    await editorPage.waitForFunction(() => navigator.onLine === true, {
      timeout: 10_000,
    });
    await Promise.all([ownerPage.reload(), editorPage.reload()]);
    await waitForAppReady(ownerPage);
    await waitForAppReady(editorPage);
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      30_000
    );
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      30_000
    );
    const reloadedAlignedWorkspaceId =
      alignedWorkspaceId ??
      (await ensureAlignedWorkspaceContext(ownerPage, editorPage));

    await expect
      .poll(
        async () => {
          if (reloadedAlignedWorkspaceId) {
            await setCurrentWorkspaceFromStore(
              ownerPage,
              reloadedAlignedWorkspaceId
            );
            await setCurrentWorkspaceFromStore(
              editorPage,
              reloadedAlignedWorkspaceId
            );
          }

          const ownerTitle = await getTaskTitleById(ownerPage, taskId);
          const editorTitle = await getTaskTitleById(editorPage, taskId);
          if (ownerTitle === null && editorTitle === null) {
            return true;
          }

          if (
            ownerTitle === "Edited while offline - will be deleted" &&
            editorTitle === "Edited while offline - will be deleted"
          ) {
            return true;
          }

          if (ownerTitle !== editorTitle) {
            return false;
          }

          return false;
        },
        {
          timeout: 60_000,
        }
      )
      .toBe(true);
  });

  test("offline edit syncs successfully when no conflict exists", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Offline Sync Column");
    await addTaskViaStore(
      ownerPage,
      "Offline Sync Column",
      "Offline Sync Task"
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Sync Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.context().setOffline(true);

    const taskId = await getTaskIdByTitle(editorPage, "Offline Sync Task");
    await updateTaskTitleByIdViaStore(
      editorPage,
      taskId,
      "Successfully edited offline"
    );

    await editorPage.context().setOffline(false);

    await expect
      .poll(async () => {
        const ownerTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTitle = await getTaskTitleById(editorPage, taskId);
        return (
          ownerTitle === "Successfully edited offline" &&
          editorTitle === "Successfully edited offline"
        );
      })
      .toBe(true);
  });

  test("offline title edit while another user changes task status", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Checklist Status Column");
    await addTaskViaStore(
      ownerPage,
      "Checklist Status Column",
      "Checklist Status Task"
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Checklist Status Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(editorPage, "Checklist Status Task");

    await editorPage.context().setOffline(true);

    await updateTaskTitleByIdViaStore(
      editorPage,
      taskId,
      "Checklist Status Task Offline Edit"
    );

    await updateTaskStatusByIdViaStore(ownerPage, taskId, "done");

    await editorPage.context().setOffline(false);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });
});
