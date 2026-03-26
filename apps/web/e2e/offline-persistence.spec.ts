import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-07: Offline Persistence", () => {
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

    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Offline Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    await page.context().setOffline(true);

    await page.reload();
    await waitForAppReady(page);

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
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Offline Edit Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Offline Edit Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Offline Task");
    await page.click('[data-testid="task-create-submit"]');
    await page.waitForTimeout(500);

    await page.context().setOffline(true);
    await page.reload();
    await waitForAppReady(page);

    const offlineTask = page.locator(
      '[data-testid="task-card"]:has-text("Offline Task")'
    );
    await expect(offlineTask).toBeVisible();

    await offlineTask.click();
    await page.waitForSelector('[data-testid="task-detail-modal"]');
    const editButton = page.locator('[data-testid="task-detail-edit-button"]');
    await editButton.click();
    await page.waitForSelector('[data-testid="task-detail-title-input"]');
    await page.fill(
      '[data-testid="task-detail-title-input"]',
      "Updated Offline Task"
    );
    await page.click('[data-testid="task-detail-save-button"]');
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
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const boardNode = page.locator(
      '[data-testid="board-node"]:has-text("IndexedDB Test Board")'
    );
    await expect(boardNode).toBeVisible();

    const storedState = await page.evaluate(() => {
      return new Promise<Record<string, unknown> | null>((resolve) => {
        const request = indexedDB.open("lumen-kanban-store");
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(["kanban"], "readonly");
          const store = transaction.objectStore("kanban");
          const getRequest = store.get("state");
          getRequest.onsuccess = () =>
            resolve(getRequest.result as Record<string, unknown> | null);
          getRequest.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      });
    });

    expect(storedState).not.toBeNull();
    expect(storedState).toHaveProperty("boards");
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
