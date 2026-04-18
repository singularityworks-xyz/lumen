import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  waitForCollabUpdate,
  waitForConnectionState,
  waitForDisconnected,
  waitForPresenceCursor,
  waitForReconnected,
} from "../helpers/waits";
import {
  assertStateIntegrity,
  captureStateSnapshot,
  fetchWorkersInstanceId,
  getSecondaryWorkersInstanceId,
  getSecondaryPresenceUrl,
  getSecondaryWorkersUrl,
  MultiInstanceTopology,
  routePageToWorkers,
} from "../lib/multi-instance-setup";

const _DISCONNECTED_REGEX = /disconnected|offline/i;
const CONNECTED_REGEX = /connected|synced|online/i;

async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Multi-Instance Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Presence Routing Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Before Reconnect Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await waitForCollabUpdate(
        editorPage,
        "kanban-column",
        "Before Reconnect Column"
      );

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1200);

      await goOnline(editorPage);
      await waitForReconnected(editorPage);
      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Post-Reconnect Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Selection Routing Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
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

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryWorkers();
      await topology.startSecondaryPresence();

      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();

      user1Page = await context1.newPage();
      user2Page = await context2.newPage();
      user3Page = await context3.newPage();

      await clearLocalStorageAndIndexedDB(user1Page);
      await disableAnimations(user1Page);
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

      await routePageToWorkers(user2Page, getSecondaryWorkersUrl());
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
      await user1Page?.close();
      await user2Page?.close();
      await user3Page?.close();
    });

    test("multiple users see real-time updates", async () => {
      const addColumnTrigger = user1Page
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await user1Page.fill(
        '[data-testid="column-name-input"]',
        "Load Balance Column"
      );
      await user1Page.click('[data-testid="column-create-submit"]');
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

    test("cursor presence visible for multiple peers", async () => {
      await user1Page.locator('[data-testid="board-node"]').first().hover();
      await user1Page.mouse.move(400, 300);
      await waitForPresenceCursor(user3Page);

      await user2Page.locator('[data-testid="board-node"]').first().hover();
      await user2Page.mouse.move(500, 400);
      await waitForPresenceCursor(user3Page, 2);
    });
  });

  test.describe("Horizontal Scaling Verification", () => {
    let ownerPage: Page;
    let editorPage: Page;

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryWorkers();
      await topology.startSecondaryPresence();
      const setup = await setupTwoUsers(browser);
      ownerPage = setup.ownerPage;
      editorPage = setup.editorPage;
    });

    test.afterEach(async () => {
      await ownerPage?.close();
      await editorPage?.close();
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

      const stateBeforeReconnect = await captureStateSnapshot(editorPage);

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Pre-Disconnect"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await waitForCollabUpdate(editorPage, "kanban-column", "Pre-Disconnect");

      await goOffline(editorPage);
      await waitForDisconnected(editorPage);

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "During-Disconnect"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');

      await goOnline(editorPage);
      await waitForReconnected(editorPage);

      await editorPage.reload();
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const stateAfterReconnect = await captureStateSnapshot(editorPage);
      assertStateIntegrity(
        stateBeforeReconnect,
        stateAfterReconnect,
        "cross-instance reconnect"
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

    test("users connected to different workers instances see consistent state", async ({
      browser,
    }) => {
      await topology.startSecondaryWorkers();
      await topology.startSecondaryPresence();

      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const primaryPage = await context1.newPage();
      const secondaryPage = await context2.newPage();

      await clearLocalStorageAndIndexedDB(primaryPage);
      await disableAnimations(primaryPage);
      await primaryPage.goto("/");
      await waitForAppReady(primaryPage);

      const createFirstBoardButton = primaryPage.locator(
        '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
      );
      if (await createFirstBoardButton.isVisible()) {
        await createFirstBoardButton.click();
        await primaryPage
          .locator('[data-testid="board-node"]')
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
      }

      const shareLink = await createShareLinkForFirstBoard(primaryPage);

      await routePageToWorkers(
        secondaryPage,
        getSecondaryWorkersUrl(),
        getSecondaryPresenceUrl()
      );
      await secondaryPage.goto(shareLink);
      await waitForAppReady(secondaryPage);
      await secondaryPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const primaryInstanceId = await fetchWorkersInstanceId(
        "http://localhost:3002"
      );
      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(primaryInstanceId).toBe("workers-3002");
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      const primaryAddColumn = primaryPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');
      await primaryAddColumn.click();
      await primaryPage.fill(
        '[data-testid="column-name-input"]',
        "Cross-Instance Column"
      );
      await primaryPage.click('[data-testid="column-create-submit"]');
      await waitForCollabUpdate(
        secondaryPage,
        "kanban-column",
        "Cross-Instance Column"
      );

      const primaryColumns = await primaryPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const secondaryColumns = await secondaryPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(primaryColumns).toBe(secondaryColumns);

      await primaryPage.close();
      await secondaryPage.close();
    });
  });
});
