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

test.describe("E2E-16: Conflict - Simultaneous Task Title Edits", () => {
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

  test("two users editing same task title simultaneously produces deterministic final state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Conflict Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForSelector(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Original Title");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForSelector(
      '[data-testid="task-card"]:has-text("Original Title")'
    );

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Original Title")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    const ownerEditButton = ownerPage.locator(
      '[data-testid="task-detail-edit-button"]'
    );
    await ownerEditButton.click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');
    const ownerTitleInput = ownerPage.locator(
      '[data-testid="task-detail-title-input"]'
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .click();
    await editorPage.waitForSelector('[data-testid="task-detail-modal"]');
    const editorEditButton = editorPage.locator(
      '[data-testid="task-detail-edit-button"]'
    );
    await editorEditButton.click();
    await editorPage.waitForSelector('[data-testid="task-detail-title-input"]');
    const editorTitleInput = editorPage.locator(
      '[data-testid="task-detail-title-input"]'
    );

    await ownerTitleInput.fill("Owner Title Edit");
    await editorTitleInput.fill("Editor Title Edit");

    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.click('[data-testid="task-detail-save-button"]');

    // Wait for the modal to close and the final state to converge on both clients
    await ownerPage
      .locator('[data-testid="task-detail-modal"]')
      .waitFor({ state: "hidden", timeout: 10_000 });
    await editorPage
      .locator('[data-testid="task-detail-modal"]')
      .waitFor({ state: "hidden", timeout: 10_000 });

    const ownerFinalTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const editorFinalTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(ownerFinalTitle).toBe(editorFinalTitle);
    expect(
      ownerFinalTitle === "Owner Title Edit" ||
        ownerFinalTitle === "Editor Title Edit"
    ).toBeTruthy();

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

  test("rapid successive edits converge to single value", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Rapid Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForSelector(
      '[data-testid="kanban-column"]:has-text("Rapid Column")'
    );

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Rapid Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Rapid Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForSelector(
      '[data-testid="task-card"]:has-text("Rapid Task")'
    );

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Rapid Task")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');

    for (let i = 0; i < 5; i++) {
      await ownerPage
        .locator('[data-testid="task-detail-title-input"]')
        .fill(`Rapid Edit ${i}`);
      await ownerPage.waitForTimeout(100);
    }

    await ownerPage.click('[data-testid="task-detail-save-button"]');

    await ownerPage
      .locator('[data-testid="task-detail-modal"]')
      .waitFor({ state: "hidden", timeout: 10_000 });

    const finalTitle = await ownerPage
      .locator('[data-testid="task-card"]:has-text("Rapid Edit")')
      .textContent();
    expect(finalTitle).toContain("Rapid Edit");

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
