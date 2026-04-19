import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  openCommentsDrawer,
  setCurrentWorkspaceFromStore,
  setupTwoUsers,
} from "../helpers/commands";
import {
  getCommentContentById,
  getCommentIdByContent,
  getCurrentWorkspaceIdViaStore,
  removeCommentByIdViaStore,
  updateCommentContentViaStore,
} from "../helpers/store";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

test.describe("E2E-19: Conflict - Comment Edit vs Delete", () => {
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
    await openCommentsDrawer(ownerPage);
    await openCommentsDrawer(editorPage);

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

  test("user A edits comment while user B deletes it - graceful handling", async () => {
    const originalContent = "Comment to be deleted during edit";
    const editedContent = "Trying to edit deleted comment";
    const commentId = await createCommentFromOwnerViaUi(originalContent);

    await expect
      .poll(async () => getCommentContentById(editorPage, commentId), {
        timeout: 10_000,
      })
      .toBe(originalContent);

    await Promise.all([
      updateCommentContentViaStore(ownerPage, commentId, editedContent),
      removeCommentByIdViaStore(editorPage, commentId),
    ]);

    await expect
      .poll(
        async () => {
          const ownerContent = await getCommentContentById(
            ownerPage,
            commentId
          );
          const editorContent = await getCommentContentById(
            editorPage,
            commentId
          );

          if (ownerContent !== editorContent) {
            return false;
          }

          return ownerContent === null || ownerContent === editedContent;
        },
        { timeout: 10_000 }
      )
      .toBe(true);
  });

  test("user A opens comment edit while user B edits the same comment", async () => {
    const commentId = await createCommentFromOwnerViaUi(
      "Simultaneous edit comment"
    );

    await expect
      .poll(async () => getCommentContentById(editorPage, commentId), {
        timeout: 10_000,
      })
      .toBe("Simultaneous edit comment");

    await Promise.all([
      updateCommentContentViaStore(ownerPage, commentId, "Owner version"),
      updateCommentContentViaStore(editorPage, commentId, "Editor version"),
    ]);

    await expect
      .poll(
        async () => {
          const ownerFinalComment = await getCommentContentById(
            ownerPage,
            commentId
          );
          const editorFinalComment = await getCommentContentById(
            editorPage,
            commentId
          );
          if (!(ownerFinalComment && editorFinalComment)) {
            return false;
          }

          return ownerFinalComment === editorFinalComment;
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    const finalOwnerComment = await getCommentContentById(ownerPage, commentId);
    const finalEditorComment = await getCommentContentById(
      editorPage,
      commentId
    );
    expect(finalOwnerComment).toBe(finalEditorComment);
    expect(
      finalOwnerComment === "Owner version" ||
        finalOwnerComment === "Editor version"
    ).toBeTruthy();
  });

  test("comment edit persists after rapid succession of edits", async () => {
    const commentId = await createCommentFromOwnerViaUi(
      "Rapid comment edit test"
    );
    for (let i = 0; i < 5; i++) {
      await updateCommentContentViaStore(
        ownerPage,
        commentId,
        `Rapid edit ${i}`
      );
      await ownerPage.waitForTimeout(50);
    }

    await expect
      .poll(
        async () => {
          const ownerContent = await getCommentContentById(
            ownerPage,
            commentId
          );
          const editorContent = await getCommentContentById(
            editorPage,
            commentId
          );
          if (!(ownerContent && editorContent)) {
            return null;
          }

          return ownerContent === editorContent ? ownerContent : null;
        },
        { timeout: 20_000 }
      )
      .toContain("Rapid edit");
  });
});
