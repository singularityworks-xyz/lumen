import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addCommentViaStore,
  addTaskViaStore,
  getCommentContentById,
  getTaskIdByTitle,
  getTaskTitleById,
  updateCommentContentViaStore,
  updateTaskTitleViaStore,
} from "../helpers/store";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

// Top-level regex patterns for performance
const CONFLICT_TITLE_REGEX = /Owner Conflict Title|Editor Conflict Title/;
const PERSISTED_COMMENT_REGEX =
  /Owner persisted comment|Editor persisted comment/;
const COMMENT_VERSION_REGEX = /Owner comment version|Editor comment version/;

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
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
    await addColumnToFirstBoardViaStore(ownerPage, "Conflict Column");
    await addTaskViaStore(ownerPage, "Conflict Column", "Original Title");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Original Title");
    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Owner Conflict Title"),
      updateTaskTitleViaStore(editorPage, taskId, "Editor Conflict Title"),
    ]);

    await expect
      .poll(async () => {
        const ownerTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTitle = await getTaskTitleById(editorPage, taskId);
        if (!(ownerTitle && editorTitle)) {
          return null;
        }

        return ownerTitle === editorTitle ? ownerTitle : null;
      })
      .toMatch(CONFLICT_TITLE_REGEX);

    const expectedTitle = await getTaskTitleById(ownerPage, taskId);
    expect(expectedTitle).toBeTruthy();

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await expect
      .poll(async () => {
        const ownerTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTitle = await getTaskTitleById(editorPage, taskId);
        return ownerTitle === editorTitle && ownerTitle === expectedTitle;
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);
    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);
    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });

  test("comment edits conflict persists after reload", async () => {
    const commentId = await addCommentViaStore(
      ownerPage,
      "Comment for persistence test"
    );

    await expect
      .poll(async () => getCommentContentById(editorPage, commentId), {
        timeout: 10_000,
      })
      .toBe("Comment for persistence test");

    await Promise.all([
      updateCommentContentViaStore(
        ownerPage,
        commentId,
        "Owner persisted comment"
      ),
      updateCommentContentViaStore(
        editorPage,
        commentId,
        "Editor persisted comment"
      ),
    ]);

    await expect
      .poll(async () => {
        const ownerComment = await getCommentContentById(ownerPage, commentId);
        const editorComment = await getCommentContentById(
          editorPage,
          commentId
        );
        if (!(ownerComment && editorComment)) {
          return null;
        }

        return ownerComment === editorComment ? ownerComment : null;
      })
      .toMatch(PERSISTED_COMMENT_REGEX);

    const expectedComment = await getCommentContentById(ownerPage, commentId);
    expect(expectedComment).toBeTruthy();

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await expect
      .poll(async () => {
        const ownerComment = await getCommentContentById(ownerPage, commentId);
        const editorComment = await getCommentContentById(
          editorPage,
          commentId
        );
        return (
          ownerComment === editorComment && ownerComment === expectedComment
        );
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    assertNoOrphans(ownerSnapshot);
  });

  test("multiple rapid edits persist after reload", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Rapid Column");
    await addTaskViaStore(ownerPage, "Rapid Column", "Rapid Task");

    const taskId = await getTaskIdByTitle(ownerPage, "Rapid Task");
    for (let i = 0; i < 5; i++) {
      await updateTaskTitleViaStore(ownerPage, taskId, `Rapid Edit ${i}`);
      await ownerPage.waitForTimeout(100);
    }

    await expect
      .poll(async () => {
        const ownerTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTitle = await getTaskTitleById(editorPage, taskId);
        if (!(ownerTitle && editorTitle)) {
          return null;
        }

        return ownerTitle === editorTitle ? ownerTitle : null;
      })
      .toContain("Rapid Edit");

    const finalTitleBeforeReload = await getTaskTitleById(ownerPage, taskId);
    expect(finalTitleBeforeReload).toContain("Rapid Edit");

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await expect
      .poll(async () => {
        const ownerTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTitle = await getTaskTitleById(editorPage, taskId);
        return (
          ownerTitle === editorTitle && ownerTitle === finalTitleBeforeReload
        );
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);
    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);
    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });

  test("conflicting task and comment edits persist after reload", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Mixed Column");
    await addTaskViaStore(ownerPage, "Mixed Column", "Mixed Task");

    const taskId = await getTaskIdByTitle(ownerPage, "Mixed Task");
    await updateTaskTitleViaStore(ownerPage, taskId, "Owner Task Edit");

    const commentId = await addCommentViaStore(
      ownerPage,
      "Mixed conflict comment"
    );
    await expect
      .poll(async () => getCommentContentById(editorPage, commentId), {
        timeout: 10_000,
      })
      .toBe("Mixed conflict comment");

    await Promise.all([
      updateCommentContentViaStore(
        ownerPage,
        commentId,
        "Owner comment version"
      ),
      updateCommentContentViaStore(
        editorPage,
        commentId,
        "Editor comment version"
      ),
    ]);

    await expect
      .poll(async () => {
        const ownerComment = await getCommentContentById(ownerPage, commentId);
        const editorComment = await getCommentContentById(
          editorPage,
          commentId
        );
        if (!(ownerComment && editorComment)) {
          return null;
        }

        return ownerComment === editorComment ? ownerComment : null;
      })
      .toMatch(COMMENT_VERSION_REGEX);

    const expectedTaskTitle = await getTaskTitleById(ownerPage, taskId);
    const expectedComment = await getCommentContentById(ownerPage, commentId);
    expect(expectedTaskTitle).toBeTruthy();
    expect(expectedComment).toBeTruthy();

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await expect
      .poll(async () => {
        const ownerTaskTitle = await getTaskTitleById(ownerPage, taskId);
        const editorTaskTitle = await getTaskTitleById(editorPage, taskId);
        return (
          ownerTaskTitle === editorTaskTitle &&
          ownerTaskTitle === expectedTaskTitle
        );
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const ownerComment = await getCommentContentById(ownerPage, commentId);
        const editorComment = await getCommentContentById(
          editorPage,
          commentId
        );
        return (
          ownerComment === editorComment && ownerComment === expectedComment
        );
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);
    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);
    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });
});
