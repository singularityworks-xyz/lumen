import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  getStoreState,
  setupTwoUsers,
  waitForAppReady,
} from "./helpers/commands";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-22: Persisted Reload After Conflict-Heavy Session", () => {
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

  test("task title conflict persists correctly after reload", async () => {
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
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Original Title");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

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

    await ownerTitleInput.fill("Owner Conflict Title");
    await editorTitleInput.fill("Editor Conflict Title");

    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(2000);

    const ownerFinalTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const editorFinalTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(ownerFinalTitle).toBe(editorFinalTitle);
    const expectedTitle =
      ownerFinalTitle === "Owner Conflict Title"
        ? "Owner Conflict Title"
        : "Editor Conflict Title";

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

    const ownerStoreState = await getStoreState(ownerPage);
    const editorStoreState = await getStoreState(editorPage);

    const persistedOwnerTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const persistedEditorTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(persistedOwnerTitle).toBe(expectedTitle);
    expect(persistedEditorTitle).toBe(expectedTitle);
    expect(persistedOwnerTitle).toBe(persistedEditorTitle);

    expect(ownerStoreState).not.toBeNull();
    expect(editorStoreState).not.toBeNull();
  });

  test("comment edits conflict persists after reload", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await expect(commentsDrawerTrigger).toBeVisible();
    await commentsDrawerTrigger.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.fill("Comment for persistence test");
    await ownerPage.click('[data-testid="submit-comment"]');
    await ownerPage.waitForTimeout(1000);

    const ownerComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Comment for persistence test")'
    );
    await ownerComment.waitFor({ state: "visible", timeout: 5000 });

    await editorPage
      .locator(
        '[data-testid="comment"]:has-text("Comment for persistence test")'
      )
      .waitFor({ state: "visible", timeout: 5000 });

    const ownerEditButton = ownerComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await ownerEditButton.click();
    await ownerPage.waitForSelector('[data-testid="comment-edit-input"]');

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Comment for persistence test")'
    );
    const editorEditButton = editorComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await editorEditButton.click();
    await editorPage.waitForSelector('[data-testid="comment-edit-input"]');

    await ownerPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Owner persisted comment");
    await editorPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Editor persisted comment");

    await ownerPage.click('[data-testid="comment-save-edit"]');
    await editorPage.click('[data-testid="comment-save-edit"]');
    await ownerPage.waitForTimeout(2000);

    const finalOwnerComment = await ownerComment.textContent();
    const finalEditorComment = await editorComment.textContent();

    expect(finalOwnerComment).toBe(finalEditorComment);
    const expectedComment =
      finalOwnerComment === "Owner persisted comment"
        ? "Owner persisted comment"
        : "Editor persisted comment";

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const commentsDrawerAfterReload = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await commentsDrawerAfterReload.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const persistedOwnerComment = ownerPage.locator(
      `[data-testid="comment"]:has-text("${expectedComment}")`
    );
    await expect(persistedOwnerComment).toBeVisible({ timeout: 5000 });

    const ownerStoreState = await getStoreState(ownerPage);
    expect(ownerStoreState).not.toBeNull();
  });

  test("multiple rapid edits persist after reload", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Rapid Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Rapid Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Rapid Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

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
    await ownerPage.waitForTimeout(1000);

    const finalTitleBeforeReload = await ownerPage
      .locator('[data-testid="task-card"]:has-text("Rapid Edit")')
      .textContent();

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

    const finalTitleAfterReload = await ownerPage
      .locator('[data-testid="task-card"]:has-text("Rapid Edit")')
      .textContent();

    expect(finalTitleAfterReload).toBe(finalTitleBeforeReload);
    expect(finalTitleAfterReload).toContain("Rapid Edit");

    const ownerStoreState = await getStoreState(ownerPage);
    const editorStoreState = await getStoreState(editorPage);

    expect(ownerStoreState).not.toBeNull();
    expect(editorStoreState).not.toBeNull();
  });

  test("conflicting task and comment edits persist after reload", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Mixed Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Mixed Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Mixed Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Mixed Task")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Mixed Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await taskCard.click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');
    await ownerPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Owner Task Edit");
    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(500);

    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await commentsDrawerTrigger.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .fill("Mixed conflict comment");
    await ownerPage.click('[data-testid="submit-comment"]');
    await ownerPage.waitForTimeout(1000);

    const ownerComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Mixed conflict comment")'
    );
    await ownerComment.waitFor({ state: "visible", timeout: 5000 });

    await editorPage
      .locator('[data-testid="comment"]:has-text("Mixed conflict comment")')
      .waitFor({ state: "visible", timeout: 5000 });

    const ownerEditButton = ownerComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await ownerEditButton.click();
    await ownerPage.waitForSelector('[data-testid="comment-edit-input"]');

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Mixed conflict comment")'
    );
    const editorEditButton = editorComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await editorEditButton.click();
    await editorPage.waitForSelector('[data-testid="comment-edit-input"]');

    await ownerPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Owner comment version");
    await editorPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Editor comment version");

    await ownerPage.click('[data-testid="comment-save-edit"]');
    await editorPage.click('[data-testid="comment-save-edit"]');
    await ownerPage.waitForTimeout(2000);

    const finalOwnerTaskTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const finalEditorTaskTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(finalOwnerTaskTitle).toBe(finalEditorTaskTitle);

    const finalOwnerComment = await ownerComment.textContent();
    const finalEditorComment = await editorComment.textContent();

    expect(finalOwnerComment).toBe(finalEditorComment);

    const expectedTaskTitle =
      finalOwnerTaskTitle === "Owner Task Edit"
        ? "Owner Task Edit"
        : finalOwnerTaskTitle;
    const expectedComment =
      finalOwnerComment === "Owner comment version"
        ? "Owner comment version"
        : finalEditorComment;

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

    const persistedOwnerTaskTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const persistedEditorTaskTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(persistedOwnerTaskTitle).toBe(expectedTaskTitle);
    expect(persistedEditorTaskTitle).toBe(expectedTaskTitle);
    expect(persistedOwnerTaskTitle).toBe(persistedEditorTaskTitle);

    const commentsDrawerAfterReload = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await commentsDrawerAfterReload.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const persistedOwnerComment = ownerPage.locator(
      `[data-testid="comment"]:has-text("${expectedComment}")`
    );
    await expect(persistedOwnerComment).toBeVisible({ timeout: 5000 });

    const ownerStoreState = await getStoreState(ownerPage);
    const editorStoreState = await getStoreState(editorPage);

    expect(ownerStoreState).not.toBeNull();
    expect(editorStoreState).not.toBeNull();
  });
});
