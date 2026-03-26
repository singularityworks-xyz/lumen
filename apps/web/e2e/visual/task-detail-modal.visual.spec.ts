import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  openTaskDetailModal,
  seedPopulatedWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-04: Task Detail Modal Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await freezeDate(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);
  });

  test("task modal opens and renders correctly", async ({ page }) => {
    const seeded = await seedPopulatedWorkspace(page);
    const taskId = seeded.taskIds[0];
    const boardId = seeded.boardIds[0];
    if (!(taskId && boardId)) {
      throw new Error("Failed to seed workspace with task and board");
    }

    await openTaskDetailModal(page, taskId, boardId);
    await page.waitForTimeout(500);

    const modal = page.locator(".relative.rounded-lg.bg-card");
    await expect(modal.first()).toBeVisible();

    await expect(page).toHaveScreenshot("task-detail-modal-open.png", {
      animations: "disabled",
    });
  });

  test("task modal chrome with header", async ({ page }) => {
    const seeded = await seedPopulatedWorkspace(page);
    const taskId = seeded.taskIds[0];
    const boardId = seeded.boardIds[0];
    if (!(taskId && boardId)) {
      throw new Error("Failed to seed workspace with task and board");
    }

    await openTaskDetailModal(page, taskId, boardId);
    await page.waitForTimeout(500);

    const modalHeader = page.locator(
      ".flex.cursor-move.select-none.items-center.justify-between"
    );
    await expect(modalHeader.first()).toBeVisible();

    await expect(page).toHaveScreenshot("task-detail-modal-header.png", {
      animations: "disabled",
    });
  });

  test("task modal form fields visible", async ({ page }) => {
    const seeded = await seedPopulatedWorkspace(page);
    const taskId = seeded.taskIds[0];
    const boardId = seeded.boardIds[0];
    if (!(taskId && boardId)) {
      throw new Error("Failed to seed workspace with task and board");
    }

    await openTaskDetailModal(page, taskId, boardId);
    await page.waitForTimeout(500);

    const editButton = page.locator(
      'button:has-text("Edit"), button:has-text("Edit Task")'
    );
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot("task-detail-modal-edit-mode.png", {
      animations: "disabled",
    });
  });

  test("task modal checklist layout", async ({ page }) => {
    const seeded = await seedPopulatedWorkspace(page);
    const taskId = seeded.taskIds[0];
    const boardId = seeded.boardIds[0];
    if (!(taskId && boardId)) {
      throw new Error("Failed to seed workspace with task and board");
    }

    await openTaskDetailModal(page, taskId, boardId);
    await page.waitForTimeout(500);

    await page.evaluate(
      ({ taskId: tid }: { taskId: string }) => {
        const {
          useKanbanStore,
        } = require("@/src/features/kanban/store/kanban-store");
        useKanbanStore.getState().updateTask(tid, {
          checklists: [
            { id: "check-1", title: "Test checklist item 1", completed: false },
            { id: "check-2", title: "Test checklist item 2", completed: true },
          ],
        });
      },
      { taskId }
    );

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("task-detail-modal-checklist.png", {
      animations: "disabled",
    });
  });

  test("task modal close button works", async ({ page }) => {
    const seeded = await seedPopulatedWorkspace(page);
    const taskId = seeded.taskIds[0];
    const boardId = seeded.boardIds[0];
    if (!(taskId && boardId)) {
      throw new Error("Failed to seed workspace with task and board");
    }

    await openTaskDetailModal(page, taskId, boardId);
    await page.waitForTimeout(500);

    const closeButton = page.locator("button:has(.lucide-x)").first();
    await closeButton.click();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("task-detail-modal-closed.png", {
      animations: "disabled",
    });
  });
});
