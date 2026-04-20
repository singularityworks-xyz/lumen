import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

interface ThreeUserSetup {
  editorPage: Page;
  ownerPage: Page;
  shareLink: string;
  viewerPage: Page;
}

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

async function updateTaskTitleViaStore(
  page: Page,
  taskId: string,
  title: string
): Promise<void> {
  await page.evaluate(
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

async function moveTaskToColumnViaStore(
  page: Page,
  taskId: string,
  targetColumnName: string
): Promise<void> {
  await page.evaluate(
    ({ id, targetName }) => {
      interface TaskRecord {
        board_id: string;
        column_id: string;
        id: string;
      }

      interface ColumnRecord {
        board_id: string;
        id: string;
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

function getTaskTitleById(page: Page, taskId: string): Promise<string | null> {
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

async function setupThreeUsers(browser: Browser): Promise<ThreeUserSetup> {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const viewerPage = await viewerContext.newPage();

  await clearLocalStorageAndIndexedDB(ownerPage);
  await disableAnimations(ownerPage);
  await ownerPage.goto("/");
  await waitForAppReady(ownerPage);

  const createFirstBoardButton = ownerPage.locator(
    '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
  );
  if (await createFirstBoardButton.isVisible()) {
    await createFirstBoardButton.click();
    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
  }

  await clearLocalStorageAndIndexedDB(editorPage);
  await disableAnimations(editorPage);
  await editorPage.goto("/");
  await waitForAppReady(editorPage);

  const shareLink = await createShareLinkForFirstBoard(ownerPage);
  await editorPage.goto(shareLink);
  await waitForAppReady(editorPage);

  await editorPage
    .locator('[data-testid="board-node"]')
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  await clearLocalStorageAndIndexedDB(viewerPage);
  await disableAnimations(viewerPage);
  await viewerPage.goto("/");
  await waitForAppReady(viewerPage);

  return { ownerPage, editorPage, viewerPage, shareLink };
}

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

async function joinShareAndWaitForBoard(
  page: Page,
  shareLink: string
): Promise<void> {
  await page.goto(shareLink);
  await waitForAppReady(page);

  try {
    await expect
      .poll(async () => page.locator('[data-testid="board-node"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect
      .poll(async () => page.locator('[data-testid="board-node"]').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
  }
}

test.describe("E2E-21: Late Join After Conflict-Heavy Session", () => {
  test.describe.configure({ timeout: 90_000 });

  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;
  let viewerPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupThreeUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
    shareLink = setup.shareLink;
    viewerPage = setup.viewerPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage, viewerPage]);
  });

  test("late joiner sees resolved state after conflicting task title edits", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Conflict Column");

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );
    await expect(column).toBeVisible({ timeout: 10_000 });
    await addTaskViaStore(ownerPage, "Conflict Column", "Original Title");

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Original Title")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Original Title");
    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Owner Final Title"),
      updateTaskTitleViaStore(editorPage, taskId, "Editor Final Title"),
    ]);

    await expect
      .poll(async () => {
        const ownerFinalTitle = await getTaskTitleById(ownerPage, taskId);
        const editorFinalTitle = await getTaskTitleById(editorPage, taskId);
        return ownerFinalTitle?.trim() === editorFinalTitle?.trim();
      })
      .toBe(true);

    const ownerFinalTitle = await getTaskTitleById(ownerPage, taskId);
    const editorFinalTitle = await getTaskTitleById(editorPage, taskId);

    expect(ownerFinalTitle).toBe(editorFinalTitle);
    expect(ownerFinalTitle).not.toBeNull();
    expect(ownerFinalTitle).not.toBe("Original Title");

    await joinShareAndWaitForBoard(viewerPage, shareLink);

    const viewerFinalTitle = await getTaskTitleById(viewerPage, taskId);
    expect(viewerFinalTitle).toBe(ownerFinalTitle);
    expect(viewerFinalTitle).toBe(editorFinalTitle);
  });

  test("late joiner sees resolved state after conflicting move and edit", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Source Column");
    await addColumnToFirstBoardViaStore(ownerPage, "Target Column");

    const sourceColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Source Column")'
    );
    await expect(sourceColumn).toBeVisible({ timeout: 10_000 });
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("Target Column")')
      .waitFor({ state: "visible", timeout: 10_000 });
    await addTaskViaStore(ownerPage, "Source Column", "Move Edit Task");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Move Edit Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Move Edit Task");
    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Owner Edited While Moving"),
      moveTaskToColumnViaStore(editorPage, taskId, "Target Column"),
    ]);

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
        return taskOrderResult.match;
      })
      .toBe(true);
    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);

    await joinShareAndWaitForBoard(viewerPage, shareLink);

    const viewerSnapshot = await captureNormalizedSnapshot(viewerPage);
    const viewerTaskOrderResult = compareTaskOrder(
      ownerSnapshot,
      viewerSnapshot
    );
    expect(viewerTaskOrderResult.match).toBe(true);

    assertNoOrphans(viewerSnapshot);
  });
});
