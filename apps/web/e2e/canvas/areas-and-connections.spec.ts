import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-05: Area Management and Board Connections", () => {
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

  test("create area containing boards", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();

    await page.waitForSelector('[data-testid="area-name-input"]');
    await page.fill('[data-testid="area-name-input"]', "Test Area");
    await page.click('[data-testid="area-create-submit"]');

    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Test Area")'
    );
    await expect(area).toBeVisible();
  });

  test("area contains boards via drag", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();
    await page.fill('[data-testid="area-name-input"]', "Area With Boards");
    await page.click('[data-testid="area-create-submit"]');
    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Area With Boards")'
    );
    const areaBox = await area.boundingBox();

    const boardNode = page.locator('[data-testid="board-node"]').first();
    const boardBox = await boardNode.boundingBox();

    if (areaBox && boardBox) {
      await boardNode.dragTo(area);
    }

    await page.waitForTimeout(500);

    const areaWithBoards = page.locator(
      '[data-testid="area-node"]:has-text("Area With Boards")'
    );
    const boardCountBadge = areaWithBoards.locator(
      '[data-testid="area-board-count"]'
    );
    await expect(boardCountBadge).toContainText("1");
  });

  test("dragging area moves contained boards", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();
    await page.fill('[data-testid="area-name-input"]', "Movable Area");
    await page.click('[data-testid="area-create-submit"]');
    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Movable Area")'
    );
    const initialBox = await area.boundingBox();
    expect(initialBox).not.toBeNull();

    await area.locator('[data-testid="area-header"]').hover();
    await page.mouse.down();
    await page.mouse.move(
      (initialBox?.x || 0) + 300,
      (initialBox?.y || 0) + 100
    );
    await page.mouse.up();

    await page.waitForTimeout(500);

    const movedBox = await area.boundingBox();
    expect(movedBox).not.toBeNull();

    const xDiff = Math.abs((movedBox?.x || 0) - (initialBox?.x || 0));
    expect(xDiff).toBeGreaterThan(100);
  });

  test("duplicate connection creation is blocked", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill(
      '[data-testid="board-name-input"]',
      "Second Board for Connection"
    );
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);

    await board1.locator('[data-testid="board-connection-handle"]').hover();
    await page.waitForTimeout(200);

    const board1Box = await board1.boundingBox();
    const board2Box = await board2.boundingBox();

    if (board1Box && board2Box) {
      await page.mouse.move(
        board1Box.x + board1Box.width,
        board1Box.y + board1Box.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(board2Box.x, board2Box.y + board2Box.height / 2);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    await board1.locator('[data-testid="board-connection-handle"]').hover();
    await page.waitForTimeout(200);

    const connectionCountBefore = await page
      .locator('[data-testid="board-connection"]')
      .count();

    if (board1Box && board2Box) {
      await page.mouse.move(
        board1Box.x + board1Box.width,
        board1Box.y + board1Box.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(board2Box.x, board2Box.y + board2Box.height / 2);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const connectionCountAfter = await page
      .locator('[data-testid="board-connection"]')
      .count();
    expect(connectionCountAfter).toBe(connectionCountBefore);
  });

  test("self-loop connection creation is blocked", async ({ page }) => {
    const board = page.locator('[data-testid="board-node"]').first();
    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();

    const initialConnections = await page
      .locator('[data-testid="board-connection"]')
      .count();

    const handle = board
      .locator('[data-testid="board-connection-handle"]')
      .first();
    await handle.hover();
    await page.waitForTimeout(200);

    if (boardBox) {
      await page.mouse.move(
        boardBox.x + boardBox.width,
        boardBox.y + boardBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const finalConnections = await page
      .locator('[data-testid="board-connection"]')
      .count();
    expect(finalConnections).toBe(initialConnections);
  });

  test("connection style edits persist", async ({ page }) => {
    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);

    const board1Box = await board1.boundingBox();
    const board2Box = await board2.boundingBox();

    if (board1Box && board2Box) {
      await page.mouse.move(
        board1Box.x + board1Box.width,
        board1Box.y + board1Box.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(board2Box.x, board2Box.y + board2Box.height / 2);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const connection = page.locator('[data-testid="board-connection"]').first();
    await connection.click({ button: "right" });

    await page.waitForSelector('[data-testid="connection-edit-option"]');
    await page.click('[data-testid="connection-edit-option"]');

    await page.waitForSelector('[data-testid="connection-style-select"]');
    await page.selectOption(
      '[data-testid="connection-style-select"]',
      "dotted"
    );
    await page.click('[data-testid="connection-style-save"]');

    await page.reload();
    await waitForAppReady(page);

    const connectionAfterReload = page
      .locator('[data-testid="board-connection"]')
      .first();
    await expect(connectionAfterReload).toHaveAttribute("data-style", "dotted");
  });

  test("connection label edits persist", async ({ page }) => {
    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);

    const board1Box = await board1.boundingBox();
    const board2Box = await board2.boundingBox();

    if (board1Box && board2Box) {
      await page.mouse.move(
        board1Box.x + board1Box.width,
        board1Box.y + board1Box.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(board2Box.x, board2Box.y + board2Box.height / 2);
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const connection = page.locator('[data-testid="board-connection"]').first();
    await connection.click({ button: "right" });
    await page.click('[data-testid="connection-edit-option"]');

    await page.waitForSelector('[data-testid="connection-label-input"]');
    await page.fill(
      '[data-testid="connection-label-input"]',
      "Test Connection Label"
    );
    await page.click('[data-testid="connection-style-save"]');

    await page.reload();
    await waitForAppReady(page);

    const connectionAfterReload = page
      .locator('[data-testid="board-connection"]')
      .first();
    await expect(
      connectionAfterReload.locator('[data-testid="connection-label"]')
    ).toContainText("Test Connection Label");
  });
});
