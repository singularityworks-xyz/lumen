import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

const getBulkActionsBar = (page: Page) =>
  page
    .locator('[data-testid="bulk-actions-bar"]')
    .filter({ visible: true })
    .last();

async function clickWithDispatchFallback(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();

  try {
    await locator.click({ timeout: 3000 });
    return;
  } catch {
    try {
      await locator.click({ timeout: 3000, force: true });
      return;
    } catch {
      const isStillVisible = await locator.isVisible().catch(() => false);
      if (!isStillVisible) {
        return;
      }

      await locator.dispatchEvent("click");
    }
  }
}

async function submitTaskCreate(page: Page): Promise<void> {
  const submitButton = page
    .locator('[data-testid="task-create-submit"]')
    .first();

  await clickWithDispatchFallback(submitButton);
  await expect(
    page.locator('[data-testid="task-title-input"]').first()
  ).toBeHidden({ timeout: 10_000 });
}

async function enableSelectMode(page: Page): Promise<void> {
  const selectModeButton = page.locator(
    '[data-testid="task-select-mode-toggle"]'
  );
  await clickWithDispatchFallback(selectModeButton);
  await expect(selectModeButton).toContainText("Select");
}

async function selectTaskByTitle(page: Page, title: string): Promise<void> {
  const taskCard = page
    .locator(`[data-testid="task-card"]:has-text("${title}")`)
    .first();
  const checkbox = taskCard.getByRole("checkbox");
  await clickWithDispatchFallback(checkbox);
  await expect(checkbox).toBeChecked();
}

test.describe("E2E-04: Task Detail Modal and Bulk Actions", () => {
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

    const boardNode = page.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await clickWithDispatchFallback(addColumnTrigger);
    await page.fill('[data-testid="column-name-input"]', "Task Detail Column");
    await page.click('[data-testid="column-create-submit"]');
    await page.waitForTimeout(500);

    const column = page.locator(
      '[data-testid="kanban-column"]:has-text("Task Detail Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Detail Test Task");
    await page.fill(
      '[data-testid="task-description-input"]',
      "Test description content"
    );
    await submitTaskCreate(page);
    await page.waitForTimeout(500);
  });

  test("task detail modal opens", async ({ page }) => {
    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await taskCard.click();

    await page.waitForSelector('[data-testid="task-detail-modal"]', {
      timeout: 5000,
    });
    const modal = page.locator('[data-testid="task-detail-modal"]');
    await expect(modal).toBeVisible();
  });

  test("edits in task detail modal persist", async ({ page }) => {
    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await taskCard.click();

    await page.waitForSelector('[data-testid="task-detail-modal"]');

    const editButton = page.locator('[data-testid="task-detail-edit-button"]');
    await editButton.click();

    await page.waitForSelector('[data-testid="task-detail-title-input"]');
    await page.fill(
      '[data-testid="task-detail-title-input"]',
      "Updated Task Title"
    );

    const saveButton = page.locator('[data-testid="task-detail-save-button"]');
    await saveButton.click();

    await page.waitForTimeout(300);

    const updatedCard = page.locator(
      '[data-testid="task-card"]:has-text("Updated Task Title")'
    );
    await expect(updatedCard).toBeVisible();
  });

  test("task detail modal reopens at remembered position", async ({ page }) => {
    const taskCard = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );

    const _initialBox = await taskCard.boundingBox();
    await taskCard.click();

    await page.waitForSelector('[data-testid="task-detail-modal"]');
    const initialModalBox = await page
      .locator('[data-testid="task-detail-modal"]')
      .boundingBox();

    const closeButton = page.locator(
      '[data-testid="task-detail-modal"] [data-testid="task-detail-close-button"]'
    );
    await closeButton.click();

    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-testid="task-detail-modal"]')
    ).not.toBeVisible();

    await taskCard.click();
    await page.waitForSelector('[data-testid="task-detail-modal"]');

    const reopenedModalBox = await page
      .locator('[data-testid="task-detail-modal"]')
      .boundingBox();

    if (initialModalBox && reopenedModalBox) {
      const xDiff = Math.abs(initialModalBox.x - reopenedModalBox.x);
      const yDiff = Math.abs(initialModalBox.y - reopenedModalBox.y);
      expect(xDiff + yDiff).toBeLessThan(50);
    }
  });

  test("multi-select tasks with checkbox mode", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const column = boardNode.locator('[data-testid="kanban-column"]').first();

    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Second Task");
    await submitTaskCreate(page);
    await page.waitForTimeout(300);

    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Third Task");
    await submitTaskCreate(page);
    await page.waitForTimeout(500);

    await enableSelectMode(page);

    await selectTaskByTitle(page, "Detail Test Task");
    await selectTaskByTitle(page, "Second Task");

    await page.waitForTimeout(300);

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const selectedCount = await bulkActionsBar
      .locator('[data-testid="bulk-selected-count"]')
      .first()
      .textContent();
    expect(selectedCount).toContain("2");
  });

  test("bulk update tasks priority", async ({ page }) => {
    const isMacPlatform = await page.evaluate(() =>
      navigator.platform.toLowerCase().includes("mac")
    );

    await enableSelectMode(page);

    const firstTask = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await firstTask.click({ modifiers: [isMacPlatform ? "Meta" : "Control"] });

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const priorityButton = bulkActionsBar.locator(
      'button:has-text("Priority")'
    );
    await priorityButton.click({ force: true });

    await page.waitForSelector('[data-testid="priority-option-high"]');
    await page.click('[data-testid="priority-option-high"]');

    await page.waitForTimeout(300);

    const updatedTask = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await expect(
      updatedTask.locator('[data-testid="task-priority-badge"]')
    ).toContainText("high");
  });

  test("bulk delete tasks", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const column = boardNode.locator('[data-testid="kanban-column"]').first();

    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Task To Bulk Delete");
    await submitTaskCreate(page);
    await page.waitForTimeout(500);

    await enableSelectMode(page);

    const taskToDelete = page.locator(
      '[data-testid="task-card"]:has-text("Task To Bulk Delete")'
    );
    await selectTaskByTitle(page, "Task To Bulk Delete");

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const deleteButton = bulkActionsBar.locator('button:has-text("Delete")');
    await deleteButton.click({ force: true });

    await page.waitForSelector('[data-testid="bulk-delete-confirm-dialog"]');
    await page.click('[data-testid="bulk-delete-confirm-button"]');

    await page.waitForTimeout(500);

    await expect(taskToDelete).not.toBeVisible();
  });

  test("bulk actions only affect selected tasks", async ({ page }) => {
    const boardNode = page.locator('[data-testid="board-node"]').first();
    const column = boardNode.locator('[data-testid="kanban-column"]').first();

    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await page.fill('[data-testid="task-title-input"]', "Unselected Task");
    await submitTaskCreate(page);
    await page.waitForTimeout(500);

    await enableSelectMode(page);

    await selectTaskByTitle(page, "Detail Test Task");

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const priorityButton = bulkActionsBar.locator(
      'button:has-text("Priority")'
    );
    await priorityButton.click({ force: true });
    await page.click('[data-testid="priority-option-low"]');

    await page.waitForTimeout(300);

    const unselectedTask = page.locator(
      '[data-testid="task-card"]:has-text("Unselected Task")'
    );
    await expect(
      unselectedTask.locator('[data-testid="task-priority-badge"]')
    ).not.toContainText("low");

    const selectedTaskAfter = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await expect(
      selectedTaskAfter.locator('[data-testid="task-priority-badge"]')
    ).toContainText("low");
  });
});
