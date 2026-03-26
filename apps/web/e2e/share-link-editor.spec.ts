import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-10: Share Link (Editor)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorageAndIndexedDB(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForAppReady(page);

    const createFirstBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    if (await createFirstBoardButton.isVisible()) {
      await createFirstBoardButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("editor can join share and receives seeded board state", async ({
    page,
    context,
  }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="workspace-option"]', {
      timeout: 5000,
    });

    const boardNode = page.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });

    await page.waitForSelector('[data-testid="board-share-option"]');
    await page.click('[data-testid="board-share-option"]');

    await page.waitForSelector('[data-testid="share-dialog"]');
    const createLinkButton = page.locator(
      '[data-testid="create-share-link-button"]'
    );
    await createLinkButton.click();

    await page.waitForSelector('[data-testid="share-link-input"]');
    const shareLink = await page
      .locator('[data-testid="share-link-input"]')
      .inputValue();

    const editorPage = await context.newPage();
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage.waitForTimeout(2000);

    const boards = editorPage.locator('[data-testid="board-node"]');
    await expect(boards.first()).toBeVisible({ timeout: 10_000 });

    const boardNames = await boards.allTextContents();
    expect(boardNames.length).toBeGreaterThan(0);

    await editorPage.close();
  });

  test("duplicate join is idempotent", async ({ page, context }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="workspace-option"]', {
      timeout: 5000,
    });

    const boardNode = page.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });

    await page.waitForSelector('[data-testid="board-share-option"]');
    await page.click('[data-testid="board-share-option"]');

    await page.waitForSelector('[data-testid="share-dialog"]');
    const createLinkButton = page.locator(
      '[data-testid="create-share-link-button"]'
    );
    await createLinkButton.click();

    await page.waitForSelector('[data-testid="share-link-input"]');
    const shareLink = await page
      .locator('[data-testid="share-link-input"]')
      .inputValue();

    const editorPage1 = await context.newPage();
    await editorPage1.goto(shareLink);
    await waitForAppReady(editorPage1);
    await editorPage1.waitForTimeout(2000);

    const boards1 = await editorPage1
      .locator('[data-testid="board-node"]')
      .count();

    await editorPage1.goto(shareLink);
    await waitForAppReady(editorPage1);
    await editorPage1.waitForTimeout(2000);

    const boardsAfterDuplicate = await editorPage1
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsAfterDuplicate).toBe(boards1);

    await editorPage1.close();
  });

  test("editor receives correct board state after owner edits", async ({
    page,
    context,
  }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="workspace-option"]', {
      timeout: 5000,
    });

    const boardNode = page.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });

    await page.waitForSelector('[data-testid="board-share-option"]');
    await page.click('[data-testid="board-share-option"]');

    await page.waitForSelector('[data-testid="share-dialog"]');
    const createLinkButton = page.locator(
      '[data-testid="create-share-link-button"]'
    );
    await createLinkButton.click();

    await page.waitForSelector('[data-testid="share-link-input"]');
    const shareLink = await page
      .locator('[data-testid="share-link-input"]')
      .inputValue();

    const editorPage = await context.newPage();
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);
    await editorPage.waitForTimeout(2000);

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Owner Added Board");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(1000);

    await editorPage.waitForTimeout(2000);

    const ownerBoard = editorPage.locator(
      '[data-testid="board-node"]:has-text("Owner Added Board")'
    );
    await expect(ownerBoard).toBeVisible({ timeout: 10_000 });

    await editorPage.close();
  });
});
