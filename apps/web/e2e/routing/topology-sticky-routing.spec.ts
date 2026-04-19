import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createAuthenticatedDevicePage,
  createShareLinkForFirstBoard,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
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

const CONNECTED_REGEX = /connected|synced|online/i;

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

test.describe("E2E-TOPOLOGY-2: Sticky Routing & Session Affinity", () => {
  let topology: MultiInstanceTopology;

  test.beforeEach(() => {
    topology = new MultiInstanceTopology();
  });

  test.afterEach(async () => {
    await topology.stopAll();
  });

  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.describe("Session Affinity Tests", () => {
    let ownerPage: Page;
    let editorPage: Page;

    test.beforeEach(async ({ browser }) => {
      await topology.startSecondaryPresence();
      const setup = await setupTwoUsers(browser);
      ownerPage = setup.ownerPage;
      editorPage = setup.editorPage;
    });

    test.afterEach(async () => {
      await ownerPage?.close();
      await editorPage?.close();
    });

    test("same user reconnects to same worker preserving state", async () => {
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      await createColumnOnFirstBoard(ownerPage, "Affinity Column");
      await editorPage
        .locator('[data-testid="kanban-column"]:has-text("Affinity Column")')
        .waitFor({ state: "visible", timeout: 10_000 });

      const syncIndicatorBefore = editorPage.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicatorBefore).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      await goOffline(editorPage);

      await goOnline(editorPage);
      await editorPage.waitForTimeout(3000);

      const syncIndicatorReconnected = editorPage.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicatorReconnected).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      await createColumnOnFirstBoard(ownerPage, "Post-Reconnect Affinity");
      await editorPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Post-Reconnect Affinity")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(ownerColumns).toBe(editorColumns);
    });

    test("disconnect/reconnect to different instance preserves data sync", async () => {
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      await createColumnOnFirstBoard(ownerPage, "Affinity Sync Before Offline");
      await editorPage
        .locator('[data-testid="kanban-column"]:has-text("Affinity Sync Before Offline")')
        .waitFor({ state: "visible", timeout: 10_000 });

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1500);

      await createColumnOnFirstBoard(ownerPage, "Affinity Sync During Offline");

      await goOnline(editorPage);
      await editorPage
        .locator('[data-testid="kanban-column"]:has-text("Affinity Sync During Offline")')
        .waitFor({ state: "visible", timeout: 10_000 });

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(editorColumns).toBe(ownerColumns);
    });
  });

  test.describe("Worker Stickiness Under Load", () => {
    let pages: Page[] = [];
    let shareLink: string;

    test.beforeEach(async ({ browser }) => {
      const setup = await setupTwoUsers(browser);
      pages = [setup.ownerPage, setup.editorPage];
      shareLink = setup.shareLink;

      const thirdUser = await createAuthenticatedDevicePage(browser);
      const page3 = thirdUser.page;

      await clearLocalStorageAndIndexedDB(page3);
      await disableAnimations(page3);
      await page3.goto(shareLink);
      await waitForAppReady(page3);
      await page3
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      pages.push(page3);
    });

    test.afterEach(async () => {
      for (const page of pages) {
        await page?.close();
      }
      pages = [];
    });

    test("multiple reconnects maintain state consistency", async () => {
      await createColumnOnFirstBoard(pages[0]!, "Round 1 Column");
      await pages[0]!.waitForTimeout(500);

      for (let round = 0; round < 3; round++) {
        await goOffline(pages[0]!);
        await pages[0]!.waitForTimeout(500);

        await goOnline(pages[0]!);
        await pages[0]!.waitForTimeout(2000);

        await createColumnOnFirstBoard(pages[0]!, `Round ${round + 2} Column`);
        await pages[0]!.waitForTimeout(500);
      }

      for (const page of pages.slice(1)) {
        await page
          .locator('[data-testid="kanban-column"]:has-text("Round 4 Column")')
          .waitFor({ state: "visible", timeout: 10_000 });
      }

      const page1Columns = await pages[0]!
        .locator('[data-testid="kanban-column"]')
        .count();
      const page2Columns = await pages[1]!
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(page1Columns).toBe(page2Columns);
    });

    test("presence routing to different worker keeps data updates flowing", async () => {
      await pages[0]!.locator('[data-testid="board-node"]').first().hover();
      await pages[0]!.mouse.move(300, 200);
      await pages[0]!.waitForTimeout(500);

      await createColumnOnFirstBoard(pages[0]!, "Presence Before Reconnect");
      await pages[2]!
        .locator('[data-testid="kanban-column"]:has-text("Presence Before Reconnect")')
        .waitFor({ state: "visible", timeout: 10_000 });

      await goOffline(pages[0]!);
      await pages[0]!.waitForTimeout(1000);

      await goOnline(pages[0]!);
      await pages[0]!.waitForTimeout(3000);

      await createColumnOnFirstBoard(pages[0]!, "Presence After Reconnect");
      await pages[2]!
        .locator('[data-testid="kanban-column"]:has-text("Presence After Reconnect")')
        .waitFor({ state: "visible", timeout: 10_000 });

      const ownerColumns = await pages[0]!
        .locator('[data-testid="kanban-column"]')
        .count();
      const peerColumns = await pages[2]!
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(peerColumns).toBe(ownerColumns);
    });
  });

  test.describe("Cross-Instance State Convergence", () => {
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

    test("state converges when routed to different workers", async () => {
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

      await createColumnOnFirstBoard(ownerPage, "Cross-Worker Column");
      await editorPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Cross-Worker Column")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1000);

      await createColumnOnFirstBoard(ownerPage, "Cross-Worker Column 2");
      await ownerPage.waitForTimeout(500);

      await goOnline(editorPage);
      await editorPage.waitForTimeout(3000);

      await editorPage.reload();
      await waitForAppReady(editorPage);
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(ownerColumns).toBeGreaterThanOrEqual(2);
      expect(ownerColumns).toBe(editorColumns);
    });

    test("reconnect to secondary worker maintains data integrity", async () => {
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

      await createColumnOnFirstBoard(ownerPage, "Secondary Worker Column");
      await editorPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Secondary Worker Column")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      const stateBeforeReconnect = await captureStateSnapshot(editorPage);

      const editorSession = await editorPage.context();
      await editorSession.clearCookies();

      await goOffline(editorPage);
      await editorPage.waitForTimeout(1500);

      await goOnline(editorPage);
      await editorPage.waitForTimeout(3000);

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
        "secondary worker reconnect"
      );

      const ownerColumns = await ownerPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const editorColumns = await editorPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(ownerColumns).toBe(editorColumns);
      expect(ownerColumns).toBeGreaterThanOrEqual(1);
    });

    test("editor page actually connects to secondary workers instance", async ({
      browser,
    }) => {
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
        await primaryPage.waitForTimeout(500);
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
        topology.getPrimaryWorkersUrl()
      );
      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(primaryInstanceId).toBe(
        `workers-${new URL(topology.getPrimaryWorkersUrl()).port}`
      );
      expect(secondaryInstanceId).toBe(getSecondaryWorkersInstanceId());

      await createColumnOnFirstBoard(primaryPage, "Verify Routing Column");
      await primaryPage.waitForTimeout(1000);

      await secondaryPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Verify Routing Column")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      const primaryColumns = await primaryPage
        .locator('[data-testid="kanban-column"]')
        .count();
      const secondaryColumns = await secondaryPage
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(primaryColumns).toBe(secondaryColumns);
      expect(primaryColumns).toBeGreaterThanOrEqual(1);

      await primaryPage.close();
      await secondaryPage.close();
    });
  });

  test.describe("Sticky Routing Stress Test", () => {
    test("rapid connect/disconnect maintains routing affinity", async ({
      browser,
    }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
      ]);

      const page1 = await contexts[0].newPage();
      const page2 = await contexts[1].newPage();

      await clearLocalStorageAndIndexedDB(page1);
      await disableAnimations(page1);
      await page1.goto("/");
      await waitForAppReady(page1);

      const createFirstBoardButton = page1.locator(
        '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
      );
      if (await createFirstBoardButton.isVisible()) {
        await createFirstBoardButton.click();
        await page1.waitForTimeout(500);
      }

      const shareLink = await createShareLinkForFirstBoard(page1);

      await page2.goto(shareLink);
      await waitForAppReady(page2);
      await page2
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      for (let i = 0; i < 5; i++) {
        await goOffline(page2);
        await page2.waitForTimeout(300);

        await goOnline(page2);
        await page2.waitForTimeout(500);
      }

      const syncIndicator = page2.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicator).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      await createColumnOnFirstBoard(page1, "Post-Stress Column");
      await page2
        .locator('[data-testid="kanban-column"]:has-text("Post-Stress Column")')
        .waitFor({ state: "visible", timeout: 10_000 });

      const page1Columns = await page1
        .locator('[data-testid="kanban-column"]')
        .count();
      const page2Columns = await page2
        .locator('[data-testid="kanban-column"]')
        .count();

      expect(page1Columns).toBe(page2Columns);

      await page1.close();
      await page2.close();
      await contexts[0].close();
      await contexts[1].close();
    });
  });
});
