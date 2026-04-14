import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  deleteWorkspace,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

const DISCONNECTED_OR_OFFLINE_REGEX = /disconnected|offline/;

test.describe("E2E-12: Collaboration Permissions and Delete", () => {
  let ownerPage: Page;
  let viewerPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();

    ownerPage = await ownerContext.newPage();
    viewerPage = await viewerContext.newPage();

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

    await clearLocalStorageAndIndexedDB(viewerPage);
    await disableAnimations(viewerPage);
    await viewerPage.goto("/");
    await waitForAppReady(viewerPage);

    shareLink = await createShareLinkForFirstBoard(ownerPage);
    await ownerPage
      .locator('[data-testid="share-permission-select"]')
      .selectOption("viewer");
    await ownerPage.click('[data-testid="create-share-link-button"]');
    await ownerPage.waitForSelector('[data-testid="share-link-input"]');
    shareLink = await ownerPage
      .locator('[data-testid="share-link-input"]')
      .inputValue();
  });

  test.afterEach(async () => {
    if (ownerPage) {
      await ownerPage.close();
    }
    if (viewerPage) {
      await viewerPage.close();
    }
  });

  test("viewer cannot perform write actions through collaboration channel", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const newBoardButton = viewerPage.locator(
      '[data-testid="new-board-button"]'
    );
    await expect(newBoardButton).toBeDisabled({ timeout: 5000 });

    const boardNode = viewerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await expect(addColumnTrigger).toBeDisabled({ timeout: 5000 });

    const taskCard = viewerPage.locator('[data-testid="task-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click({ button: "right" });
      const deleteOption = viewerPage.locator(
        '[data-testid="task-delete-option"]'
      );
      await expect(deleteOption).toBeDisabled({ timeout: 3000 });
    }
  });

  test("workspace delete shows deleted banner to connected peer", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteWorkspace(ownerPage);

    const deletedBanner = viewerPage.locator(
      '[data-testid="deleted-workspace-banner"]'
    );
    await deletedBanner.waitFor({ state: "visible", timeout: 5000 });
    await expect(deletedBanner).toBeVisible();
  });

  test("connected peer disconnect behavior after workspace delete", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteWorkspace(ownerPage);

    const deletedBanner = viewerPage.locator(
      '[data-testid="deleted-workspace-banner"]'
    );
    await expect(deletedBanner).toBeVisible();

    const syncIndicator = viewerPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toContainText(DISCONNECTED_OR_OFFLINE_REGEX, {
      timeout: 5000,
    });
  });

  test("viewer can still view boards after peer deletes workspace", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardsBeforeDelete = await viewerPage
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsBeforeDelete).toBeGreaterThan(0);

    await deleteWorkspace(ownerPage);

    const deletedBanner = viewerPage.locator(
      '[data-testid="deleted-workspace-banner"]'
    );
    await expect(deletedBanner).toBeVisible();

    const boardsAfterDelete = await viewerPage
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsAfterDelete).toBe(boardsBeforeDelete);
  });

  test("save as local option appears for disconnected peer", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteWorkspace(ownerPage);

    const deletedBanner = viewerPage.locator(
      '[data-testid="deleted-workspace-banner"]'
    );
    await expect(deletedBanner).toBeVisible();

    const saveAsLocalButton = viewerPage.locator(
      '[data-testid="save-as-local-button"]'
    );
    await expect(saveAsLocalButton).toBeVisible({ timeout: 5000 });
  });
});
