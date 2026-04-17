import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-03: Column and Task CRUD", () => {
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

  test("add column to board", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    await expect(boardNode).toBeVisible();

    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();

    await page.waitForSelector('[data-testid="column-name-input"]');
    await page.fill('[data-testid="column-name-input"]', "New Test Column");
    await page.click('[data-testid="column-create-submit"]');

    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("New Test Column")'
    );
    await expect(column).toBeVisible();
  });

  test("rename column", async ({ page }) => {
    const addColumnTrigger = page
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Original Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Original Column")'
    );
    await column.scrollIntoViewIfNeeded();
    await column
      .locator('[data-testid="column-header"]')
      .click({ button: "right" });

    await page.waitForSelector('[data-testid="column-rename-option"]');
    await page.click('[data-testid="column-rename-option"]');

    await page.waitForSelector('[data-testid="column-rename-input"]');
    await page.fill('[data-testid="column-rename-input"]', "Renamed Column");
    await page.click('[data-testid="column-rename-submit"]');

    await page.waitForTimeout(300);

    const renamedColumn = page.locator(
      '[data-testid="kanban-column"]:has-text("Renamed Column")'
    );
    await expect(renamedColumn).toBeVisible();
  });

  test("move column to another board", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Target Board");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    // Wait for the new board to be visible
    const targetBoardLocator = page.locator(
      '[data-testid="board-node"]:has-text("Target Board")'
    );
    await expect(targetBoardLocator).toBeVisible({ timeout: 10_000 });

    const sourceBoard = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = sourceBoard.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Movable Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    await page.keyboard.press("Escape");
    // Press "0" to reset zoom to 100% (fit view) before moving column
    await page.keyboard.press("0");
    await page.waitForTimeout(300);

    const movableColumn = page.locator(
      '[data-testid="kanban-column"]:has-text("Movable Column")'
    );
    await movableColumn.scrollIntoViewIfNeeded();
    const movableColumnHeader = movableColumn
      .locator('[data-testid="column-header"]')
      .first();
    await expect(movableColumnHeader).toBeAttached();
    await movableColumnHeader.dispatchEvent("contextmenu", { button: 2 });
    await page.waitForSelector('[data-testid="column-move-option"]', {
      timeout: 5000,
    });
    await page.click('[data-testid="column-move-option"]');

    const boardSelectDropdown = page
      .locator('[data-testid="board-select-dropdown"]')
      .first();
    await expect(boardSelectDropdown).toBeVisible();
    await boardSelectDropdown.click();

    const targetBoardOption = page
      .locator('[data-testid="board-select-option"]')
      .filter({ hasText: "Target Board" })
      .first();
    await expect(targetBoardOption).toBeVisible();
    await targetBoardOption.click();

    const moveConfirmButton = page
      .locator('[data-testid="column-move-confirm"]')
      .first();
    await expect(moveConfirmButton).toBeEnabled();
    await moveConfirmButton.click();

    await page.waitForTimeout(500);

    const targetBoard = page.locator(
      '[data-testid="board-node"]:has-text("Target Board")'
    );
    await expect(
      targetBoard.locator(
        '[data-testid="kanban-column"]:has-text("Movable Column")'
      )
    ).toBeVisible();
  });

  test("delete column", async ({ page }) => {
    const addColumnTrigger = page
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Deletable Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Deletable Column")'
    );
    await column.scrollIntoViewIfNeeded();
    await column
      .locator('[data-testid="column-header"]')
      .click({ button: "right" });
    await page.waitForSelector('[data-testid="column-delete-option"]');
    await page.click('[data-testid="column-delete-option"]');

    await page.waitForSelector('[data-testid="column-delete-confirm"]');
    await page.click('[data-testid="column-delete-confirm"]');

    await page.waitForTimeout(300);

    await expect(column).not.toBeVisible();
  });

  test("add task to column", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();

    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Task Test Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Task Test Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();

    await page.waitForSelector('[data-testid="task-title-input"]');
    await page.fill('[data-testid="task-title-input"]', "New Test Task");
    // Priority is set to "medium" by default, which is acceptable for this test
    await page.click('[data-testid="task-create-submit"]');

    await page.waitForTimeout(500);

    const task = page.locator(
      '[data-testid="task-card"]:has-text("New Test Task")'
    );
    await expect(task).toBeVisible();
  });

  test("move task between columns updates target column progress", async ({
    page,
  }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();

    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Source Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(300);

    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Target Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    await page.keyboard.press("Escape");
    // Press "0" to reset zoom to 100% (fit view) before dragging task
    await page.keyboard.press("0");
    await page.waitForTimeout(300);

    const sourceColumn = page.locator(
      '[data-testid="kanban-column"]:has-text("Source Column")'
    );
    const addTaskTrigger = sourceColumn.locator(
      '[data-testid="add-task-trigger"]'
    );
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Movable Task");
    await page.fill('[data-testid="task-progress-input"]', "50");
    await page.click('[data-testid="task-create-submit"]');
    await page.waitForTimeout(500);

    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Movable Task")'
    );
    const draggableTaskCard = taskCard.locator('[draggable="true"]').first();
    await expect(draggableTaskCard).toBeVisible();

    const taskBox = await draggableTaskCard.boundingBox();
    expect(taskBox).not.toBeNull();

    const targetColumn = page.locator(
      '[data-testid="kanban-column"]:has-text("Target Column")'
    );
    const targetDropZone = targetColumn
      .locator('[aria-label="Task drop zone"]')
      .first();
    const targetBox = await targetDropZone.boundingBox();
    expect(targetBox).not.toBeNull();

    if (taskBox && targetBox) {
      const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

      await draggableTaskCard.dispatchEvent("dragstart", { dataTransfer });
      await targetDropZone.dispatchEvent("dragover", { dataTransfer });
      await targetDropZone.dispatchEvent("drop", { dataTransfer });
      await draggableTaskCard.dispatchEvent("dragend", { dataTransfer });
    }

    await page.waitForTimeout(500);

    const targetTask = page.locator(
      '[data-testid="kanban-column"]:has-text("Target Column") [data-testid="task-card"]:has-text("Movable Task")'
    );
    await expect(targetTask).toBeVisible();
  });

  test("duplicate task", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Task Dup Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Task Dup Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Original Task");
    await page.click('[data-testid="task-create-submit"]');
    await page.waitForTimeout(500);

    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Original Task")'
    );
    await taskCard.click({ button: "right" });
    await page.waitForSelector('[data-testid="task-duplicate-option"]', {
      timeout: 5000,
    });
    await page.click('[data-testid="task-duplicate-option"]');

    await page.waitForTimeout(500);

    const duplicatedTask = page.locator(
      '[data-testid="task-card"]:has-text("Original Task (copy)")'
    );
    await expect(duplicatedTask).toBeVisible({ timeout: 5000 });
  });

  test("delete task", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await page.fill('[data-testid="column-name-input"]', "Delete Task Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Delete Task Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Task To Delete");
    await page.click('[data-testid="task-create-submit"]');
    await page.waitForTimeout(500);

    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Task To Delete")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });
    await taskCard.click({ button: "right" });
    // Wait for the quick actions menu to appear
    await page.waitForSelector('[data-testid="task-quick-actions"]', {
      state: "visible",
      timeout: 5000,
    });
    await page.waitForSelector('[data-testid="task-delete-option"]', {
      state: "visible",
      timeout: 5000,
    });
    await page.click('[data-testid="task-delete-option"]');

    // Task is moved to trash immediately (no confirmation dialog in quick actions)
    await page.waitForTimeout(500);

    // Task should no longer be visible in the column
    await expect(taskCard).not.toBeVisible();
  });
});
