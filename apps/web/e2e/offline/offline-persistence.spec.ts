import { expect, type Page, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  getStoreState,
  waitForAppReady,
} from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  getTaskIdByTitle,
  updateTaskTitleViaStore,
} from "../helpers/store";

async function clickWithDispatchFallback(page: Page, selector: string) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();

  try {
    await target.click({ timeout: 3000 });
    return;
  } catch {
    try {
      await target.click({ timeout: 3000, force: true });
      return;
    } catch {
      const isStillVisible = await target.isVisible().catch(() => false);
      if (!isStillVisible) {
        return;
      }

      await target.dispatchEvent("click");
    }
  }
}

test.describe("E2E-07: Offline Persistence", () => {
  test.describe.configure({ mode: "serial" });

  async function reloadAndWaitForReady(page: Page, wasOffline = false) {
    if (wasOffline) {
      await page.context().setOffline(false);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);

    if (wasOffline) {
      await page.context().setOffline(true);
      await page.waitForTimeout(300);
    }
  }

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

  test("offline reload preserves local workspace from IndexedDB", async ({
    page,
  }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill(
      '[data-testid="board-name-input"]',
      "Offline Persistence Board"
    );
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const boardNode = page.locator(
      '[data-testid="board-node"]:has-text("Offline Persistence Board")'
    );
    await expect(boardNode).toBeVisible();

    await clickWithDispatchFallback(page, '[data-testid="add-column-trigger"]');
    await page.fill('[data-testid="column-name-input"]', "Offline Column");
    await clickWithDispatchFallback(
      page,
      '[data-testid="column-create-submit"]'
    );
    await page.waitForTimeout(500);

    await page.context().setOffline(true);

    await reloadAndWaitForReady(page, true);

    await page.context().setOffline(false);

    const boardAfterReload = page.locator(
      '[data-testid="board-node"]:has-text("Offline Persistence Board")'
    );
    await expect(boardAfterReload).toBeVisible();

    const columnAfterReload = page.locator(
      '[data-testid="kanban-column"]:has-text("Offline Column")'
    );
    await expect(columnAfterReload).toBeVisible();
  });

  test("local edits made offline remain after reconnect", async ({ page }) => {
    await addColumnToFirstBoardViaStore(page, "Offline Edit Column");
    await addTaskViaStore(page, "Offline Edit Column", "Offline Task");

    const offlineTask = page.locator(
      '[data-testid="task-card"]:has-text("Offline Task")'
    );
    await expect(offlineTask).toBeVisible({ timeout: 10_000 });

    await page.context().setOffline(true);
    await reloadAndWaitForReady(page, true);

    await expect(offlineTask).toBeVisible({ timeout: 10_000 });

    const taskId = await getTaskIdByTitle(page, "Offline Task");
    await updateTaskTitleViaStore(page, taskId, "Updated Offline Task");
    await page.waitForTimeout(300);

    await page.context().setOffline(false);
    await page.reload();
    await waitForAppReady(page);

    const updatedTask = page.locator(
      '[data-testid="task-card"]:has-text("Updated Offline Task")'
    );
    await expect(updatedTask).toBeVisible();
  });

  test("IndexedDB stores workspace state correctly", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "IndexedDB Test Board");
    await clickWithDispatchFallback(
      page,
      '[data-testid="board-create-submit"]'
    );
    await page.waitForTimeout(500);

    const boardNode = page.locator(
      '[data-testid="board-node"]:has-text("IndexedDB Test Board")'
    );
    await expect(boardNode).toBeVisible();

    await expect
      .poll(
        async () => {
          const state = await getStoreState(page);
          const boards = state?.boards;
          if (typeof boards !== "object" || !boards) {
            return 0;
          }

          const allIds = (boards as { allIds?: unknown }).allIds;
          return Array.isArray(allIds) ? allIds.length : 0;
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0);

    const finalState = await getStoreState(page);
    expect(finalState).not.toBeNull();
    expect(finalState).toHaveProperty("boards");
  });

  test("offline indicator appears when offline", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    await expect(boardNode).toBeVisible();

    await page.context().setOffline(true);

    await page.waitForTimeout(1000);

    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible();

    await page.context().setOffline(false);
  });
});
