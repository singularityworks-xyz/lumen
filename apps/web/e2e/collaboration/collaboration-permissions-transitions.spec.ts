import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-16: Permission Transitions", () => {
  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const editorContext = await browser.newContext();

    ownerPage = await ownerContext.newPage();
    editorPage = await editorContext.newPage();

    await clearLocalStorageAndIndexedDB(ownerPage);
    await disableAnimations(ownerPage);
    await ownerPage.goto("/");
    await waitForAppReady(ownerPage);

    const createFirstBoardButton = ownerPage.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    if (await createFirstBoardButton.isVisible()) {
      await createFirstBoardButton.click();
      // Wait for board to be created and ready
      await ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
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

  test("editor joins as editor with write permissions", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const newBoardButton = editorPage.locator(
      '[data-testid="new-board-button"]'
    );
    await expect(newBoardButton).toBeEnabled({ timeout: 5000 });
  });

  test("owner can create share link with viewer permission", async () => {
    await ownerPage
      .locator('[data-testid="share-permission-select"]')
      .selectOption("viewer");
    await ownerPage.click('[data-testid="create-share-link-button"]');
    await ownerPage.waitForSelector('[data-testid="share-link-input"]');
    const viewerShareLink = await ownerPage
      .locator('[data-testid="share-link-input"]')
      .inputValue();

    await editorPage.goto(viewerShareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const newBoardButton = editorPage.locator(
      '[data-testid="new-board-button"]'
    );
    await expect(newBoardButton).toBeDisabled({ timeout: 5000 });
  });

  test("viewer cannot add columns or tasks", async () => {
    await ownerPage
      .locator('[data-testid="share-permission-select"]')
      .selectOption("viewer");
    await ownerPage.click('[data-testid="create-share-link-button"]');
    await ownerPage.waitForSelector('[data-testid="share-link-input"]');
    const viewerShareLink = await ownerPage
      .locator('[data-testid="share-link-input"]')
      .inputValue();

    await editorPage.goto(viewerShareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = editorPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await expect(addColumnTrigger).toBeDisabled({ timeout: 5000 });
  });

  test("sync indicator is visible after joining via share link", async () => {
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const syncIndicator = editorPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toBeVisible({ timeout: 5000 });
  });
});
