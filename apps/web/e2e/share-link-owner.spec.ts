import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-09: Share Link (Owner)", () => {
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

  test("owner can create share link", async ({ page }) => {
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
    const shareDialog = page.locator('[data-testid="share-dialog"]');
    await expect(shareDialog).toBeVisible();

    const createLinkButton = page.locator(
      '[data-testid="create-share-link-button"]'
    );
    await createLinkButton.click();

    await page.waitForSelector('[data-testid="share-link-input"]', {
      timeout: 5000,
    });
    const shareLinkInput = page.locator('[data-testid="share-link-input"]');
    const shareLink = await shareLinkInput.inputValue();
    expect(shareLink).toContain("share=");
  });

  test("shared workspace switches to collaborative mode", async ({ page }) => {
    const shareLink = await createShareLinkForFirstBoard(page);

    await page.goto(shareLink);
    await waitForAppReady(page);

    const syncStatus = page.locator('[data-testid="sync-status-indicator"]');
    await expect(syncStatus).toBeVisible();
  });

  test("shared workspace fetches server state", async ({ page, context }) => {
    const shareLink = await createShareLinkForFirstBoard(page);

    const guestPage = await context.newPage();
    await guestPage.goto(shareLink);
    await waitForAppReady(guestPage);

    const boardsInGuestPage = guestPage.locator('[data-testid="board-node"]');
    await boardsInGuestPage
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    await expect(boardsInGuestPage.first()).toBeVisible({ timeout: 10_000 });

    await guestPage.close();
  });
});
