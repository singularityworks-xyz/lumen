import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "./helpers/commands";
import {
  assertServerClientMatch,
  verifyServerClientStateMatch,
} from "./lib/state-verification";

const WORKSPACE_ID_REGEX = /workspace\/([^/]+)/;

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-18: Conflict - Delete Task While Editing", () => {
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

  test("user A opens task for edit while user B deletes it - graceful handling", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Delete Conflict Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Delete Conflict Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill(
      '[data-testid="task-title-input"]',
      "Task To Be Deleted"
    );
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Task To Be Deleted")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Task To Be Deleted")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');

    const taskCard = editorPage.locator(
      '[data-testid="task-card"]:has-text("Task To Be Deleted")'
    );
    await taskCard.click({ button: "right" });
    await editorPage.waitForSelector('[data-testid="task-delete-option"]');
    await editorPage.click('[data-testid="task-delete-option"]');
    await editorPage.waitForSelector('[data-testid="task-delete-confirm"]');
    await editorPage.click('[data-testid="task-delete-confirm"]');
    await editorPage.waitForTimeout(1000);

    await ownerPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Trying to save deleted task");
    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(1500);

    const deletedTaskOwner = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Task To Be Deleted")'
    );
    const deletedTaskEditor = editorPage.locator(
      '[data-testid="task-card"]:has-text("Task To Be Deleted")'
    );

    await expect(deletedTaskOwner).not.toBeVisible({ timeout: 5000 });
    await expect(deletedTaskEditor).not.toBeVisible({ timeout: 5000 });

    const modalAfterDelete = ownerPage.locator(
      '[data-testid="task-detail-modal"]'
    );
    await modalAfterDelete.waitFor({ state: "hidden", timeout: 5000 });

    const workspaceIdMatch = ownerPage.url().match(WORKSPACE_ID_REGEX);
    const workspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;
    expect(workspaceId).toBeTruthy();

    if (workspaceId) {
      await ownerPage.waitForFunction(
        () => {
          const store = document.querySelector('[data-testid="kanban-store"]');
          return store?.getAttribute("data-sync-status") === "synced";
        },
        null,
        { timeout: 15_000 }
      );

      const verification = await verifyServerClientStateMatch(
        ownerPage,
        workspaceId
      );
      assertServerClientMatch(verification);
    }
  });

  test("user A edits task while user B deletes board containing it", async () => {
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });
    await ownerPage.waitForSelector('[data-testid="board-rename-option"]');
    await boardNode.locator('[data-testid="board-header"]').click();
    await ownerPage.waitForTimeout(500);

    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Board Delete Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Board Delete Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill(
      '[data-testid="task-title-input"]',
      "Board Delete Task"
    );
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Board Delete Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Board Delete Task")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });
    await editorPage.waitForSelector('[data-testid="board-delete-option"]');
    await editorPage.click('[data-testid="board-delete-option"]');
    await editorPage.waitForSelector('[data-testid="board-delete-confirm"]');
    await editorPage.fill(
      '[data-testid="board-delete-confirm-input"]',
      "DELETE"
    );
    await editorPage.click('[data-testid="board-delete-submit"]');
    await editorPage.waitForTimeout(1500);

    await ownerPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Trying to edit in deleted board");
    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(1500);

    const deletedTask = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Board Delete Task")'
    );
    await expect(deletedTask).not.toBeVisible({ timeout: 5000 });

    const modalAfterDelete = ownerPage.locator(
      '[data-testid="task-detail-modal"]'
    );
    await modalAfterDelete.waitFor({ state: "hidden", timeout: 5000 });

    const workspaceIdMatch = ownerPage.url().match(WORKSPACE_ID_REGEX);
    const workspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;
    expect(workspaceId).toBeTruthy();

    if (workspaceId) {
      await ownerPage.waitForFunction(
        () => {
          const store = document.querySelector('[data-testid="kanban-store"]');
          return store?.getAttribute("data-sync-status") === "synced";
        },
        null,
        { timeout: 15_000 }
      );

      const verification = await verifyServerClientStateMatch(
        ownerPage,
        workspaceId
      );
      assertServerClientMatch(verification);
    }
  });
});
