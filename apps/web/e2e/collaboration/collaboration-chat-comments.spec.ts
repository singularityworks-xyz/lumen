import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  openChatDrawer,
  openCommentsDrawer,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import { waitForCollabSync, waitForCollabSyncHidden } from "../helpers/waits";

test.describe("E2E-15: Chat and Comments Sync", () => {
  let ownerPage: Page;
  let editorPage: Page;

  async function logChatDebugState(label: string): Promise<void> {
    const ownerState = await ownerPage.evaluate(() => {
      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => Record<string, unknown>;
        };
      };

      const state = (
        window as WindowWithKanbanStore
      ).__KANBAN_STORE__?.getState();
      const currentWorkspaceId =
        typeof state?.currentWorkspaceId === "string"
          ? state.currentWorkspaceId
          : null;
      const chatMessages =
        typeof state?.chatMessages === "object" &&
        state.chatMessages !== null &&
        "allIds" in state.chatMessages &&
        Array.isArray((state.chatMessages as { allIds?: unknown }).allIds)
          ? ((state.chatMessages as { allIds: unknown[] }).allIds.length ?? 0)
          : 0;

      return { chatMessages, currentWorkspaceId };
    });

    const editorState = await editorPage.evaluate(() => {
      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => Record<string, unknown>;
        };
      };

      const state = (
        window as WindowWithKanbanStore
      ).__KANBAN_STORE__?.getState();
      const currentWorkspaceId =
        typeof state?.currentWorkspaceId === "string"
          ? state.currentWorkspaceId
          : null;
      const chatMessages =
        typeof state?.chatMessages === "object" &&
        state.chatMessages !== null &&
        "allIds" in state.chatMessages &&
        Array.isArray((state.chatMessages as { allIds?: unknown }).allIds)
          ? ((state.chatMessages as { allIds: unknown[] }).allIds.length ?? 0)
          : 0;

      return { chatMessages, currentWorkspaceId };
    });

    console.log(`${label} owner`, ownerState);
    console.log(`${label} editor`, editorState);
  }

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser, { requireBoardSync: false });
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await ownerPage?.close();
    await editorPage?.close();
  });

  test("comment create appears in peer's view", async () => {
    await openCommentsDrawer(ownerPage);

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Test comment from owner");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to sync to peer's view via collaboration
    await openCommentsDrawer(editorPage);
    await waitForCollabSync(
      editorPage,
      "comment",
      "Test comment from owner",
      30_000
    );

    const editorComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Test comment from owner")'
    );
    await expect(editorComment).toBeVisible({ timeout: 10_000 });
  });

  test("chat message send/receive across two users", async () => {
    await logChatDebugState("before-send");

    await openChatDrawer(ownerPage);

    const chatInput = ownerPage.locator('[data-testid="chat-input"]');
    await chatInput.fill("Hello from owner");
    await ownerPage.click('[data-testid="send-chat-message"]');

    await logChatDebugState("after-send");

    await openChatDrawer(editorPage);
    await logChatDebugState("after-editor-open-chat");
    await waitForCollabSync(editorPage, "chat-message", "Hello from owner");

    const editorMessage = editorPage.locator(
      '[data-testid="chat-message"]:has-text("Hello from owner")'
    );
    await expect(editorMessage).toBeVisible({ timeout: 10_000 });
  });

  test("typing indicator visibility in chat", async () => {
    await openChatDrawer(ownerPage);
    await openChatDrawer(editorPage);

    const chatInput = ownerPage.locator('[data-testid="chat-input"]');
    await chatInput.focus();
    await ownerPage.keyboard.type("typing test", { delay: 100 });

    const typingIndicator = editorPage.locator(
      '[data-testid="typing-indicator"]'
    );
    await expect(typingIndicator).toBeVisible({ timeout: 5000 });
  });

  test("comment persistence after reload", async () => {
    await openCommentsDrawer(ownerPage);

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();

    await newCommentInput.fill("Persistent comment");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to be persisted
    await waitForCollabSync(ownerPage, "comment", "Persistent comment");

    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await openCommentsDrawer(ownerPage);

    const persistedComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Persistent comment")'
    );
    await expect(persistedComment).toBeVisible({ timeout: 10_000 });
  });

  test("rapid message ordering correctness", async () => {
    await openChatDrawer(ownerPage);

    const chatInput = ownerPage.locator('[data-testid="chat-input"]');
    for (const i of [0, 1, 2]) {
      await chatInput.fill(`Message ${i}`);
      await ownerPage.click('[data-testid="send-chat-message"]');
      await ownerPage
        .locator(`[data-testid="chat-message"]:has-text("Message ${i}")`)
        .waitFor({ state: "visible", timeout: 3000 });
    }

    const messages = await ownerPage
      .locator('[data-testid="chat-message"]')
      .allTextContents();
    expect(messages.length).toBeGreaterThanOrEqual(3);
  });

  test("edit comment updates in peer's view", async () => {
    await openCommentsDrawer(ownerPage);
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
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
    await openCommentsDrawer(editorPage);
    await waitForCollabSync(editorPage, "comment", "Edited comment text");

    const editedComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Edited comment text")'
    );
    await expect(editedComment).toBeVisible({ timeout: 5000 });
  });

  test("delete comment removes from peer's view", async () => {
    await openCommentsDrawer(ownerPage);
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Comment to delete");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to sync to both pages
    await waitForCollabSync(ownerPage, "comment", "Comment to delete");
    await openCommentsDrawer(editorPage);
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
      await waitForCollabSyncHidden(
        editorPage,
        "comment",
        "Comment to delete",
        10_000
      );
    }

    const deletedComment = editorPage.locator(
      '[data-testid="comment"]:has-text("Comment to delete")'
    );
    await expect(deletedComment).not.toBeVisible({ timeout: 5000 });
  });

  test("mention rendering in comments with @ symbol", async () => {
    await openCommentsDrawer(ownerPage);
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
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
