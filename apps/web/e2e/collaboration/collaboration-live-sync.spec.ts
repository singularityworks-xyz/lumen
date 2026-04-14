import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-11: Collaboration Live Sync", () => {
  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    ownerPage = await context1.newPage();
    editorPage = await context2.newPage();

    await clearLocalStorageAndIndexedDB(ownerPage);
    await disableAnimations(ownerPage);
    await ownerPage.goto("/");
    await waitForAppReady(ownerPage);

    const createFirstBoardButton = ownerPage.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    if (await createFirstBoardButton.isVisible()) {
      await createFirstBoardButton.click();
      await ownerPage.waitForTimeout(500);
    }

    await clearLocalStorageAndIndexedDB(editorPage);
    await disableAnimations(editorPage);
    await editorPage.goto("/");
    await waitForAppReady(editorPage);

    shareLink = await createShareLinkForFirstBoard(ownerPage);
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
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Live Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    const liveColumn = editorPage.locator(
      '[data-testid="kanban-column"]:has-text("Live Column")'
    );
    await liveColumn.waitFor({ state: "visible", timeout: 10_000 });
    await expect(liveColumn).toBeVisible();
  });

  test("task edits appear in second browser context", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Task Sync Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Task Sync Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Live Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    const liveTask = editorPage.locator(
      '[data-testid="task-card"]:has-text("Live Task")'
    );
    await liveTask.waitFor({ state: "visible", timeout: 10_000 });
    await expect(liveTask).toBeVisible();
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

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Modal Sync Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Modal Sync Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Modal Sync Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Modal Sync Task")'
    );
    await taskCard.click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');

    const editorTaskCard = editorPage.locator(
      '[data-testid="task-card"]:has-text("Modal Sync Task")'
    );
    await editorTaskCard.click();
    const editorModal = editorPage.locator('[data-testid="task-detail-modal"]');
    await expect(editorModal).toBeVisible({ timeout: 5000 });
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

    const editorRenameDialog = editorPage.locator(
      '[data-testid="board-rename-dialog"]'
    );
    await expect(editorRenameDialog).toBeVisible({ timeout: 5000 });
  });
});
