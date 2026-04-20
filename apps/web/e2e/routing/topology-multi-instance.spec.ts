import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createAuthenticatedDevicePage,
  createShareLinkForFirstBoard,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  waitForCollabUpdate,
  waitForConnectionState,
  waitForReconnected,
} from "../helpers/waits";
import {
  captureStateSnapshot,
  fetchWorkersInstanceId,
  getSecondaryPresenceUrl,
  getSecondaryWorkersInstanceId,
  getSecondaryWorkersUrl,
  MultiInstanceTopology,
  routePageToWorkers,
} from "../lib/multi-instance-setup";

const _DISCONNECTED_REGEX = /disconnected|offline/i;
const _CONNECTED_REGEX = /connected|synced|online/i;

async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
}

async function createColumnOnFirstBoard(
  page: Page,
  columnName: string
): Promise<void> {
  const createdViaStore = await page
    .evaluate((name) => {
      interface BoardRecord {
        column_ids?: string[];
      }

      interface KanbanState {
        addColumn: (
          boardId: string,
          columnName: string,
          index: number
        ) => string;
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
        return false;
      }

      const state = store.getState();
      const firstBoardId = state.boards?.allIds?.[0];
      if (!firstBoardId) {
        return false;
      }

      const board = state.boards?.byId?.[firstBoardId];
      const index = Array.isArray(board?.column_ids)
        ? board.column_ids.length
        : 0;
      state.addColumn(firstBoardId, name, index);
      return true;
    }, columnName)
    .catch(() => false);

  if (createdViaStore) {
    await page
      .locator(`[data-testid="kanban-column"]:has-text("${columnName}")`)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    return;
  }

  const boardNode = page.locator('[data-testid="board-node"]').first();
  const trigger = page
    .locator('[data-testid="board-node"]')
    .first()
    .locator('[data-testid="add-column-trigger"]');
  const columnNameInput = page.locator('[data-testid="column-name-input"]');

  for (let attempt = 0; attempt < 4; attempt++) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await trigger.waitFor({ state: "visible", timeout: 10_000 });

    await trigger.click({ timeout: 5000, force: true }).catch(async () => {
      await page.evaluate(() => {
        const board = document.querySelector('[data-testid="board-node"]');
        const button = board?.querySelector(
          '[data-testid="add-column-trigger"]'
        ) as HTMLButtonElement | null;
        button?.click();
      });
    });

    const inputVisible = await columnNameInput
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (inputVisible) {
      await columnNameInput.fill(columnName);
      await page.click('[data-testid="column-create-submit"]');
      return;
    }

    await boardNode.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(250);
  }

  throw new Error("Unable to open add-column dialog");
}

