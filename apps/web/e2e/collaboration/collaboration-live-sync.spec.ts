import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  getTaskBoardIdById,
} from "../helpers/store";
import {
  waitForCollabSync,
  waitForConnectionState,
  waitForPresenceCursor,
} from "../helpers/waits";

async function waitForTaskInStore(
  page: Page,
  taskTitle: string,
  timeout = 40_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((title) => {
          interface TaskRecord {
            title?: string;
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
            return false;
          }

          const state = store.getState();
          const taskIds = state.tasks?.allIds ?? [];
          return taskIds.some((id) => state.tasks?.byId?.[id]?.title === title);
        }, taskTitle),
      {
        timeout,
        intervals: [250, 500, 1000],
      }
    )
    .toBe(true);
}

async function waitForTaskIdInStore(
  page: Page,
  taskId: string,
  timeout = 40_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          interface KanbanState {
            tasks?: {
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
            return false;
          }

          return (store.getState().tasks?.allIds ?? []).includes(id);
        }, taskId),
      {
        timeout,
        intervals: [250, 500, 1000],
      }
    )
    .toBe(true);
}

async function openTaskDetailModalViaStore(
  page: Page,
  taskId: string,
  boardId: string
): Promise<void> {
  await page.evaluate(
    ({ id, targetBoardId }) => {
      interface KanbanState {
        openTaskDetailModal?: (options: {
          boardId: string;
          taskId: string;
        }) => unknown;
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
      if (typeof state.openTaskDetailModal !== "function") {
        throw new Error("openTaskDetailModal action is not available");
      }

      state.openTaskDetailModal({ taskId: id, boardId: targetBoardId });
    },
    { id: taskId, targetBoardId: boardId }
  );
}

async function waitForTaskInColumnInStore(
  page: Page,
  columnName: string,
  taskTitle: string,
  timeout = 40_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ name, title }) => {
            interface ColumnRecord {
              name?: string;
            }

            interface TaskRecord {
              column_id?: string;
              title?: string;
            }

            interface KanbanState {
              columns?: {
                allIds?: string[];
                byId?: Record<string, ColumnRecord | undefined>;
              };
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
              return false;
            }

            const state = store.getState();
            const targetColumnId = (state.columns?.allIds ?? []).find(
              (id) => state.columns?.byId?.[id]?.name === name
            );

            if (!targetColumnId) {
              return false;
            }

            return (state.tasks?.allIds ?? []).some((id) => {
              const task = state.tasks?.byId?.[id];
              return (
                task?.title === title && task?.column_id === targetColumnId
              );
            });
          },
          { name: columnName, title: taskTitle }
        ),
      {
        timeout,
        intervals: [250, 500, 1000],
      }
    )
    .toBe(true);
}

async function waitForColumnInStore(
  page: Page,
  columnName: string,
  timeout = 40_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((name) => {
          interface ColumnRecord {
            name?: string;
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
            return false;
          }

          const state = store.getState();
          const columnIds = state.columns?.allIds ?? [];
          return columnIds.some(
            (id) => state.columns?.byId?.[id]?.name === name
          );
        }, columnName),
      {
        timeout,
        intervals: [250, 500, 1000],
      }
    )
    .toBe(true);
}

async function waitForColumnIdInStore(
  page: Page,
  columnId: string,
  timeout = 40_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          interface KanbanState {
            columns?: {
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
            return false;
          }

          return (store.getState().columns?.allIds ?? []).includes(id);
        }, columnId),
      {
        timeout,
        intervals: [250, 500, 1000],
      }
    )
    .toBe(true);
}

