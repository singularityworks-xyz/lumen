import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedDevicePage,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import { waitForConnectionState } from "../helpers/waits";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
} from "../lib/normalized-state";

async function cleanupPages(pages: Page[]) {
  const closedContexts = new Set<ReturnType<Page["context"]>>();

  for (const page of pages) {
    let context: ReturnType<Page["context"]>;
    try {
      context = page.context();
    } catch {
      continue;
    }

    if (closedContexts.has(context)) {
      continue;
    }

    closedContexts.add(context);

    try {
      await context.close();
    } catch {
      // Context may already be closed in teardown race paths.
    }
  }
}

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
            setCurrentWorkspace?: (nextWorkspaceId: string | null) => void;
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

async function openSharedWorkspaceOnNewDevice(
  page: Page,
  shareLink: string
): Promise<void> {
  const shareToken = new URL(shareLink).searchParams.get("share");
  if (!shareToken) {
    throw new Error("Share link is missing share token");
  }

  await page.goto(shareLink);
  await waitForAppReady(page);

  const joinResult = await joinWorkspaceFromShareToken(page, shareToken);
  if (!joinResult.ok) {
    throw new Error(
      `Failed to join shared workspace from new device (status=${joinResult.status})`
    );
  }

  if (!joinResult.workspaceId) {
    throw new Error("Share join response missing workspaceId");
  }

  await setCurrentWorkspaceById(page, joinResult.workspaceId);
  await waitForConnectionState(
    page,
    "sync-status-indicator",
    "connected",
    20_000
  );
}

test.describe("E2E-NEW-DEVICE: Workspace Sync Restoration on New Device", () => {
  test.describe.configure({ timeout: 180_000 });

  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
    shareLink = setup.shareLink;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("single workspace restores from DB when no peers online", async ({
    browser,
  }) => {
    // Owner creates a board with a column and task
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Restore Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Restore Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Restore Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    // Verify task exists on owner page
    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Restore Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    // Wait for persistence (debounce is 5s)
    await ownerPage.waitForTimeout(7000);

    // Close both pages to drop active room connections.
    await ownerPage.close();
    await editorPage.close();

    const { context: newDeviceContext, page: newDevicePage } =
      await createAuthenticatedDevicePage(browser);

    try {
      await openSharedWorkspaceOnNewDevice(newDevicePage, shareLink);

      // Verify the board is visible
      await newDevicePage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });

      // Verify the column and task restored from DB
      const restoredColumn = newDevicePage.locator(
        '[data-testid="kanban-column"]:has-text("Restore Column")'
      );
      await expect(restoredColumn).toBeVisible({ timeout: 15_000 });

      const restoredTask = newDevicePage.locator(
        '[data-testid="task-card"]:has-text("Restore Task")'
      );
      await expect(restoredTask).toBeVisible({ timeout: 10_000 });

      const snapshot = await captureNormalizedSnapshot(newDevicePage);
      assertNoOrphans(snapshot);
    } finally {
      await newDeviceContext.close();
    }
  });

  test("restore works after server room cleanup (no peers)", async ({
    browser,
  }) => {
    // Owner creates content
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Cleanup Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Cleanup Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Cleanup Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Cleanup Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    // Wait for persistence
    await ownerPage.waitForTimeout(7000);

    // Both devices disconnect - room cleanup triggers after 30s
    await ownerPage.close();
    await editorPage.close();

    // Wait for room cleanup timeout (30s + buffer)
    await new Promise((resolve) => setTimeout(resolve, 35_000));

    const { context: newDeviceContext, page: newDevicePage } =
      await createAuthenticatedDevicePage(browser);

    try {
      await openSharedWorkspaceOnNewDevice(newDevicePage, shareLink);

      // Verify content restored from DB after room was cleaned up
      const restoredColumn = newDevicePage.locator(
        '[data-testid="kanban-column"]:has-text("Cleanup Column")'
      );
      await expect(restoredColumn).toBeVisible({ timeout: 15_000 });

      const restoredTask = newDevicePage.locator(
        '[data-testid="task-card"]:has-text("Cleanup Task")'
      );
      await expect(restoredTask).toBeVisible({ timeout: 10_000 });
    } finally {
      await newDeviceContext.close();
    }
  });

  test("hybrid: peer online then offline, new device restores from DB", async ({
    browser,
  }) => {
    // Editor verifies board exists (peer is online, room is in memory)
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // Owner adds content while editor is watching
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Hybrid Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    // Editor should see the column
    const editorColumn = editorPage.locator(
      '[data-testid="kanban-column"]:has-text("Hybrid Column")'
    );
    await expect(editorColumn).toBeVisible({ timeout: 10_000 });

    // Wait for persistence
    await ownerPage.waitForTimeout(7000);

    // Close last in-memory peers so new device must restore from DB
    await editorPage.close();
    await ownerPage.close();

    const { context: newDeviceContext, page: newDevicePage } =
      await createAuthenticatedDevicePage(browser);

    try {
      await openSharedWorkspaceOnNewDevice(newDevicePage, shareLink);

      // Verify the column exists on the new device
      // (owner still has room in memory, so this tests peer sync works)
      const newDeviceColumn = newDevicePage.locator(
        '[data-testid="kanban-column"]:has-text("Hybrid Column")'
      );
      await expect(newDeviceColumn).toBeVisible({ timeout: 15_000 });
    } finally {
      await newDeviceContext.close();
    }
  });
});
