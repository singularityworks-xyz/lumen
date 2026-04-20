import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  setCurrentWorkspaceFromStore,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  getCommentContentById,
  getCommentIdByContent,
  getCurrentWorkspaceIdViaStore,
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
  test.describe.configure({ timeout: 90_000 });

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

  async function ensureAlignedWorkspace(): Promise<void> {
    const ownerWorkspaceId = await getCurrentWorkspaceIdViaStore(ownerPage);
    if (!ownerWorkspaceId) {
      return;
    }

    await setCurrentWorkspaceFromStore(ownerPage, ownerWorkspaceId);
    await setCurrentWorkspaceFromStore(editorPage, ownerWorkspaceId);

    await expect
      .poll(async () => {
        const ownerCurrent = await getCurrentWorkspaceIdViaStore(ownerPage);
        const editorCurrent = await getCurrentWorkspaceIdViaStore(editorPage);
        return (
          ownerCurrent === ownerWorkspaceId &&
          editorCurrent === ownerWorkspaceId
        );
      })
      .toBe(true);
  }

  async function createCommentFromOwnerViaUi(content: string): Promise<string> {
    await ensureAlignedWorkspace();

    await ownerPage.locator('[data-testid="comments-drawer-trigger"]').click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 10_000 });
    await ownerPage.locator('[data-testid="new-comment-input"]').fill(content);
    await ownerPage.click('[data-testid="submit-comment"]');

    await expect
      .poll(async () => getCommentIdByContent(ownerPage, content), {
        timeout: 10_000,
      })
      .not.toBeNull();
    await expect
      .poll(async () => getCommentIdByContent(editorPage, content), {
        timeout: 10_000,
      })
      .not.toBeNull();

    const commentId = await getCommentIdByContent(ownerPage, content);
    if (!commentId) {
      throw new Error(`Unable to resolve comment id for content: ${content}`);
    }

    return commentId;
  }

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
    const commentId = await createCommentFromOwnerViaUi(
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

    const commentId = await createCommentFromOwnerViaUi(
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
