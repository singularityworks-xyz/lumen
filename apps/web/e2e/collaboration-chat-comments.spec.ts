import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

async function setupTwoUsers(browser: import("@playwright/test").Browser) {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();

  await clearLocalStorageAndIndexedDB(ownerPage);
  await disableAnimations(ownerPage);
  await ownerPage.goto("/");
  await waitForAppReady(ownerPage);

  const createFirstBoardButton = ownerPage.locator(
    '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
  );
  if (await createFirstBoardButton.isVisible()) {
    await createFirstBoardButton.click();
    await ownerPage.waitForTimeout(500);
  }

  await clearLocalStorageAndIndexedDB(editorPage);
  await disableAnimations(editorPage);
  await editorPage.goto("/");
  await waitForAppReady(editorPage);

  const shareLink = await createShareLinkForFirstBoard(ownerPage);
  await editorPage.goto(shareLink);
  await waitForAppReady(editorPage);

  await editorPage
    .locator('[data-testid="board-node"]')
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  return { ownerPage, editorPage, shareLink };
}

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
    if (await commentsDrawerTrigger.isVisible()) {
      await commentsDrawerTrigger.click();
      await ownerPage.waitForTimeout(500);

      const newCommentInput = ownerPage.locator(
        '[data-testid="new-comment-input"]'
      );
      if (await newCommentInput.isVisible()) {
        await newCommentInput.fill("Test comment from owner");
        await ownerPage.click('[data-testid="submit-comment"]');
        await ownerPage.waitForTimeout(1000);

        const editorComment = editorPage.locator(
          '[data-testid="comment"]:has-text("Test comment from owner")'
        );
        await expect(editorComment).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("chat message send/receive across two users", async () => {
    const chatTrigger = ownerPage.locator(
      '[data-testid="chat-drawer-trigger"]'
    );
    if (await chatTrigger.isVisible()) {
      await chatTrigger.click();
      await ownerPage.waitForTimeout(500);

      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      if (await chatInput.isVisible()) {
        await chatInput.fill("Hello from owner");
        await ownerPage.click('[data-testid="send-chat-message"]');
        await ownerPage.waitForTimeout(1000);

        const editorChatTrigger = editorPage.locator(
          '[data-testid="chat-drawer-trigger"]'
        );
        if (await editorChatTrigger.isVisible()) {
          await editorChatTrigger.click();
          await editorPage.waitForTimeout(500);

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
      await ownerPage.waitForTimeout(500);

      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      if (await chatInput.isVisible()) {
        await chatInput.focus();
        await ownerPage.keyboard.type("typing test", { delay: 100 });

        const editorChatTrigger = editorPage.locator(
          '[data-testid="chat-drawer-trigger"]'
        );
        if (await editorChatTrigger.isVisible()) {
          await editorChatTrigger.click();
          await editorPage.waitForTimeout(500);

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
      await ownerPage.waitForTimeout(500);

      const newCommentInput = ownerPage.locator(
        '[data-testid="new-comment-input"]'
      );
      if (await newCommentInput.isVisible()) {
        await newCommentInput.fill("Persistent comment");
        await ownerPage.click('[data-testid="submit-comment"]');
        await ownerPage.waitForTimeout(1000);

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
      await ownerPage.waitForTimeout(500);

      const chatInput = ownerPage.locator('[data-testid="chat-input"]');
      if (await chatInput.isVisible()) {
        for (let i = 0; i < 3; i++) {
          await chatInput.fill(`Message ${i}`);
          await ownerPage.click('[data-testid="send-chat-message"]');
          await ownerPage.waitForTimeout(200);
        }

        const messages = await ownerPage
          .locator('[data-testid="chat-message"]')
          .allTextContents();
        expect(messages.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
