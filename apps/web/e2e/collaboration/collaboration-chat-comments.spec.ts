import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  openChatDrawer,
  openCommentsDrawer,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import { waitForCollabSync, waitForConnectionState } from "../helpers/waits";

test.describe("E2E-15: Chat and Comments Sync", () => {
  test.describe.configure({ timeout: 120_000 });

  let ownerPage: Page;
  let editorPage: Page;
  let sharedWorkspaceId: string;
  let sharedWorkspaceToken: string;

  interface JoinWorkspaceResult {
    ok: boolean;
    status: number;
    workspaceId?: string;
  }

  function joinWorkspaceFromShareToken(
    page: Page,
    shareToken: string
  ): Promise<JoinWorkspaceResult> {
    return page.evaluate(async (token) => {
      try {
        const response = await fetch(`/api/share/${token}/join`, {
          method: "POST",
          credentials: "include",
        });

        const payload = (await response.json().catch(() => ({}))) as {
          workspaceId?: string;
        };

        return {
          ok: response.ok,
          status: response.status,
          workspaceId: payload.workspaceId,
        };
      } catch {
        return {
          ok: false,
          status: 0,
        };
      }
    }, shareToken);
  }

  async function setCurrentWorkspaceById(
    page: Page,
    workspaceId: string
  ): Promise<void> {
    const didSetWorkspace = await page.evaluate((id) => {
      const store = (
        window as Window & {
          __KANBAN_STORE__?: {
            getState?: () => {
              currentWorkspaceId?: string | null;
              setCurrentWorkspace?: (workspaceId: string | null) => void;
            };
          };
        }
      ).__KANBAN_STORE__;

      const state = store?.getState?.();
      if (!state || typeof state.setCurrentWorkspace !== "function") {
        return false;
      }

      state.setCurrentWorkspace(id);
      return true;
    }, workspaceId);

    if (!didSetWorkspace) {
      throw new Error("Unable to set current workspace from store");
    }

    await page.waitForFunction(
      (id) => {
        const store = (
          window as Window & {
            __KANBAN_STORE__?: {
              getState?: () => { currentWorkspaceId?: string | null };
            };
          }
        ).__KANBAN_STORE__;

        return store?.getState?.().currentWorkspaceId === id;
      },
      workspaceId,
      { timeout: 10_000 }
    );
  }

  async function ensurePageInSharedWorkspace(
    page: Page,
    shareToken: string
  ): Promise<string> {
    const joinResult = await joinWorkspaceFromShareToken(page, shareToken);
    if (!joinResult.ok) {
      throw new Error(
        `Failed to join shared workspace (status=${joinResult.status})`
      );
    }

    const { workspaceId } = joinResult;
    if (!workspaceId) {
      throw new Error("Joined workspace is missing workspaceId");
    }

    await setCurrentWorkspaceById(page, workspaceId);
    await waitForConnectionState(
      page,
      "sync-status-indicator",
      "connected",
      10_000
    );

    return workspaceId;
  }

  async function ensureBothConnected(): Promise<void> {
    await Promise.all([
      setCurrentWorkspaceById(ownerPage, sharedWorkspaceId),
      setCurrentWorkspaceById(editorPage, sharedWorkspaceId),
    ]);

    await Promise.all([
      waitForConnectionState(
        ownerPage,
        "sync-status-indicator",
        "connected",
        20_000
      ),
      waitForConnectionState(
        editorPage,
        "sync-status-indicator",
        "connected",
        20_000
      ),
    ]);
  }

  async function rejoinSharedWorkspace(page: Page): Promise<void> {
    await ensurePageInSharedWorkspace(page, sharedWorkspaceToken);
    await setCurrentWorkspaceById(page, sharedWorkspaceId);
  }

  function countVisibleByTestIdAndText(
    page: Page,
    testId: string,
    text: string
  ): Promise<number> {
    return page.evaluate(
      ({ lookupTestId, lookupText }) => {
        const isVisible = (element: Element): boolean => {
          const node = element as HTMLElement;
          const style = window.getComputedStyle(node);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
          ) {
            return false;
          }

          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        return Array.from(
          document.querySelectorAll(`[data-testid="${lookupTestId}"]`)
        ).filter(
          (node) =>
            (node.textContent ?? "").includes(lookupText) && isVisible(node)
        ).length;
      },
      { lookupTestId: testId, lookupText: text }
    );
  }

  async function waitForPeerChatMessageVisible(
    page: Page,
    messageText: string
  ): Promise<void> {
    let attempts = 0;

    await expect(async () => {
      attempts += 1;

      await setCurrentWorkspaceById(page, sharedWorkspaceId);

      const switchedToMessageWorkspace = await page.evaluate((targetText) => {
        const store = (
          window as Window & {
            __KANBAN_STORE__?: {
              getState?: () => {
                chatMessages?: {
                  allIds?: string[];
                  byId?: Record<
                    string,
                    { content?: string; workspaceId?: string } | undefined
                  >;
                };
                setCurrentWorkspace?: (workspaceId: string | null) => void;
              };
            };
          }
        ).__KANBAN_STORE__;

        const state = store?.getState?.();
        if (!state || typeof state.setCurrentWorkspace !== "function") {
          return false;
        }

        const allIds = state.chatMessages?.allIds ?? [];
        const byId = state.chatMessages?.byId ?? {};

        for (const id of allIds) {
          const message = byId[id];
          if (
            message?.content?.includes(targetText) &&
            typeof message.workspaceId === "string"
          ) {
            state.setCurrentWorkspace(message.workspaceId);
            return true;
          }
        }

        return false;
      }, messageText);

      if (switchedToMessageWorkspace) {
        await waitForConnectionState(
          page,
          "sync-status-indicator",
          "connected",
          10_000
        );
      }

      if (attempts % 3 === 0) {
        await rejoinSharedWorkspace(page);
      }

      if (attempts % 5 === 0) {
        await page.reload();
        await waitForAppReady(page);
        await waitForConnectionState(
          page,
          "sync-status-indicator",
          "connected",
          20_000
        );
        await setCurrentWorkspaceById(page, sharedWorkspaceId);
      }

      await openChatDrawer(page);
      const visibleCount = await countVisibleByTestIdAndText(
        page,
        "chat-message",
        messageText
      );
      expect(visibleCount).toBeGreaterThan(0);
    }).toPass({ timeout: 120_000, intervals: [500, 1000, 2000] });
  }

  async function waitForPeerCommentNodeVisible(
    page: Page,
    commentText: string
  ): Promise<void> {
    let attempts = 0;

    await expect(async () => {
      attempts += 1;

      await setCurrentWorkspaceById(page, sharedWorkspaceId);

      const switchedToCommentWorkspace = await page.evaluate((targetText) => {
        const store = (
          window as Window & {
            __KANBAN_STORE__?: {
              getState?: () => {
                comments?: {
                  allIds?: string[];
                  byId?: Record<
                    string,
                    { content?: string; workspaceId?: string } | undefined
                  >;
                };
                setCurrentWorkspace?: (workspaceId: string | null) => void;
              };
            };
          }
        ).__KANBAN_STORE__;

        const state = store?.getState?.();
        if (!state || typeof state.setCurrentWorkspace !== "function") {
          return false;
        }

        const allIds = state.comments?.allIds ?? [];
        const byId = state.comments?.byId ?? {};

        for (const id of allIds) {
          const comment = byId[id];
          if (
            comment?.content?.includes(targetText) &&
            typeof comment.workspaceId === "string"
          ) {
            state.setCurrentWorkspace(comment.workspaceId);
            return true;
          }
        }

        return false;
      }, commentText);

      if (switchedToCommentWorkspace) {
        await waitForConnectionState(
          page,
          "sync-status-indicator",
          "connected",
          10_000
        );
      }

      if (attempts % 3 === 0) {
        await rejoinSharedWorkspace(page);
      }

      if (attempts % 4 === 0) {
        await page.reload();
        await waitForAppReady(page);
        await waitForConnectionState(
          page,
          "sync-status-indicator",
          "connected",
          20_000
        );
        await setCurrentWorkspaceById(page, sharedWorkspaceId);
      }

      await openCommentsDrawer(page);

      const [drawerComments, boardCommentNodes] = await Promise.all([
        countVisibleByTestIdAndText(page, "comment", commentText),
        countVisibleByTestIdAndText(page, "comment-node", commentText),
      ]);

      expect(drawerComments + boardCommentNodes).toBeGreaterThan(0);
    }).toPass({ timeout: 120_000, intervals: [500, 1000, 2000] });
  }

  async function waitForPeerCommentNodeHidden(
    page: Page,
    commentText: string
  ): Promise<void> {
    await expect(async () => {
      await setCurrentWorkspaceById(page, sharedWorkspaceId);
      await openCommentsDrawer(page);

      const [drawerComments, boardCommentNodes] = await Promise.all([
        countVisibleByTestIdAndText(page, "comment", commentText),
        countVisibleByTestIdAndText(page, "comment-node", commentText),
      ]);

      expect(drawerComments + boardCommentNodes).toBe(0);
    }).toPass({ timeout: 60_000, intervals: [500, 1000, 2000] });
  }

  async function establishTypingChannel(
    typingPage: Page,
    observingPage: Page
  ): Promise<void> {
    const handshakeText = `typing-handshake-${Date.now()}`;

    await expect(async () => {
      await ensureBothConnected();
      await openChatDrawer(typingPage);

      const chatInput = typingPage.locator('[data-testid="chat-input"]');
      await chatInput.fill(handshakeText);
      await typingPage.click('[data-testid="send-chat-message"]');

      await expect(
        typingPage.locator(
          `[data-testid="chat-message"]:has-text("${handshakeText}")`
        )
      ).toBeVisible({ timeout: 10_000 });

      await waitForPeerChatMessageVisible(observingPage, handshakeText);
    }).toPass({ timeout: 90_000, intervals: [500, 1000, 2000] });
  }

  async function waitForTypingIndicatorVisible(
    typingPage: Page,
    observingPage: Page
  ): Promise<void> {
    await establishTypingChannel(typingPage, observingPage);

    let attempts = 0;

    await expect(async () => {
      attempts += 1;

      await ensureBothConnected();

      if (attempts % 3 === 0) {
        await rejoinSharedWorkspace(observingPage);
      }

      if (attempts % 5 === 0) {
        await observingPage.reload();
        await waitForAppReady(observingPage);
        await rejoinSharedWorkspace(observingPage);
      }

      await openChatDrawer(typingPage);
      await openChatDrawer(observingPage);

      const chatInput = typingPage.locator('[data-testid="chat-input"]');
      const typingIndicator = observingPage.locator(
        '[data-testid="typing-indicator"]'
      );

      await chatInput.fill("");
      await chatInput.focus();

      const probe = `typing-${Date.now()}-${attempts}`;

      await Promise.all([
        typingPage.keyboard.type(probe, { delay: 90 }),
        expect(typingIndicator).toBeVisible({ timeout: 6000 }),
      ]);
    }).toPass({ timeout: 90_000, intervals: [500, 1000, 2000] });
  }

  async function closePageContext(page: Page | undefined): Promise<void> {
    if (!page) {
      return;
    }

    try {
      await page.context().close();
    } catch {
      // Context may already be closed after timeout failures.
    }
  }

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;

    const shareToken = new URL(setup.shareLink).searchParams.get("share");
    if (!shareToken) {
      throw new Error("Missing share token from generated share link");
    }

    const [ownerWorkspaceId, editorWorkspaceId] = await Promise.all([
      ensurePageInSharedWorkspace(ownerPage, shareToken),
      ensurePageInSharedWorkspace(editorPage, shareToken),
    ]);

    expect(editorWorkspaceId).toBe(ownerWorkspaceId);
    sharedWorkspaceId = ownerWorkspaceId;
    sharedWorkspaceToken = shareToken;
  });

  test.afterEach(async () => {
    await closePageContext(ownerPage);
    await closePageContext(editorPage);
  });

  test("comment create appears in peer's view", async () => {
    test.slow();

    await ensureBothConnected();

    await openCommentsDrawer(ownerPage);

    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Test comment from owner");
    await ownerPage.click('[data-testid="submit-comment"]');

    const ownerCommentInDrawer = ownerPage.locator(
      '[data-testid="comment"]:has-text("Test comment from owner")'
    );
    await expect(ownerCommentInDrawer).toBeVisible({ timeout: 10_000 });
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      20_000
    );

    await waitForPeerCommentNodeVisible(editorPage, "Test comment from owner");
  });

  test("chat message send/receive across two users", async () => {
    test.slow();

    await ensureBothConnected();

    await openChatDrawer(ownerPage);

    const chatInput = ownerPage.locator('[data-testid="chat-input"]');
    await chatInput.fill("Hello from owner");
    await ownerPage.click('[data-testid="send-chat-message"]');

    await waitForPeerChatMessageVisible(editorPage, "Hello from owner");

    const editorMessage = editorPage.locator(
      '[data-testid="chat-message"]:has-text("Hello from owner")'
    );
    await expect(editorMessage).toBeVisible({ timeout: 20_000 });
  });

  test("typing indicator visibility in chat", async () => {
    test.slow();

    await ensureBothConnected();

    await waitForTypingIndicatorVisible(ownerPage, editorPage);
  });

  test("comment persistence after reload", async () => {
    await ensureBothConnected();

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
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      20_000
    );
    await openCommentsDrawer(ownerPage);

    const persistedComment = ownerPage.locator(
      '[data-testid="comment"]:has-text("Persistent comment")'
    );
    await expect(persistedComment).toBeVisible({ timeout: 10_000 });
  });

  test("rapid message ordering correctness", async () => {
    await ensureBothConnected();

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
    test.slow();

    await ensureBothConnected();

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

    await expect(
      ownerPage.locator(
        '[data-testid="comment"]:has-text("Edited comment text")'
      )
    ).toBeVisible({ timeout: 10_000 });

    // Wait for edited comment to sync to peer's view
    await waitForPeerCommentNodeVisible(editorPage, "Edited comment text");
  });

  test("delete comment removes from peer's view", async () => {
    await ensureBothConnected();

    await openCommentsDrawer(ownerPage);
    const newCommentInput = ownerPage.locator(
      '[data-testid="new-comment-input"]'
    );
    await expect(newCommentInput).toBeVisible();
    await newCommentInput.fill("Comment to delete");
    await ownerPage.click('[data-testid="submit-comment"]');
    // Wait for comment to sync to both pages
    await waitForCollabSync(ownerPage, "comment", "Comment to delete");
    await waitForPeerCommentNodeVisible(editorPage, "Comment to delete");

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
      await waitForPeerCommentNodeHidden(editorPage, "Comment to delete");
    }
  });

  test("mention rendering in comments with @ symbol", async () => {
    await ensureBothConnected();

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
