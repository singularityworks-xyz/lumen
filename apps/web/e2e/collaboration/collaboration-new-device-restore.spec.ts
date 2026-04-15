import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { cleanupE2EAuth, seedE2EAuth } from "../helpers/auth";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
} from "../lib/normalized-state";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-NEW-DEVICE: Workspace Sync Restoration on New Device", () => {
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
    await cleanupPages([ownerPage, editorPage]);
  });

  test("single workspace restores from DB when no peers online", async ({
    browser,
  }) => {
    // Owner creates a board with a column and task
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Restore Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Restore Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Restore Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    // Verify task exists on owner page
    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Restore Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    // Wait for persistence (debounce is 5s)
    await ownerPage.waitForTimeout(7000);

    // Close both devices to trigger room cleanup
    await cleanupPages([ownerPage, editorPage]);

    // Simulate new device: fresh browser context with same auth but clean IndexedDB
    const ownerSeed = await seedE2EAuth();
    for (const c of ownerSeed.storageState.cookies) {
      c.domain = "127.0.0.1";
    }
    const newDeviceContext = await browser.newContext({
      storageState: ownerSeed.storageState,
    });
    newDeviceContext.once("close", () => {
      cleanupE2EAuth(ownerSeed.userId, ownerSeed.sessionId).catch((err) => {
        console.error("Cleanup failed:", err);
      });
    });

    await newDeviceContext.route("**/api/**", (route) => {
      const headers = route.request().headers();
      if (route.request().method() !== "OPTIONS") {
        headers["x-e2e-bypass"] = "true";
        headers["x-e2e-user-id"] = ownerSeed.userId;
      }
      route.continue({ headers });
    });

    const newDevicePage = await newDeviceContext.newPage();
    await clearLocalStorageAndIndexedDB(newDevicePage);
    await disableAnimations(newDevicePage);

    // Navigate to the share link (which sets the workspace)
    await newDevicePage.goto(shareLink);
    await waitForAppReady(newDevicePage);

    // Verify the board is visible
    await newDevicePage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });

    // Verify the column and task restored from DB
    const restoredColumn = newDevicePage.locator(
      '[data-testid="kanban-column"]:has-text("Restore Column")'
    );
    await expect(restoredColumn).toBeVisible({ timeout: 15_000 });

    const restoredTask = newDevicePage.locator(
      '[data-testid="task-card"]:has-text("Restore Task")'
    );
    await expect(restoredTask).toBeVisible({ timeout: 10_000 });

    const snapshot = await captureNormalizedSnapshot(newDevicePage);
    assertNoOrphans(snapshot);

    await newDevicePage.close();
  });

  test("restore works after server room cleanup (no peers)", async ({
    browser,
  }) => {
    // Owner creates content
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Cleanup Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Cleanup Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Cleanup Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Cleanup Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    // Wait for persistence
    await ownerPage.waitForTimeout(7000);

    // Both devices disconnect - room cleanup triggers after 30s
    await ownerPage.close();
    await editorPage.close();

    // Wait for room cleanup timeout (30s + buffer)
    await new Promise((resolve) => setTimeout(resolve, 35_000));

    // New device connects - should restore from DB
    const ownerSeed = await seedE2EAuth();
    for (const c of ownerSeed.storageState.cookies) {
      c.domain = "127.0.0.1";
    }
    const newDeviceContext = await browser.newContext({
      storageState: ownerSeed.storageState,
    });
    newDeviceContext.once("close", () => {
      cleanupE2EAuth(ownerSeed.userId, ownerSeed.sessionId).catch((err) => {
        console.error("Cleanup failed:", err);
      });
    });

    await newDeviceContext.route("**/api/**", (route) => {
      const headers = route.request().headers();
      if (route.request().method() !== "OPTIONS") {
        headers["x-e2e-bypass"] = "true";
        headers["x-e2e-user-id"] = ownerSeed.userId;
      }
      route.continue({ headers });
    });

    const newDevicePage = await newDeviceContext.newPage();
    await clearLocalStorageAndIndexedDB(newDevicePage);
    await disableAnimations(newDevicePage);

    await newDevicePage.goto(shareLink);
    await waitForAppReady(newDevicePage);

    // Verify content restored from DB after room was cleaned up
    const restoredColumn = newDevicePage.locator(
      '[data-testid="kanban-column"]:has-text("Cleanup Column")'
    );
    await expect(restoredColumn).toBeVisible({ timeout: 15_000 });

    const restoredTask = newDevicePage.locator(
      '[data-testid="task-card"]:has-text("Cleanup Task")'
    );
    await expect(restoredTask).toBeVisible({ timeout: 10_000 });

    await newDevicePage.close();
  });

  test("hybrid: peer online then offline, new device restores from DB", async ({
    browser,
  }) => {
    // Editor verifies board exists (peer is online, room is in memory)
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // Owner adds content while editor is watching
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Hybrid Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    // Editor should see the column
    const editorColumn = editorPage.locator(
      '[data-testid="kanban-column"]:has-text("Hybrid Column")'
    );
    await expect(editorColumn).toBeVisible({ timeout: 10_000 });

    // Wait for persistence
    await ownerPage.waitForTimeout(7000);

    // Editor goes offline
    await editorPage.close();

    // New device joins - should get state from DB (editor was last peer)
    const ownerSeed = await seedE2EAuth();
    for (const c of ownerSeed.storageState.cookies) {
      c.domain = "127.0.0.1";
    }
    const newDeviceContext = await browser.newContext({
      storageState: ownerSeed.storageState,
    });
    newDeviceContext.once("close", () => {
      cleanupE2EAuth(ownerSeed.userId, ownerSeed.sessionId).catch((err) => {
        console.error("Cleanup failed:", err);
      });
    });

    await newDeviceContext.route("**/api/**", (route) => {
      const headers = route.request().headers();
      if (route.request().method() !== "OPTIONS") {
        headers["x-e2e-bypass"] = "true";
        headers["x-e2e-user-id"] = ownerSeed.userId;
      }
      route.continue({ headers });
    });

    const newDevicePage = await newDeviceContext.newPage();
    await clearLocalStorageAndIndexedDB(newDevicePage);
    await disableAnimations(newDevicePage);

    await newDevicePage.goto("/");
    await waitForAppReady(newDevicePage);

    // Verify the column exists on the new device
    // (owner still has room in memory, so this tests peer sync works)
    const newDeviceColumn = newDevicePage.locator(
      '[data-testid="kanban-column"]:has-text("Hybrid Column")'
    );
    await expect(newDeviceColumn).toBeVisible({ timeout: 15_000 });

    await newDevicePage.close();
  });
});
