import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

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
    const shareLink = await createShareLinkForFirstBoard(page);

    const editorPage = await context.newPage();
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    const boards = editorPage.locator('[data-testid="board-node"]');
    await boards.first().waitFor({ state: "visible", timeout: 10_000 });
    await expect(boards.first()).toBeVisible({ timeout: 10_000 });

    const boardNames = await boards.allTextContents();
    expect(boardNames.length).toBeGreaterThan(0);

    await editorPage.close();
  });

  test("duplicate join is idempotent", async ({ page, context }) => {
    const shareLink = await createShareLinkForFirstBoard(page);

    const editorPage1 = await context.newPage();
    await editorPage1.goto(shareLink);
    await waitForAppReady(editorPage1);

    const boards1 = await editorPage1
      .locator('[data-testid="board-node"]')
      .count();

    await editorPage1.goto(shareLink);
    await waitForAppReady(editorPage1);

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
    const shareLink = await createShareLinkForFirstBoard(page);

    const editorPage = await context.newPage();
    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Owner Added Board");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(1000);

    const ownerBoard = editorPage.locator(
      '[data-testid="board-node"]:has-text("Owner Added Board")'
    );
    await ownerBoard.waitFor({ state: "visible", timeout: 10_000 });
    await expect(ownerBoard).toBeVisible({ timeout: 10_000 });

    await editorPage.close();
  });
});
