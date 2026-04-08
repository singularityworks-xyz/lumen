import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  setupTwoUsers,
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-14: Presence and Cursor Lifecycle", () => {
  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await ownerPage.close();
    await editorPage.close();
  });

  test("live cursor movement syncs to peer with position assertions", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();

    await ownerPage.mouse.move(400, 300);
    await ownerPage.waitForTimeout(500);
    await ownerPage.mouse.move(500, 350);
    await ownerPage.waitForTimeout(500);

    const cursorIndicator = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorIndicator).toBeVisible({ timeout: 5000 });

    await ownerPage.mouse.move(600, 400);
    await ownerPage.waitForTimeout(1000);

    const cursorBox = await cursorIndicator.boundingBox();
    expect(cursorBox).not.toBeNull();
    expect(cursorBox!.x).toBeGreaterThan(0);
    expect(cursorBox!.y).toBeGreaterThan(0);
  });

  test("selection box syncs while rubber-band selecting", async () => {
    await ownerPage.mouse.move(200, 200);
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(600, 500, { steps: 10 });
    await ownerPage.waitForTimeout(500);

    const selectionIndicator = editorPage.locator(
      '[data-testid="peer-selection"]'
    );
    await expect(selectionIndicator).toBeVisible({ timeout: 5000 });

    await ownerPage.mouse.up();
    await ownerPage.waitForTimeout(500);
  });

  test("cursor presence appears for peer on board node hover", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    await ownerPage.waitForTimeout(500);

    const cursorIndicator = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorIndicator).toBeVisible({ timeout: 5000 });
  });

  test("abrupt tab close clears presence from peer", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    await ownerPage.waitForTimeout(500);

    const cursorBefore = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorBefore).toBeVisible({ timeout: 5000 });

    await ownerPage.close();
    ownerPage = null as any;

    await editorPage.waitForTimeout(3000);

    const cursorAfter = editorPage.locator('[data-testid="peer-cursor"]');
    await expect(cursorAfter).not.toBeVisible({ timeout: 10_000 });
  });

  test("selection presence appears when peer selects a board", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.click();
    await ownerPage.waitForTimeout(500);

    const selectionIndicator = editorPage.locator(
      '[data-testid="peer-selection"]'
    );
    await expect(selectionIndicator).toBeVisible({ timeout: 5000 });
  });

  test("duplicate tab from same user does not create broken user lists", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    await ownerPage.waitForTimeout(500);

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

    await duplicatePage.waitForTimeout(2000);

    const cursorAfterDuplicate = editorPage.locator(
      '[data-testid="peer-cursor"]'
    );
    await expect(cursorAfterDuplicate).toBeVisible({ timeout: 5000 });

    const cursorCount = await editorPage
      .locator('[data-testid="peer-cursor"]')
      .count();
    expect(cursorCount).toBeLessThanOrEqual(2);

    await duplicatePage.close();
  });
});
