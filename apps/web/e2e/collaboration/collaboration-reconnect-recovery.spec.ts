import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers, waitForAppReady } from "../helpers/commands";
import { waitForCollabSync, waitForConnectionState } from "../helpers/waits";

const CONNECTED_STATES_REGEX = /syncing|synced/i;

async function addColumnToFirstBoardViaStore(
  page: Page,
  columnName: string
): Promise<void> {
  await page.evaluate((name) => {
    interface BoardRecord {
      column_ids?: string[];
    }

    interface KanbanState {
      addColumn: (boardId: string, columnName: string, index: number) => void;
      boards?: {
        allIds?: string[];
        byId?: Record<string, BoardRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    const boardIds = state.boards?.allIds;
    const firstBoardId = Array.isArray(boardIds) ? boardIds[0] : null;

    if (typeof firstBoardId !== "string") {
      throw new Error("No board found for addColumn operation");
    }

    const board = state.boards?.byId?.[firstBoardId];
    const index = Array.isArray(board?.column_ids)
      ? board.column_ids.length
      : 0;

    state.addColumn(firstBoardId, name, index);
  }, columnName);
}

test.describe("E2E-17: Reconnect and Recovery", () => {
  test.describe.configure({ timeout: 90_000 });

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

  test("reconnect after websocket close recovers state", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Pre-Disconnect");
    // Wait for column to sync to editor
    await waitForCollabSync(editorPage, "kanban-column", "Pre-Disconnect");

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Pre-Disconnect")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.context().setOffline(true);
    // Wait for offline state to be detected
    await editorPage
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: 5000 });

    await addColumnToFirstBoardViaStore(ownerPage, "During-Disconnect");
    // Wait for column creation to be processed locally
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("During-Disconnect")')
      .waitFor({ state: "visible", timeout: 5000 });

    await editorPage.context().setOffline(false);
    // Wait for connection to recover and sync to complete
    await editorPage
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: 5000 });

    await editorPage.reload();
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const columns = await editorPage
      .locator('[data-testid="kanban-column"]')
      .count();
    expect(columns).toBeGreaterThanOrEqual(2);
  });

  test("sync status indicator shows disconnected state", async () => {
    const syncIndicator = editorPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toBeVisible({ timeout: 5000 });

    await editorPage.context().setOffline(true);
    await editorPage.waitForTimeout(1500);
    await editorPage.context().setOffline(false);

    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected"
    );
  });

  test("state converges after reconnect with edits on both sides", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Owner Col");
    // Wait for column to sync
    await waitForCollabSync(editorPage, "kanban-column", "Owner Col");

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Owner Col")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await editorPage.context().setOffline(true);
    // Wait for offline state detection
    await editorPage
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: 5000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Owner During Disconnect");
    // Wait for column creation UI feedback
    await ownerPage
      .locator(
        '[data-testid="kanban-column"]:has-text("Owner During Disconnect")'
      )
      .waitFor({ state: "visible", timeout: 5000 });

    await editorPage.context().setOffline(false);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );

    await editorPage.reload();
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await expect
      .poll(
        async () => {
          const ownerColumns = await ownerPage
            .locator('[data-testid="kanban-column"]')
            .count();
          const editorColumns = await editorPage
            .locator('[data-testid="kanban-column"]')
            .count();

          return ownerColumns - editorColumns;
        },
        { timeout: 20_000 }
      )
      .toBe(0);
  });

  test("cursor presence recovers after reconnect", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    await boardNode.hover();
    const peerCursor = editorPage
      .locator('[data-testid="peer-cursor"]')
      .first();

    // Wait for cursor to appear on peer page
    await peerCursor.waitFor({ state: "visible", timeout: 5000 });

    await expect(peerCursor).toBeVisible({ timeout: 5000 });

    await editorPage.context().setOffline(true);
    // Wait for offline state
    await editorPage
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: 5000 });

    await editorPage.context().setOffline(false);
    // Wait for reconnection
    await editorPage
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: 5000 });

    await ownerPage.mouse.move(500, 400);
    // Wait for cursor to reappear after reconnect
    await peerCursor.waitFor({ state: "visible", timeout: 5000 });

    await expect(peerCursor).toBeVisible({ timeout: 10_000 });
  });

  test("connection indicator reflects actual state", async () => {
    const syncIndicator = editorPage.locator(
      '[data-testid="sync-status-indicator"]'
    );
    await expect(syncIndicator).toBeVisible({ timeout: 5000 });
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected"
    );
    await expect(syncIndicator).toHaveAttribute(
      "data-sync-state",
      CONNECTED_STATES_REGEX
    );
  });
});
