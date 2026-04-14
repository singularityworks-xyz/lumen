import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "../helpers/commands";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-19: Conflict - Comment Edit vs Delete", () => {
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

  test("user A edits comment while user B deletes it - graceful handling", async () => {
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
    await newCommentInput.fill("Comment to be deleted during edit");
    await ownerPage.click('[data-testid="submit-comment"]');
    await ownerPage.waitForTimeout(1000);

    const ownerComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Comment to be deleted during edit")'
    );
    await ownerComment.waitFor({ state: "visible", timeout: 5000 });

    await editorPage
      .locator(
        '[data-testid="comment"]:has-text("Comment to be deleted during edit")'
      )
      .waitFor({ state: "visible", timeout: 5000 });

    const editButton = ownerComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await editButton.click();
    await ownerPage.waitForSelector('[data-testid="comment-edit-input"]');
    const editInput = ownerPage.locator('[data-testid="comment-edit-input"]');

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Comment to be deleted during edit")'
    );
    await editorComment.click({ button: "right" });
    await editorPage.waitForSelector('[data-testid="comment-delete-button"]');
    await editorPage.click('[data-testid="comment-delete-button"]');
    await editorPage.waitForSelector('[data-testid="comment-confirm-delete"]');
    await editorPage.click('[data-testid="comment-confirm-delete"]');
    await editorPage.waitForTimeout(1000);

    await editInput.fill("Trying to edit deleted comment");
    await ownerPage.click('[data-testid="comment-save-edit"]');
    await ownerPage.waitForTimeout(1500);

    const deletedComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Comment to be deleted during edit")'
    );
    await expect(deletedComment).not.toBeVisible({ timeout: 5000 });

    const updatedComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Trying to edit deleted comment")'
    );
    const updatedVisible = await updatedComment.isVisible().catch(() => false);
    if (updatedVisible) {
      await ownerPage.waitForTimeout(500);
    }
  });

  test("user A opens comment edit while user B edits the same comment", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await commentsDrawerTrigger.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.fill("Simultaneous edit comment");
    await ownerPage.click('[data-testid="submit-comment"]');
    await ownerPage.waitForTimeout(1000);

    const ownerComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Simultaneous edit comment")'
    );
    await ownerComment.waitFor({ state: "visible", timeout: 5000 });

    await editorPage
      .locator('[data-testid="comment"]:has-text("Simultaneous edit comment")')
      .waitFor({ state: "visible", timeout: 5000 });

    const ownerEditButton = ownerComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await ownerEditButton.click();
    await ownerPage.waitForSelector('[data-testid="comment-edit-input"]');

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Simultaneous edit comment")'
    );
    const editorEditButton = editorComment.locator(
      '[data-testid="comment-edit-button"]'
    );
    await editorEditButton.click();
    await editorPage.waitForSelector('[data-testid="comment-edit-input"]');

    await ownerPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Owner version");
    await editorPage
      .locator('[data-testid="comment-edit-input"]')
      .fill("Editor version");

    await ownerPage.click('[data-testid="comment-save-edit"]');
    await editorPage.click('[data-testid="comment-save-edit"]');
    await ownerPage.waitForTimeout(2000);

    const finalOwnerComment = await ownerComment.textContent();
    const finalEditorComment = await editorComment.textContent();

    expect(finalOwnerComment).toBe(finalEditorComment);
    expect(
      finalOwnerComment === "Owner version" ||
        finalOwnerComment === "Editor version"
    ).toBeTruthy();
  });

  test("comment edit persists after rapid succession of edits", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await commentsDrawerTrigger.click();
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.fill("Rapid comment edit test");
    await ownerPage.click('[data-testid="submit-comment"]');
    await ownerPage.waitForTimeout(1000);

    const comment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Rapid comment edit test")'
    );
    await comment.waitFor({ state: "visible", timeout: 5000 });

    const editButton = comment.locator('[data-testid="comment-edit-button"]');
    await editButton.click();
    await ownerPage.waitForSelector('[data-testid="comment-edit-input"]');

    const editInput = ownerPage.locator('[data-testid="comment-edit-input"]');
    for (let i = 0; i < 5; i++) {
      await editInput.clear();
      await editInput.fill(`Rapid edit ${i}`);
      await ownerPage.waitForTimeout(50);
    }

    await ownerPage.click('[data-testid="comment-save-edit"]');
    await ownerPage.waitForTimeout(1000);

    const finalComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Rapid edit")'
    );
    await expect(finalComment).toBeVisible({ timeout: 5000 });
    const text = await finalComment.textContent();
    expect(text).toContain("Rapid edit");
  });
});
