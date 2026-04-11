import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "./helpers/commands";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-20: Conflict - Offline Edit vs Remote Delete", () => {
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

  test("user A goes offline, edits task, user B deletes task, user A comes online", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Offline Delete Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Offline Delete Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill(
      '[data-testid="task-title-input"]',
      "Offline Delete Task"
    );
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Delete Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.context().setOffline(true);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Delete Task")')
      .click();
    await editorPage.waitForSelector('[data-testid="task-detail-modal"]');
    await editorPage.locator('[data-testid="task-detail-edit-button"]').click();
    await editorPage.waitForSelector('[data-testid="task-detail-title-input"]');
    await editorPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Edited while offline - will be deleted");

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Offline Delete Task")'
    );
    await taskCard.click({ button: "right" });
    await ownerPage.waitForSelector('[data-testid="task-delete-option"]');
    await ownerPage.click('[data-testid="task-delete-option"]');
    await ownerPage.waitForSelector('[data-testid="task-delete-confirm"]');
    await ownerPage.click('[data-testid="task-delete-confirm"]');
    await ownerPage.waitForTimeout(1500);

    await editorPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.waitForTimeout(500);

    await editorPage.context().setOffline(false);
    await editorPage.waitForTimeout(3000);

    const deletedTask = editorPage.locator(
      '[data-testid="task-card"]:has-text("Offline Delete Task")'
    );
    await expect(deletedTask).not.toBeVisible({ timeout: 5000 });

    const staleEditedTask = editorPage.locator(
      '[data-testid="task-card"]:has-text("Edited while offline")'
    );
    await expect(staleEditedTask).not.toBeVisible({ timeout: 5000 });

    const modalVisible = await editorPage
      .locator('[data-testid="task-detail-modal"]')
      .isVisible()
      .catch(() => false);
    if (modalVisible) {
      await editorPage.waitForTimeout(500);
    }
  });

  test("offline edit syncs successfully when no conflict exists", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Offline Sync Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Offline Sync Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill(
      '[data-testid="task-title-input"]',
      "Offline Sync Task"
    );
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Sync Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.context().setOffline(true);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Offline Sync Task")')
      .click();
    await editorPage.waitForSelector('[data-testid="task-detail-modal"]');
    await editorPage.locator('[data-testid="task-detail-edit-button"]').click();
    await editorPage.waitForSelector('[data-testid="task-detail-title-input"]');
    await editorPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Successfully edited offline");
    await editorPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.waitForTimeout(500);

    await editorPage.context().setOffline(false);
    await editorPage.waitForTimeout(3000);

    const syncedTask = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Successfully edited offline")'
    );
    await expect(syncedTask).toBeVisible({ timeout: 10_000 });

    const editorSyncedTask = editorPage.locator(
      '[data-testid="task-card"]:has-text("Successfully edited offline")'
    );
    await expect(editorSyncedTask).toBeVisible({ timeout: 5000 });
  });

  test("offline checklist edit while another user changes task status", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Checklist Status Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Checklist Status Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill(
      '[data-testid="task-title-input"]',
      "Checklist Status Task"
    );
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Checklist Status Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Checklist Status Task")')
      .click();
    await editorPage.waitForSelector('[data-testid="task-detail-modal"]');
    await editorPage.locator('[data-testid="task-detail-edit-button"]').click();
    await editorPage.waitForSelector(
      '[data-testid="task-detail-description-input"]'
    );

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Checklist Status Task")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector(
      '[data-testid="task-detail-description-input"]'
    );

    await editorPage.context().setOffline(true);

    await editorPage.locator('[data-testid="task-detail-modal"]').click();
    await editorPage.waitForTimeout(500);

    const checklistSection = editorPage.locator(
      '[data-testid="checklist-section"]'
    );
    if (await checklistSection.isVisible()) {
      const firstChecklistItem = checklistSection
        .locator('[data-testid="checklist-item"]')
        .first();
      if (await firstChecklistItem.isVisible()) {
        await firstChecklistItem
          .locator('[data-testid="checklist-checkbox"]')
          .click();
      }
    }

    await editorPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.waitForTimeout(500);

    const statusSelect = ownerPage.locator(
      '[data-testid="task-detail-status"]'
    );
    if (await statusSelect.isVisible()) {
      await ownerPage
        .locator('[data-testid="task-detail-status-option-done"]')
        .click();
    }
    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(1500);

    await editorPage.context().setOffline(false);
    await editorPage.waitForTimeout(3000);

    const syncedTask = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Checklist Status Task")'
    );
    await expect(syncedTask).toBeVisible({ timeout: 5000 });
  });
});
