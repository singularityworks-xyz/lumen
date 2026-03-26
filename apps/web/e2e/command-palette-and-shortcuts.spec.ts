import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-08: Command Palette and Shortcuts", () => {
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

  test("command palette opens with keyboard shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");

    await page.waitForSelector('[data-testid="command-palette"]', {
      timeout: 5000,
    });
    const commandPalette = page.locator('[data-testid="command-palette"]');
    await expect(commandPalette).toBeVisible();

    const input = page.locator('[data-testid="command-palette-input"]');
    await expect(input).toBeVisible();
  });

  test("command palette closes with Escape", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette"]');

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const commandPalette = page.locator('[data-testid="command-palette"]');
    await expect(commandPalette).not.toBeVisible();
  });

  test("command palette creates new board", async ({ page }) => {
    const initialBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    await page.fill('[data-testid="command-palette-input"]', "New Board");
    await page.waitForTimeout(300);

    const newBoardCommand = page.locator(
      '[data-testid="command-item"]:has-text("New Board")'
    );
    await newBoardCommand.click();

    await page.waitForTimeout(500);

    const newBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(newBoardCount).toBe(initialBoardCount + 1);
  });

  test("command palette searches tasks", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Search Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Search Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill(
      '[data-testid="task-title-input"]',
      "Unique Searchable Task Title"
    );
    await page.click('[data-testid="task-create-submit"]');
    await page.waitForTimeout(500);

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    await page.fill(
      '[data-testid="command-palette-input"]',
      "Unique Searchable"
    );

    await page.waitForTimeout(500);

    const searchResult = page.locator(
      '[data-testid="command-search-result"]:has-text("Unique Searchable Task Title")'
    );
    await expect(searchResult).toBeVisible();
  });

  test("keyboard shortcut N creates new board when palette is open", async ({
    page,
  }) => {
    const initialBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');

    await page.keyboard.press("n");
    await page.waitForTimeout(500);

    const newBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(newBoardCount).toBe(initialBoardCount + 1);
  });

  test("command palette undo action targets correct workspace", async ({
    page,
  }) => {
    const initialBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    await page.fill('[data-testid="command-palette-input"]', "New Board");

    const newBoardCommand = page.locator(
      '[data-testid="command-item"]:has-text("New Board")'
    );
    await newBoardCommand.click();
    await page.waitForTimeout(500);

    expect(await page.locator('[data-testid="board-node"]').count()).toBe(
      initialBoardCount + 1
    );

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    const undoCommand = page.locator(
      '[data-testid="command-item"]:has-text("Undo")'
    );
    await undoCommand.click();
    await page.waitForTimeout(500);

    expect(await page.locator('[data-testid="board-node"]').count()).toBe(
      initialBoardCount
    );
  });

  test("command palette redo action targets correct workspace", async ({
    page,
  }) => {
    const initialBoardCount = await page
      .locator('[data-testid="board-node"]')
      .count();

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    const newBoardCommand = page.locator(
      '[data-testid="command-item"]:has-text("New Board")'
    );
    await newBoardCommand.click();
    await page.waitForTimeout(500);

    expect(await page.locator('[data-testid="board-node"]').count()).toBe(
      initialBoardCount + 1
    );

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    const undoCommand = page.locator(
      '[data-testid="command-item"]:has-text("Undo")'
    );
    await undoCommand.click();
    await page.waitForTimeout(500);

    expect(await page.locator('[data-testid="board-node"]').count()).toBe(
      initialBoardCount
    );

    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette-input"]');
    const redoCommand = page.locator(
      '[data-testid="command-item"]:has-text("Redo")'
    );
    await redoCommand.click();
    await page.waitForTimeout(500);

    expect(await page.locator('[data-testid="board-node"]').count()).toBe(
      initialBoardCount + 1
    );
  });
});