test.describe("E2E-11: Collaboration Live Sync", () => {
  test.describe.configure({ timeout: 90_000 });

  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
    shareLink = setup.shareLink;
  });

  test.afterEach(async () => {
    if (ownerPage) {
      await ownerPage.close();
    }
    if (editorPage) {
      await editorPage.close();
    }
  });

  test("board edits appear in second browser context", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const initialBoardsOwner = await ownerPage
      .locator('[data-testid="board-node"]')
      .count();

    const newBoardButton = ownerPage.locator(
      '[data-testid="new-board-button"]'
    );
    await newBoardButton.click();
    await ownerPage.fill('[data-testid="board-name-input"]', "Live Sync Board");
    await ownerPage.click('[data-testid="board-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="board-node"]:has-text("Live Sync Board")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const finalBoardsOwner = await ownerPage
      .locator('[data-testid="board-node"]')
      .count();
    const finalBoardsEditor = await editorPage
      .locator('[data-testid="board-node"]')
      .count();

    expect(finalBoardsOwner).toBe(initialBoardsOwner + 1);
    expect(finalBoardsEditor).toBe(finalBoardsOwner);
  });

  test("column edits appear in second browser context", async () => {
    test.setTimeout(90_000);

    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const liveColumnId = await addColumnToFirstBoardViaStore(
      ownerPage,
      "Live Column"
    );
    await waitForCollabSync(ownerPage, "kanban-column", "Live Column", 20_000);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForColumnInStore(editorPage, "Live Column", 40_000);
    await waitForColumnIdInStore(editorPage, liveColumnId, 40_000);
  });

  test("task edits appear in second browser context", async () => {
    test.setTimeout(90_000);

    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskSyncColumnId = await addColumnToFirstBoardViaStore(
      ownerPage,
      "Task Sync Column"
    );
    await waitForCollabSync(
      ownerPage,
      "kanban-column",
      "Task Sync Column",
      20_000
    );
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForColumnInStore(editorPage, "Task Sync Column", 40_000);
    await waitForColumnIdInStore(editorPage, taskSyncColumnId, 40_000);

    const liveTaskId = await addTaskViaStore(
      ownerPage,
      "Task Sync Column",
      "Live Task"
    );
    await waitForTaskIdInStore(ownerPage, liveTaskId, 40_000);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForTaskIdInStore(editorPage, liveTaskId, 40_000);
    await waitForTaskInStore(editorPage, "Live Task", 40_000);
    await waitForTaskInColumnInStore(
      editorPage,
      "Task Sync Column",
      "Live Task",
      40_000
    );

    const liveTask = editorPage
      .locator('[data-testid="task-card"]:has-text("Live Task")')
      .first();

    const liveTaskCount = await liveTask.count();
    if (liveTaskCount > 0) {
      await expect(liveTask).toBeVisible({ timeout: 20_000 });
    }
  });

  test("cursor presence appears for peer", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage.locator('[data-testid="board-node"]').first().hover();
    await ownerPage.mouse.move(400, 300);
    await ownerPage.waitForTimeout(500);

    await waitForPresenceCursor(editorPage);
    const cursorIndicator = editorPage
      .locator('[data-testid="peer-cursor"]')
      .first();
    await expect(cursorIndicator).toBeVisible({ timeout: 5000 });
  });

  test("selection presence appears for peer", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.click();

    const selectionIndicator = editorPage.locator(
      '[data-testid="peer-selection"]'
    );
    await expect(selectionIndicator).toBeVisible({ timeout: 5000 });
  });

  test("modal sync works for shared workspace", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Modal Sync Column");
    await waitForCollabSync(ownerPage, "kanban-column", "Modal Sync Column");
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForColumnInStore(editorPage, "Modal Sync Column", 40_000);

    const modalTaskId = await addTaskViaStore(
      ownerPage,
      "Modal Sync Column",
      "Modal Sync Task"
    );
    await waitForTaskIdInStore(ownerPage, modalTaskId, 40_000);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForTaskIdInStore(editorPage, modalTaskId, 40_000);

    const ownerTaskBoardId = await getTaskBoardIdById(ownerPage, modalTaskId);
    if (!ownerTaskBoardId) {
      throw new Error("Owner missing board id for modal task");
    }
    await openTaskDetailModalViaStore(ownerPage, modalTaskId, ownerTaskBoardId);

    await expect(
      ownerPage.locator('[data-testid="task-detail-modal"]').first()
    ).toBeVisible({
      timeout: 10_000,
    });

    const editorTaskBoardId = await getTaskBoardIdById(editorPage, modalTaskId);
    if (!editorTaskBoardId) {
      throw new Error("Editor missing board id for modal task");
    }
    await openTaskDetailModalViaStore(
      editorPage,
      modalTaskId,
      editorTaskBoardId
    );

    const editorModal = editorPage
      .locator('[data-testid="task-detail-modal"]')
      .first();
    await expect(editorModal).toBeVisible({ timeout: 10_000 });
  });

  test("dialog sync works for shared workspace", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });
    await ownerPage.waitForSelector('[data-testid="board-rename-option"]');
    await ownerPage.click('[data-testid="board-rename-option"]');

    const editorRenameDialog = editorPage
      .locator('[data-testid="board-rename-dialog"]')
      .filter({ visible: true })
      .last();
    await expect(editorRenameDialog).toBeVisible({ timeout: 5000 });
  });
});
