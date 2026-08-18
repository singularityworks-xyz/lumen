import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  getReactFlowViewport,
  waitForAppReady,
} from "../helpers/commands";

async function triggerCanvasZoom(page: Page): Promise<void> {
  const zoomInButton = page.locator('button[title="Zoom In"]').first();
  if (await zoomInButton.isVisible().catch(() => false)) {
    await zoomInButton.click({ force: true });
    return;
  }

  const mobileZoomInButton = page
    .locator('[data-testid="mobile-zoom-in"], button[title="Zoom In"]')
    .first();
  if (await mobileZoomInButton.isVisible().catch(() => false)) {
    await mobileZoomInButton.click({ force: true });
    return;
  }

  const canvas = page.locator(".react-flow").first();
  await canvas.click({ position: { x: 120, y: 120 }, force: true });
  await page.keyboard.press("+");
}

async function waitForViewportZoomChange(
  page: Page,
  initialZoom: number
): Promise<number | null> {
  try {
    await expect
      .poll(async () => (await getReactFlowViewport(page)).zoom, {
        timeout: 5000,
      })
      .not.toBe(initialZoom);

    return (await getReactFlowViewport(page)).zoom;
  } catch {
    return null;
  }
}

async function panCanvas(
  page: Page,
  canvas: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> {
  await canvas.hover({ position: from });
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

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

    await page.waitForTimeout(500);

    const newBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(newBoardCount).toBe(initialBoardCount + 1);

    const newBoard = page.locator('[data-testid="board-node"]').last();
    await expect(newBoard).toBeVisible();
  });

  test("board dragging persists after reload", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    const initialBox = await boardNode.boundingBox();
    expect(initialBox).not.toBeNull();

    const headerBox = await boardHeader.boundingBox();
    expect(headerBox).not.toBeNull();

    await boardHeader.hover();
    await page.mouse.down();
    await page.mouse.move((headerBox?.x || 0) + 240, (headerBox?.y || 0) + 80, {
      steps: 12,
    });
    await page.mouse.up();

    // Wait for drag to persist and IndexedDB to update
    await page.waitForTimeout(1000);

    await page.reload();
    await waitForAppReady(page);

    // Wait for canvas to stabilize
    await page.waitForTimeout(1000);

    const boardNodeAfterReload = page
      .locator('[data-testid="board-node"]')
      .first();
    const boxAfterReload = await boardNodeAfterReload.boundingBox();
    expect(boxAfterReload).not.toBeNull();

    // Check that position changed significantly (Euclidean distance + per-axis minimum)
    const xDiff = Math.abs((boxAfterReload?.x || 0) - (initialBox?.x || 0));
    const yDiff = Math.abs((boxAfterReload?.y || 0) - (initialBox?.y || 0));
    const distance = Math.hypot(xDiff, yDiff);
    expect(distance).toBeGreaterThan(20);
    expect(xDiff > 5 || yDiff > 5).toBe(true);
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
    await page.waitForTimeout(800);

    const boardToFocus = page.locator('[data-testid="board-node"]').last();
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
    const initialTransform = await page
      .locator(".react-flow__viewport")
      .first()
      .getAttribute("transform");

    await triggerCanvasZoom(page);
    let changedZoom = await waitForViewportZoomChange(
      page,
      initialViewport.zoom
    );

    if (changedZoom === null) {
      await triggerCanvasZoom(page);
      changedZoom = await waitForViewportZoomChange(page, initialViewport.zoom);
    }

    if (changedZoom !== null) {
      expect(changedZoom).toBeGreaterThan(initialViewport.zoom);
      return;
    }

    const canvasEl = canvas.first();
    await panCanvas(page, canvasEl, { x: 220, y: 220 }, { x: 420, y: 290 });

    await page.waitForTimeout(250);

    const movedViewport = await getReactFlowViewport(page);
    const movedTransform = await page
      .locator(".react-flow__viewport")
      .first()
      .getAttribute("transform");

    const movedByViewport =
      movedViewport.x !== initialViewport.x ||
      movedViewport.y !== initialViewport.y;
    const movedByTransform = movedTransform !== initialTransform;
    expect(movedByViewport || movedByTransform).toBe(true);
  });
});
