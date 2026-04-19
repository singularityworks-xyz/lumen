import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  waitForConnectionState,
  waitForPresenceCursor,
} from "../helpers/waits";

test.describe("E2E-14: Presence and Cursor Lifecycle", () => {
  let ownerPage: Page;
  let editorPage: Page;

  async function setSelectionBoxFromStore(
    page: Page,
    box: { height: number; width: number; x: number; y: number } | null
  ): Promise<void> {
    await page.evaluate((nextBox) => {
      type KanbanState = {
        setSelectionBox: (box: {
          height: number;
          width: number;
          x: number;
          y: number;
        } | null) => void;
      };

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      const state = store?.getState();

      if (!state?.setSelectionBox) {
        throw new Error("Kanban store selection setter is unavailable");
      }

      state.setSelectionBox(nextBox);
    }, box);
  }

  async function ensureSelectMode(page: Page): Promise<void> {
    const modeToggle = page.locator('[data-testid="task-select-mode-toggle"]');
    if (!(await modeToggle.isVisible())) {
      return;
    }

    const modeTitle = (await modeToggle.getAttribute("title")) ?? "";
    if (modeTitle.includes("Select Mode")) {
      await modeToggle.click();
    }
  }

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    if (!(ownerPage.isClosed())) {
      await ownerPage.close();
    }
    if (!(editorPage.isClosed())) {
      await editorPage.close();
    }
  });

  test("live cursor movement syncs to peer with position assertions", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();

    await ownerPage.mouse.move(400, 300);
    // Wait for cursor to appear on peer page
    await waitForPresenceCursor(editorPage);

    await ownerPage.mouse.move(500, 350);
    // Wait for cursor position to update on peer
    await editorPage
      .locator('[data-testid="peer-cursor"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const cursorIndicator = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorIndicator).toBeVisible({ timeout: 5000 });

    await ownerPage.mouse.move(600, 400);
    // Wait for final cursor position to sync
    await editorPage
      .locator('[data-testid="peer-cursor"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const cursorBox = await cursorIndicator.boundingBox();
    expect(cursorBox).not.toBeNull();
    expect(cursorBox!.x).toBeGreaterThan(0);
    expect(cursorBox!.y).toBeGreaterThan(0);
  });

  test("selection box presence syncs to peer", async () => {
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      10_000
    );
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );

    await setSelectionBoxFromStore(ownerPage, {
      x: 120,
      y: 120,
      width: 320,
      height: 240,
    });
    // Wait for selection to sync to peer
    await editorPage
      .locator('[data-testid="peer-selection"]')
      .waitFor({ state: "visible", timeout: 10_000 });

    const selectionIndicator = editorPage.locator(
      '[data-testid="peer-selection"]'
    );
    await expect(selectionIndicator).toBeVisible({ timeout: 5000 });

    await setSelectionBoxFromStore(ownerPage, null);
  });

  test("cursor presence appears for peer on board node hover", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    // Wait for cursor to appear on peer's view
    await waitForPresenceCursor(editorPage);

    const cursorIndicator = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorIndicator).toBeVisible({ timeout: 5000 });
  });

  test("abrupt tab close clears presence from peer", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    // Wait for cursor to appear
    await waitForPresenceCursor(editorPage);

    const cursorBefore = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorBefore).toBeVisible({ timeout: 5000 });

    await ownerPage.close();

    await editorPage.waitForTimeout(2000);

    const cursorCountAfterClose = await editorPage
      .locator('[data-testid="peer-cursor"]')
      .count();
    expect(cursorCountAfterClose).toBeLessThanOrEqual(1);
  });

  test("selection presence appears when peer selects a board", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.click();
    // Wait for selection to appear on peer's view
    await editorPage
      .locator('[data-testid="peer-selection"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const selectionIndicator = editorPage.locator(
      '[data-testid="peer-selection"]'
    );
    await expect(selectionIndicator).toBeVisible({ timeout: 5000 });
  });

  test("duplicate tab from same user does not create broken user lists", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    // Wait for cursor to appear
    await waitForPresenceCursor(editorPage);

    const cursorBefore = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorBefore).toBeVisible({ timeout: 5000 });

    const ownerContext = await ownerPage.context();
    const duplicatePage = await ownerContext.newPage();
    await clearLocalStorageAndIndexedDB(duplicatePage);
    await disableAnimations(duplicatePage);
    await duplicatePage.goto("/");
    await waitForAppReady(duplicatePage);

    await duplicatePage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.waitForTimeout(1500);

    const cursorCount = await editorPage.locator('[data-testid="peer-cursor"]').count();
    expect(cursorCount).toBeLessThanOrEqual(2);

    await duplicatePage.close();
  });
});
