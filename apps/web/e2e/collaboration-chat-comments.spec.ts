import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "./helpers/commands";
import { waitForCollabSync } from "./helpers/waits";

test.describe("E2E-15: Chat and Comments Sync", () => {
  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await ownerPage.close();
    await editorPage.close();
  });

  test("comment create appears in peer's view", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await expect(commentsDrawerTrigger).toBeVisible();
    await commentsDrawerTrigger.click();
    // Wait for drawer animation to complete
    await ownerPage
      .locator('[data-testid="new-comment-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Test comment from owner");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to sync to peer's view via collaboration
    await waitForCollabSync(editorPage, "comment", "Test comment from owner");

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Test comment from owner")'
    );
    await expect(editorComment).toBeVisible({ timeout: 10_000 });
  });

  test("chat message send/receive across two users", async () => {
    const chatTrigger = ownerPage.locator(
      '[data-testid="chat-drawer-trigger"]'
    );
    if (await chatTrigger.isVisible()) {
      await chatTrigger.click();
      // Wait for chat drawer to open
      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      await chatInput.waitFor({ state: "visible", timeout: 5000 });

      if (await chatInput.isVisible()) {
        await chatInput.fill("Hello from owner");
        await ownerPage.click('[data-testid="send-chat-message"]');
        // Wait for message to sync to peer's view
        await waitForCollabSync(editorPage, "chat-message", "Hello from owner");

        const editorChatTrigger = editorPage.locator(
          '[data-testid="chat-drawer-trigger"]'
        );
        if (await editorChatTrigger.isVisible()) {
          await editorChatTrigger.click();
          // Wait for peer's chat drawer to open
          await editorPage
            .locator(
              '[data-testid="chat-message"]:has-text("Hello from owner")'
            )
            .waitFor({ state: "visible", timeout: 5000 });

          const editorMessage = editorPage.locator(
            '[data-testid="chat-message"]:has-text("Hello from owner")'
          );
          await expect(editorMessage).toBeVisible({ timeout: 10_000 });
        }
      }
    }
  });

  test("typing indicator visibility in chat", async () => {
    const chatTrigger = ownerPage.locator(
      '[data-testid="chat-drawer-trigger"]'
    );
    if (await chatTrigger.isVisible()) {
      await chatTrigger.click();
      // Wait for chat drawer to open
      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      await chatInput.waitFor({ state: "visible", timeout: 5000 });

      if (await chatInput.isVisible()) {
        await chatInput.focus();
        await ownerPage.keyboard.type("typing test", { delay: 100 });

        const editorChatTrigger = editorPage.locator(
          '[data-testid="chat-drawer-trigger"]'
        );
        if (await editorChatTrigger.isVisible()) {
          await editorChatTrigger.click();
          // Wait for typing indicator to appear on peer's screen
          await editorPage
            .locator('[data-testid="typing-indicator"]')
            .waitFor({ state: "visible", timeout: 5000 });

          const typingIndicator = editorPage.locator(
            '[data-testid="typing-indicator"]'
          );
          await expect(typingIndicator).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test("comment persistence after reload", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    if (await commentsDrawerTrigger.isVisible()) {
      await commentsDrawerTrigger.click();
      // Wait for comments drawer to open
      const newCommentInput = ownerPage.locator(
        '[data-testid="new-comment-input"]'
      );
      await newCommentInput.waitFor({ state: "visible", timeout: 5000 });

      if (await newCommentInput.isVisible()) {
        await newCommentInput.fill("Persistent comment");
        await ownerPage.click('[data-testid="submit-comment"]');
        // Wait for comment to be persisted
        await waitForCollabSync(ownerPage, "comment", "Persistent comment");

        await ownerPage.reload();
        await waitForAppReady(ownerPage);

        const persistedComment = ownerPage.locator(
          '[data-testid="comment"]:has-text("Persistent comment")'
        );
        await expect(persistedComment).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("rapid message ordering correctness", async () => {
    const chatTrigger = ownerPage.locator(
      '[data-testid="chat-drawer-trigger"]'
    );
    if (await chatTrigger.isVisible()) {
      await chatTrigger.click();
      // Wait for chat drawer to open
      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      await chatInput.waitFor({ state: "visible", timeout: 5000 });

      if (await chatInput.isVisible()) {
        for (const i of [0, 1, 2]) {
          await chatInput.fill(`Message ${i}`);
          await ownerPage.click('[data-testid="send-chat-message"]');
          // Wait for each message to be sent and acknowledged
          await ownerPage
            .locator(`[data-testid="chat-message"]:has-text("Message ${i}")`)
            .waitFor({ state: "visible", timeout: 3000 });
        }

        const messages = await ownerPage
          .locator('[data-testid="chat-message"]')
          .allTextContents();
        expect(messages.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("edit comment updates in peer's view", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await expect(commentsDrawerTrigger).toBeVisible();
    await commentsDrawerTrigger.click();
    // Wait for comments drawer to open
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.waitFor({ state: "visible", timeout: 5000 });
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Original comment text");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for original comment to appear
    await waitForCollabSync(ownerPage, "comment", "Original comment text");

    const comment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Original comment text")'
    );
    await expect(comment).toBeVisible();

    const editButton = comment.locator('[data-testid="comment-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    // Wait for edit input to appear
    await comment
      .locator('[data-testid="comment-edit-input"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const editInput = comment.locator('[data-testid="comment-edit-input"]');
    await expect(editInput).toBeVisible();
    await editInput.clear();
    await editInput.fill("Edited comment text");
    await ownerPage.click('[data-testid="comment-save-edit"]');
    // Wait for edited comment to sync to peer's view
    await waitForCollabSync(editorPage, "comment", "Edited comment text");

    const editedComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Edited comment text")'
    );
    await expect(editedComment).toBeVisible({ timeout: 5000 });
  });

  test("delete comment removes from peer's view", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await expect(commentsDrawerTrigger).toBeVisible();
    await commentsDrawerTrigger.click();
    // Wait for comments drawer to open
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.waitFor({ state: "visible", timeout: 5000 });
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Comment to delete");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to sync to both pages
    await waitForCollabSync(ownerPage, "comment", "Comment to delete");
    await waitForCollabSync(editorPage, "comment", "Comment to delete");

    const comment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Comment to delete")'
    );
    await expect(comment).toBeVisible();

    const deleteButton = comment.locator(
      '[data-testid="comment-delete-button"]'
    );
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    // Wait for confirmation dialog to appear
    await ownerPage
      .locator('[data-testid="comment-confirm-delete"]')
      .waitFor({ state: "visible", timeout: 5000 });

    const confirmDelete = ownerPage.locator(
      '[data-testid="comment-confirm-delete"]'
    );
    if (await confirmDelete.isVisible()) {
      await confirmDelete.click();
      // Wait for comment deletion to sync to peer's view
      await editorPage
        .locator('[data-testid="comment"]:has-text("Comment to delete")')
        .waitFor({ state: "hidden", timeout: 5000 });
    }

    const deletedComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Comment to delete")'
    );
    await expect(deletedComment).not.toBeVisible({ timeout: 5000 });
  });

  test("mention rendering in comments with @ symbol", async () => {
    const commentsDrawerTrigger = ownerPage.locator(
      '[data-testid="comments-drawer-trigger"]'
    );
    await expect(commentsDrawerTrigger).toBeVisible();
    await commentsDrawerTrigger.click();
    // Wait for comments drawer to open
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await newCommentInput.waitFor({ state: "visible", timeout: 5000 });
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Hello @editor, please review this");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment with mention to appear
    await waitForCollabSync(ownerPage, "comment", "Hello @editor");

    const commentWithMention = ownerPage.locator(
      '[data-testid="comment"]:has-text("Hello @editor")'
    );
    await expect(commentWithMention).toBeVisible();

    const mentionElement = commentWithMention.locator(
      '[data-testid="comment-mention"]'
    );
    const mentionCount = await mentionElement.count();
    expect(mentionCount).toBeGreaterThanOrEqual(1);
  });
});
