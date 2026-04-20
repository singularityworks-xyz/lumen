import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
} from "../helpers/store";
import { waitForCollabSync, waitForConnectionState } from "../helpers/waits";

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

test.describe("E2E-11: Collaboration Live Sync", () => {
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

    await addColumnToFirstBoardViaStore(ownerPage, "Live Column");
    await waitForCollabSync(ownerPage, "kanban-column", "Live Column", 20_000);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForColumnInStore(editorPage, "Live Column", 40_000);

    const liveColumn = editorPage
      .locator('[data-testid="kanban-column"]:has-text("Live Column")')
      .first();
    await expect(liveColumn).toBeVisible({ timeout: 20_000 });
    await expect(liveColumn).toBeVisible();
  });

  test("task edits appear in second browser context", async () => {
    test.setTimeout(90_000);

    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Task Sync Column");
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

    const syncedTaskColumn = editorPage
      .locator('[data-testid="kanban-column"]:has-text("Task Sync Column")')
      .first();
    await expect(syncedTaskColumn).toBeVisible({ timeout: 20_000 });

    await addTaskViaStore(ownerPage, "Task Sync Column", "Live Task");
    await waitForCollabSync(ownerPage, "task-card", "Live Task", 20_000);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await waitForTaskInStore(editorPage, "Live Task", 40_000);

    const liveTask = editorPage
      .locator('[data-testid="task-card"]:has-text("Live Task")')
      .first();

    await expect(syncedTaskColumn).toContainText("Live Task", {
      timeout: 45_000,
    });

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

    const cursorIndicator = editorPage.locator('[data-testid="peer-cursor"]');
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
    await waitForCollabSync(editorPage, "kanban-column", "Modal Sync Column");

    await addTaskViaStore(ownerPage, "Modal Sync Column", "Modal Sync Task");
    await waitForCollabSync(ownerPage, "task-card", "Modal Sync Task", 20_000);

    const taskCard = await waitForCollabSync(
      ownerPage,
      "task-card",
      "Modal Sync Task",
      30_000
    );
    const editorTaskCard = await waitForCollabSync(
      editorPage,
      "task-card",
      "Modal Sync Task"
    );

    await taskCard.click();
    await expect(
      ownerPage.locator('[data-testid="task-detail-modal"]')
    ).toBeVisible({
      timeout: 10_000,
    });

    await editorTaskCard.click();
    const editorModal = editorPage.locator('[data-testid="task-detail-modal"]');
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
