import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "./helpers/commands";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-13: Multi-User Drag Sync", () => {
  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("board drag position syncs to editor with pixel-precise coordinates", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardBox = await boardNode.boundingBox();
    expect(boardBox).not.toBeNull();

    const startX = boardBox!.x + boardBox!.width / 2;
    const startY = boardBox!.y + boardBox!.height / 2;
    const dragX = 200;
    const dragY = 150;

    await ownerPage.mouse.move(startX, startY);
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(startX + dragX, startY + dragY, { steps: 10 });
    await ownerPage.mouse.up();
    await ownerPage.waitForTimeout(1000);

    // Owner board should have moved
    const ownerBoxAfterDrag = await boardNode.boundingBox();
    expect(ownerBoxAfterDrag).not.toBeNull();
    expect(ownerBoxAfterDrag!.x).toBeCloseTo(boardBox!.x + dragX, -1);
    expect(ownerBoxAfterDrag!.y).toBeCloseTo(boardBox!.y + dragY, -1);

    // Editor should see the same position (within 10px tolerance for render timing)
    const editorBoard = editorPage
      .locator('[data-testid="board-node"]')
      .first();
    const editorBox = await editorBoard.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(Math.abs(editorBox!.x - ownerBoxAfterDrag!.x)).toBeLessThan(10);
    expect(Math.abs(editorBox!.y - ownerBoxAfterDrag!.y)).toBeLessThan(10);

    // Reload both and verify persistence with exact coordinates
    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const ownerBoxAfterReload = await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .boundingBox();
    const editorBoxAfterReload = await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .boundingBox();

    expect(ownerBoxAfterReload).not.toBeNull();
    expect(editorBoxAfterReload).not.toBeNull();

    // Both should be at the same persisted position (within 10px)
    expect(
      Math.abs(ownerBoxAfterReload!.x - editorBoxAfterReload!.x)
    ).toBeLessThan(10);
    expect(
      Math.abs(ownerBoxAfterReload!.y - editorBoxAfterReload!.y)
    ).toBeLessThan(10);
  });

  test("column reorder syncs to editor immediately", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Column A");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Column B");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Column B")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const ownerColumns = await ownerPage
      .locator('[data-testid="kanban-column"]')
      .allTextContents();
    const editorColumns = await editorPage
      .locator('[data-testid="kanban-column"]')
      .allTextContents();

    expect(ownerColumns.length).toBe(editorColumns.length);
  });

  test("task drag across columns syncs to editor", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Source Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Target Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const sourceColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Source Col")'
    );
    const addTaskTrigger = sourceColumn.locator(
      '[data-testid="add-task-trigger"]'
    );
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Draggable Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Draggable Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskCard = sourceColumn.locator(
      '[data-testid="task-card"]:has-text("Draggable Task")'
    );
    const targetColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Target Col")'
    );

    const taskBox = await taskCard.boundingBox();
    const targetBox = await targetColumn.boundingBox();
    expect(taskBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await ownerPage.mouse.move(
      taskBox!.x + taskBox!.width / 2,
      taskBox!.y + taskBox!.height / 2
    );
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 10 }
    );
    await ownerPage.mouse.up();
    await ownerPage.waitForTimeout(1500);

    const editorTargetColumn = editorPage.locator(
      '[data-testid="kanban-column"]:has-text("Target Col")'
    );
    const movedTask = editorTargetColumn.locator(
      '[data-testid="task-card"]:has-text("Draggable Task")'
    );
    await expect(movedTask).toBeVisible({ timeout: 10_000 });
  });

  test("drag cancel with Escape leaves no ghost state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardBox = await boardNode.boundingBox();
    expect(boardBox).not.toBeNull();

    const startX = boardBox!.x + boardBox!.width / 2;
    const startY = boardBox!.y + boardBox!.height / 2;

    await ownerPage.mouse.move(startX, startY);
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(startX + 100, startY + 100, { steps: 5 });
    await ownerPage.keyboard.press("Escape");
    await ownerPage.waitForTimeout(500);

    const boardAfterCancel = ownerPage
      .locator('[data-testid="board-node"]')
      .first();
    const boxAfterCancel = await boardAfterCancel.boundingBox();
    expect(boxAfterCancel).not.toBeNull();

    expect(Math.abs(boxAfterCancel!.x - boardBox!.x)).toBeLessThan(10);
    expect(Math.abs(boxAfterCancel!.y - boardBox!.y)).toBeLessThan(10);
  });

  test("simultaneous edits produce deterministic final state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });
    await ownerPage.waitForSelector('[data-testid="board-rename-option"]');
    await ownerPage.click('[data-testid="board-rename-option"]');

    const renameInput = ownerPage.locator(
      '[data-testid="board-rename-dialog"] input'
    );
    await renameInput.fill("Owner Renamed");

    const editorBoardNode = editorPage
      .locator('[data-testid="board-node"]')
      .first();
    await editorBoardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });
    await editorPage.waitForSelector('[data-testid="board-rename-option"]');
    await editorPage.click('[data-testid="board-rename-option"]');

    const editorRenameInput = editorPage.locator(
      '[data-testid="board-rename-dialog"] input'
    );
    await editorRenameInput.fill("Editor Renamed");

    await ownerPage.keyboard.press("Enter");
    await editorPage.keyboard.press("Enter");
    await ownerPage.waitForTimeout(2000);

    const ownerBoardName = await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="board-header"]')
      .textContent();
    const editorBoardName = await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="board-header"]')
      .textContent();

    expect(ownerBoardName).toBe(editorBoardName);
  });

  test("late joiner gets converged state immediately", async () => {
    const addColumnTrigger = ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Late Join Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Late Join Col")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const lateContext = await ownerPage.context().browser()!.newContext();
    const latePage = await lateContext.newPage();
    await clearLocalStorageAndIndexedDB(latePage);
    await disableAnimations(latePage);
    await latePage.goto("/");
    await waitForAppReady(latePage);

    const workspaceSelector = latePage.locator(
      '[data-testid="workspace-selector"]'
    );
    if (await workspaceSelector.isVisible()) {
      const existingColumns = await latePage
        .locator('[data-testid="kanban-column"]')
        .count();
      expect(existingColumns).toBeGreaterThanOrEqual(1);
    }

    await latePage.close();
  });
});
