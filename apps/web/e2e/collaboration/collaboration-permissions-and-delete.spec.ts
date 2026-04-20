import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  deleteWorkspace,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";
import { waitForConnectionState } from "../helpers/waits";

const SAVE_AS_LOCAL_REGEX = /save as local workspace/i;

async function deleteCurrentWorkspaceReliable(page: Page): Promise<void> {
  const deletedViaStore = await page
    .evaluate(async () => {
      interface KanbanState {
        currentWorkspaceId?: string | null;
        deleteWorkspace?: (workspaceId: string) => Promise<boolean> | boolean;
        workspaces?: {
          allIds?: string[];
        };
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        return false;
      }

      const state = store.getState();
      if (typeof state.deleteWorkspace !== "function") {
        return false;
      }

      const workspaceId =
        state.currentWorkspaceId ?? state.workspaces?.allIds?.[0] ?? null;

      if (!workspaceId) {
        return false;
      }

      const deleted = await state.deleteWorkspace(workspaceId);
      return deleted === true;
    })
    .catch(() => false);

  if (!deletedViaStore) {
    await deleteWorkspace(page);
  }
}

test.describe("E2E-12: Collaboration Permissions and Delete", () => {
  let ownerPage: Page;
  let viewerPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const viewerContext = await browser.newContext();

    ownerPage = await ownerContext.newPage();
    viewerPage = await viewerContext.newPage();

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

    await clearLocalStorageAndIndexedDB(viewerPage);
    await disableAnimations(viewerPage);
    await viewerPage.goto("/");
    await waitForAppReady(viewerPage);

    shareLink = await createShareLinkForFirstBoard(ownerPage);
  });

  test.afterEach(async () => {
    if (ownerPage) {
      await ownerPage.close();
    }
    if (viewerPage) {
      await viewerPage.close();
    }
  });

  test("collaborator can perform write actions through collaboration channel", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const newBoardButton = viewerPage.locator(
      '[data-testid="new-board-button"]'
    );
    await expect(newBoardButton).toBeEnabled({ timeout: 5000 });

    const boardNode = viewerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await expect(addColumnTrigger).toBeEnabled({ timeout: 5000 });
  });

  test("workspace delete shows deleted banner to connected peer", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteCurrentWorkspaceReliable(ownerPage);

    const deletedBanner = viewerPage.getByText("Workspace Deleted by Owner");
    await deletedBanner.waitFor({ state: "visible", timeout: 10_000 });
    await expect(deletedBanner).toBeVisible();
  });

  test("connected peer disconnect behavior after workspace delete", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteCurrentWorkspaceReliable(ownerPage);

    await waitForConnectionState(
      viewerPage,
      "sync-status-indicator",
      "disconnected",
      10_000
    );
  });

  test("viewer can still view boards after peer deletes workspace", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const boardsBeforeDelete = await viewerPage
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsBeforeDelete).toBeGreaterThan(0);

    await deleteCurrentWorkspaceReliable(ownerPage);

    const deletedBanner = viewerPage.getByText("Workspace Deleted by Owner");
    await expect(deletedBanner).toBeVisible();

    const boardsAfterDelete = await viewerPage
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardsAfterDelete).toBe(boardsBeforeDelete);
  });

  test("save as local option appears for disconnected peer", async () => {
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await viewerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await deleteCurrentWorkspaceReliable(ownerPage);
  
    const deletedBanner = viewerPage.getByText("Workspace Deleted by Owner");
    await expect(deletedBanner).toBeVisible();

    const saveAsLocalButton = viewerPage.getByRole("button", {
      name: SAVE_AS_LOCAL_REGEX,
    });
    await expect(saveAsLocalButton).toBeVisible({ timeout: 5000 });
  });
});
