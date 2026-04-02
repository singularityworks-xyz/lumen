import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "./helpers/commands";

const DISCONNECTED_REGEX = /disconnected|offline/i;
const CONNECTED_REGEX = /connected|synced|online/i;

test.describe("E2E-17: Reconnect and Recovery", () => {
  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    if (ownerPage) {
      await ownerPage.close();
    }
    if (editorPage) {
      await editorPage.close();
    }
  });

  test("reconnect after websocket close recovers state", async () => {
    const addColumnTrigger = ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Pre-Disconnect");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Pre-Disconnect")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await editorPage.waitForTimeout(1000);

    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "During-Disconnect"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await editorPage.waitForTimeout(3000);

    await editorPage.reload();
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const columns = await editorPage
      .locator('[data-testid="kanban-column"]')
      .count();
    expect(columns).toBeGreaterThanOrEqual(2);
  });

  test("sync status indicator shows disconnected state", async () => {
    const syncIndicator = editorPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toBeVisible({ timeout: 5000 });

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await editorPage.waitForTimeout(1000);

    await expect(syncIndicator).toContainText(DISCONNECTED_REGEX, {
      timeout: 5000,
    });

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await editorPage.waitForTimeout(3000);
  });

  test("state converges after reconnect with edits on both sides", async () => {
    const addColumnTrigger = ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Owner Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Owner Col")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await editorPage.waitForTimeout(1000);

    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Owner During Disconnect"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await editorPage.waitForTimeout(3000);

    await editorPage.reload();
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const ownerColumns = await ownerPage
      .locator('[data-testid="kanban-column"]')
      .count();
    const editorColumns = await editorPage
      .locator('[data-testid="kanban-column"]')
      .count();

    expect(ownerColumns).toBe(editorColumns);
  });

  test("cursor presence recovers after reconnect", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    await ownerPage.waitForTimeout(500);

    const cursorBefore = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorBefore).toBeVisible({ timeout: 5000 });

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await editorPage.waitForTimeout(1000);

    await editorPage.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await editorPage.waitForTimeout(3000);

    await ownerPage.mouse.move(500, 400);
    await ownerPage.waitForTimeout(500);

    const cursorAfter = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorAfter).toBeVisible({ timeout: 10_000 });
  });

  test("connection indicator reflects actual state", async () => {
    const syncIndicator = editorPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toBeVisible({ timeout: 5000 });

    const text = await syncIndicator.textContent();
    expect(text?.toLowerCase()).toMatch(CONNECTED_REGEX);
  });
});
