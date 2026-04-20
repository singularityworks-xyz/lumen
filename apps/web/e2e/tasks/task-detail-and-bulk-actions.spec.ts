import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  getTaskBoardIdById,
  getTaskIdByTitle,
} from "../helpers/store";

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
    const isStillVisible = await locator.isVisible().catch(() => false);
    if (!isStillVisible) {
      return;
    }

    await locator.dispatchEvent("click");
  }
}

async function clickBySelectorViaEvaluate(
  page: Page,
  selector: string
): Promise<void> {
  await page.evaluate((resolvedSelector) => {
    const target = document.querySelector(resolvedSelector);
    if (!(target instanceof HTMLElement)) {
      throw new Error(`Element not found for selector: ${resolvedSelector}`);
    }

    target.click();
  }, selector);
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

async function openTaskDetailViaStore(
  page: Page,
  title: string
): Promise<void> {
  const taskId = await getTaskIdByTitle(page, title);
  const boardId = await getTaskBoardIdById(page, taskId);

  if (!boardId) {
    throw new Error(`Board id not found for task: ${title}`);
  }

  await page.evaluate(
    ({ resolvedTaskId, resolvedBoardId }) => {
      interface KanbanState {
        openTaskDetailModal: (options: {
          boardId: string;
          taskId: string;
        }) => unknown;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      state.openTaskDetailModal({
        taskId: resolvedTaskId,
        boardId: resolvedBoardId,
      });
    },
    { resolvedTaskId: taskId, resolvedBoardId: boardId }
  );

  await expect(page.locator('[data-testid="task-detail-modal"]')).toBeVisible({
    timeout: 10_000,
  });
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

    await addColumnToFirstBoardViaStore(page, "Task Detail Column");
    await addTaskViaStore(page, "Task Detail Column", "Detail Test Task");

    await expect(
      page
        .locator('[data-testid="task-card"]:has-text("Detail Test Task")')
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("task detail modal opens", async ({ page }) => {
    await openTaskDetailViaStore(page, "Detail Test Task");

    const modal = page.locator('[data-testid="task-detail-modal"]');
    await expect(modal).toBeVisible();
  });

  test("edits in task detail modal persist", async ({ page }) => {
    await openTaskDetailViaStore(page, "Detail Test Task");

    await clickBySelectorViaEvaluate(
      page,
      '[data-testid="task-detail-edit-button"]'
    );

    await page.waitForSelector('[data-testid="task-detail-title-input"]');
    await page.fill(
      '[data-testid="task-detail-title-input"]',
      "Updated Task Title"
    );

    await clickBySelectorViaEvaluate(
      page,
      '[data-testid="task-detail-save-button"]'
    );

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
    await openTaskDetailViaStore(page, "Detail Test Task");

    const initialModalBox = await page
      .locator('[data-testid="task-detail-modal"]')
      .boundingBox();

    await clickBySelectorViaEvaluate(
      page,
      '[data-testid="task-detail-modal"] [data-testid="task-detail-close-button"]'
    );

    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-testid="task-detail-modal"]')
    ).not.toBeVisible({ timeout: 10_000 });

    await openTaskDetailViaStore(page, "Detail Test Task");

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
    await addTaskViaStore(page, "Task Detail Column", "Second Task");
    await addTaskViaStore(page, "Task Detail Column", "Third Task");

    await expect(
      page.locator('[data-testid="task-card"]:has-text("Second Task")').first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="task-card"]:has-text("Third Task")').first()
    ).toBeVisible({ timeout: 10_000 });
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
    await enableSelectMode(page);
    await selectTaskByTitle(page, "Detail Test Task");

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const priorityButton = bulkActionsBar.locator(
      'button:has-text("Priority")'
    );
    await clickWithDispatchFallback(priorityButton);

    await page.waitForSelector('[data-testid="priority-option-high"]');
    await clickWithDispatchFallback(
      page.locator('[data-testid="priority-option-high"]')
    );

    await page.waitForTimeout(300);

    const updatedTask = page.locator(
      '[data-testid="task-card"]:has-text("Detail Test Task")'
    );
    await expect(
      updatedTask.locator('[data-testid="task-priority-badge"]')
    ).toContainText("high");
  });

  test("bulk delete tasks", async ({ page }) => {
    await addTaskViaStore(page, "Task Detail Column", "Task To Bulk Delete");

    await expect(
      page
        .locator('[data-testid="task-card"]:has-text("Task To Bulk Delete")')
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    await enableSelectMode(page);

    const taskToDelete = page.locator(
      '[data-testid="task-card"]:has-text("Task To Bulk Delete")'
    );
    await selectTaskByTitle(page, "Task To Bulk Delete");

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const deleteButton = bulkActionsBar.locator('button:has-text("Delete")');
    await clickWithDispatchFallback(deleteButton);

    await page.waitForSelector('[data-testid="bulk-delete-confirm-dialog"]');
    await clickWithDispatchFallback(
      page.locator('[data-testid="bulk-delete-confirm-button"]')
    );

    await page.waitForTimeout(500);

    await expect(taskToDelete).not.toBeVisible();
  });

  test("bulk actions only affect selected tasks", async ({ page }) => {
    await addTaskViaStore(page, "Task Detail Column", "Unselected Task");

    await expect(
      page
        .locator('[data-testid="task-card"]:has-text("Unselected Task")')
        .first()
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    await enableSelectMode(page);

    await selectTaskByTitle(page, "Detail Test Task");

    const bulkActionsBar = getBulkActionsBar(page);
    await expect(bulkActionsBar).toBeVisible();

    const priorityButton = bulkActionsBar.locator(
      'button:has-text("Priority")'
    );
    await clickWithDispatchFallback(priorityButton);
    await clickWithDispatchFallback(
      page.locator('[data-testid="priority-option-low"]')
    );

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