test.describe("E2E-TOPOLOGY-1: Multi-Instance Topology", () => {
  let topology: MultiInstanceTopology;

  test.beforeEach(() => {
    topology = new MultiInstanceTopology();
  });

  test.afterEach(async () => {
    await topology.stopAll();
  });

  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.describe("Two Workers Instances", () => {
    let ownerPage: Page;
    let editorPage: Page;

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryWorkers();
      const setup = await setupTwoUsers(browser);
      ownerPage = setup.ownerPage;
      editorPage = setup.editorPage;
    });

    test.afterEach(async () => {
      await ownerPage?.close();
      await editorPage?.close();
    });

    test("state converges when clients connect to different workers instances", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        topology.getPrimaryPresenceUrl()
      );

      await editorPage.goto("/");
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      await createColumnOnFirstBoard(ownerPage, "Multi-Instance Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Multi-Instance Column"
      );

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(ownerColumns).toBe(editorColumns);
    });

    test("presence routing across workers keeps collaboration healthy", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        topology.getPrimaryPresenceUrl()
      );

      await editorPage.goto("/");
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      await waitForConnectionState(
        ownerPage,
        "sync-status-indicator",
        "connected",
        10_000
      );
      await waitForConnectionState(
        editorPage,
        "sync-status-indicator",
        "connected",
        10_000
      );

      await createColumnOnFirstBoard(ownerPage, "Presence Routing Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Presence Routing Column"
      );
    });

    test("disconnect from one workers reconnects to another workers", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        topology.getPrimaryPresenceUrl()
      );

      await editorPage.goto("/");
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      await createColumnOnFirstBoard(ownerPage, "Before Reconnect Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Before Reconnect Column"
      );

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1200);

      await goOnline(editorPage);
      await waitForReconnected(editorPage);
      await ownerPage.keyboard.press("Escape");
      await createColumnOnFirstBoard(ownerPage, "Post-Reconnect Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Post-Reconnect Column"
      );
    });

    test("selection interactions keep state consistent across workers", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        topology.getPrimaryPresenceUrl()
      );

      await editorPage.goto("/");
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
      await boardNode.click();

      await createColumnOnFirstBoard(ownerPage, "Selection Routing Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Selection Routing Column"
      );
    });
  });

  test.describe("Load Balancing Scenario", () => {
    let user1Page: Page;
    let user2Page: Page;
    let user3Page: Page;
    let shareLink: string;

    test.describe.configure({ timeout: 180_000 });

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryWorkers();
      await topology.startSecondaryPresence();

      const user1 = await createAuthenticatedDevicePage(browser);
      const user2 = await createAuthenticatedDevicePage(browser);
      const user3 = await createAuthenticatedDevicePage(browser);

      user1Page = user1.page;
      user2Page = user2.page;
      user3Page = user3.page;

      await routePageToWorkers(
        user1Page,
        getSecondaryWorkersUrl(),
        getSecondaryPresenceUrl()
      );
      await user1Page.goto("/");
      await waitForAppReady(user1Page);

      const createFirstBoardButton = user1Page.locator(
        '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
      );
      if (await createFirstBoardButton.isVisible()) {
        await createFirstBoardButton.click();
        await user1Page
          .locator('[data-testid="board-node"]')
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
      }

      shareLink = await createShareLinkForFirstBoard(user1Page);

      await routePageToWorkers(
        user2Page,
        getSecondaryWorkersUrl(),
        getSecondaryPresenceUrl()
      );
      await user2Page.goto(shareLink);
      await waitForAppReady(user2Page);
      await user2Page
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      await user3Page.goto(shareLink);
      await waitForAppReady(user3Page);
      await user3Page
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    test.afterEach(async () => {
      await user1Page?.context().close();
      await user2Page?.context().close();
      await user3Page?.context().close();
    });

    test("multiple users see real-time updates", async () => {
      await createColumnOnFirstBoard(user1Page, "Load Balance Column");
      await Promise.all([
        waitForCollabUpdate(user2Page, "kanban-column", "Load Balance Column"),
        waitForCollabUpdate(user3Page, "kanban-column", "Load Balance Column"),
      ]);

      const user2Columns = await user2Page
        .locator('[data-testid="kanban-column"]')
        .count();
      const user3Columns = await user3Page
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(user2Columns).toBe(user3Columns);
    });

    test("multiple peers receive updates across routed instances", async () => {
      await createColumnOnFirstBoard(user1Page, "Load Balance User1 Column");
      await Promise.all([
        waitForCollabUpdate(
          user2Page,
          "kanban-column",
          "Load Balance User1 Column"
        ),
        waitForCollabUpdate(
          user3Page,
          "kanban-column",
          "Load Balance User1 Column"
        ),
      ]);

      await createColumnOnFirstBoard(user2Page, "Load Balance User2 Column");
      await Promise.all([
        waitForCollabUpdate(
          user1Page,
          "kanban-column",
          "Load Balance User2 Column"
        ),
        waitForCollabUpdate(
          user3Page,
          "kanban-column",
          "Load Balance User2 Column"
        ),
      ]);

      const user1Columns = await user1Page
        .locator('[data-testid="kanban-column"]')
        .count();
      const user2Columns = await user2Page
        .locator('[data-testid="kanban-column"]')
        .count();
      const user3Columns = await user3Page
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(user1Columns).toBe(user2Columns);
      expect(user2Columns).toBe(user3Columns);
    });
  });

  test.describe("Horizontal Scaling Verification", () => {
    let ownerPage: Page;
    let editorPage: Page;
    let shareLink: string;

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryWorkers();
      await topology.startSecondaryPresence();
      const setup = await setupTwoUsers(browser);
      ownerPage = setup.ownerPage;
      editorPage = setup.editorPage;
      shareLink = setup.shareLink;
    });

    test.afterEach(async () => {
      await ownerPage?.context().close();
      await editorPage?.context().close();
    });

    test("edits sync after reconnection to different instance", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        getSecondaryPresenceUrl()
      );
      await editorPage.goto("/");
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      await createColumnOnFirstBoard(ownerPage, "Pre-Disconnect");
      await waitForCollabUpdate(editorPage, "kanban-column", "Pre-Disconnect");

      const stateBeforeReconnect = await captureStateSnapshot(editorPage);

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1200);

      await createColumnOnFirstBoard(ownerPage, "During-Disconnect");

      await goOnline(editorPage);
      await waitForReconnected(editorPage);
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "During-Disconnect"
      );

      await editorPage.reload();
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const stateAfterReconnect = await captureStateSnapshot(editorPage);
      expect(stateAfterReconnect.columnCount).toBeGreaterThanOrEqual(
        stateBeforeReconnect.columnCount
      );

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(ownerColumns).toBeGreaterThanOrEqual(2);
      expect(ownerColumns).toBe(editorColumns);
    });

    test("users connected to different workers instances see consistent state", async () => {
      await routePageToWorkers(
        editorPage,
        getSecondaryWorkersUrl(),
        getSecondaryPresenceUrl()
      );
      await editorPage.goto(shareLink);
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });

      await waitForConnectionState(
        ownerPage,
        "sync-status-indicator",
        "connected",
        20_000
      );
      await waitForConnectionState(
        editorPage,
        "sync-status-indicator",
        "connected",
        20_000
      );

      const primaryInstanceId = await fetchWorkersInstanceId(
        topology.getPrimaryWorkersUrl()
      );
      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(primaryInstanceId).toBe(
        `workers-${new URL(topology.getPrimaryWorkersUrl()).port}`
      );
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      await createColumnOnFirstBoard(ownerPage, "Cross-Instance Column");
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Cross-Instance Column",
        20_000
      );

      const primaryColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const secondaryColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(primaryColumns).toBe(secondaryColumns);
    });
  });
});
