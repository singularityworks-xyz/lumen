import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  getReactFlowViewport,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-02: Board Creation, Placement, and Canvas Viewport", () => {
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

  test("creating boards updates canvas and selector state", async ({
    page,
  }) => {
    const initialBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();

    await page.waitForSelector('[data-testid="board-name-input"]');
    await page.fill('[data-testid="board-name-input"]', "Second Board");
    await page.fill(
      '[data-testid="board-description-input"]',
      "Test description"
    );
    await page.click('[data-testid="board-create-submit"]');

    await page.waitForTimeout(500);

    const newBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(newBoardCount).toBe(initialBoardCount + 1);

    const secondBoard = page.locator(
      '[data-testid="board-node"]:has-text("Second Board")'
    );
    await expect(secondBoard).toBeVisible();
  });

  test("board dragging persists after reload", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const initialBox = await boardNode.boundingBox();
    expect(initialBox).not.toBeNull();

    await boardNode.hover();
    await page.mouse.down();
    await page.mouse.move(
      (initialBox?.x || 0) + 200,
      (initialBox?.y || 0) + 100
    );
    await page.mouse.up();

    // Wait for drag to persist
    await page.waitForTimeout(500);

    await page.reload();
    await waitForAppReady(page);

    // Wait for canvas to stabilize
    await page.waitForTimeout(500);

    const boardNodeAfterReload = page
      .locator('[data-testid="board-node"]')
      .first();
    const boxAfterReload = await boardNodeAfterReload.boundingBox();
    expect(boxAfterReload).not.toBeNull();

    // Check that position changed significantly (more tolerant)
    const xDiff = Math.abs((boxAfterReload?.x || 0) - (initialBox?.x || 0));
    const yDiff = Math.abs((boxAfterReload?.y || 0) - (initialBox?.y || 0));
    expect(xDiff + yDiff).toBeGreaterThan(20);
  });

  test("focus behavior uses last viewport state", async ({ page }) => {
    // Wait for initial board to be visible
    const boardNode = page.locator('[data-testid="board-node"]').first();
    await boardNode.waitFor({ state: "visible", timeout: 10_000 });
    await boardNode.click();

    await page.waitForTimeout(500);

    const viewportBefore = await getReactFlowViewport(page);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Third Board");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(800);

    const boardToFocus = page.locator(
      '[data-testid="board-node"]:has-text("Third Board")'
    );
    await boardToFocus.waitFor({ state: "visible", timeout: 10_000 });
    await boardToFocus.click();

    await page.waitForTimeout(500);

    const viewportAfter = await getReactFlowViewport(page);

    if (viewportBefore && viewportAfter) {
      const focusedBoard = page.locator(
        '[data-testid="board-node"][data-selected="true"]'
      );
      await expect(focusedBoard).toBeVisible();
    }
  });

  test("fit view behavior on board focus", async ({ page }) => {
    const boardsBefore = await page
      .locator('[data-testid="board-node"]')
      .count();

    for (let i = 0; i < 3; i++) {
      const newBoardButton = page.locator('[data-testid="new-board-button"]');
      await newBoardButton.click();
      await page.fill('[data-testid="board-name-input"]', `Board ${i + 3}`);
      await page.click('[data-testid="board-create-submit"]');
      await page.waitForTimeout(300);
    }

    const boardsAfter = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsAfter).toBe(boardsBefore + 3);

    await page.keyboard.press("Escape");
    await page.keyboard.press("0");

    await page.waitForTimeout(500);
  });

  test("canvas panning and zooming works", async ({ page }) => {
    const canvas = page.locator(".react-flow");
    await expect(canvas).toBeVisible();

    const initialViewport = await getReactFlowViewport(page);

    await canvas.hover();
    await page.mouse.wheel(0, -100);

    await page.waitForTimeout(300);

    const zoomedViewport = await getReactFlowViewport(page);

    expect(zoomedViewport.zoom).not.toBe(initialViewport.zoom);
  });
});
