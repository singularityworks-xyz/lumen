import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "./helpers/commands";
import {
  assertStateIntegrity,
  captureStateSnapshot,
  fetchWorkersInstanceId,
  getSecondaryPresenceUrl,
  getSecondaryWorkersUrl,
  MultiInstanceTopology,
  routePageToWorkers,
} from "./lib/multi-instance-setup";

const DISCONNECTED_REGEX = /disconnected|offline/i;
const CONNECTED_REGEX = /connected|synced|online/i;

test.describe("E2E-TOPOLOGY-2: Sticky Routing & Session Affinity", () => {
  let topology: MultiInstanceTopology;

  test.beforeEach(() => {
    topology = new MultiInstanceTopology();
  });

  test.afterEach(async () => {
    await topology.stopAll();
  });

  test.describe.configure({ mode: "serial" });

  test.describe("Session Affinity Tests", () => {
    let ownerPage: Page;
    let editorPage: Page;

    test.beforeEach(async ({ browser }) => {
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Affinity Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await editorPage
        .locator('[data-testid="kanban-column"]:has-text("Affinity Column")')
        .waitFor({ state: "visible", timeout: 10_000 });

      const syncIndicatorBefore = editorPage.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicatorBefore).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await editorPage.waitForTimeout(1000);

      const syncIndicatorDisconnected = editorPage.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicatorDisconnected).toContainText(
        DISCONNECTED_REGEX,
        { timeout: 5000 }
      );

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });
      await editorPage.waitForTimeout(3000);

      const syncIndicatorReconnected = editorPage.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicatorReconnected).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Post-Reconnect Affinity"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
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

    test("disconnect/reconnect to different instance preserves awareness state", async () => {
      await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      await ownerPage.locator('[data-testid="board-node"]').first().hover();
      await ownerPage.mouse.move(400, 300);
      await ownerPage.waitForTimeout(500);

      const cursorBefore = editorPage.locator('[data-testid="peer-cursor"]');
      await expect(cursorBefore).toBeVisible({ timeout: 5000 });

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await editorPage.waitForTimeout(1500);

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });
      await editorPage.waitForTimeout(3000);

      await ownerPage.locator('[data-testid="board-node"]').first().hover();
      await ownerPage.mouse.move(600, 400);
      await ownerPage.waitForTimeout(1000);

      const cursorAfter = editorPage.locator('[data-testid="peer-cursor"]');
      await expect(cursorAfter).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Worker Stickiness Under Load", () => {
    let pages: Page[] = [];
    let shareLink: string;

    test.beforeEach(async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      const page3 = await context3.newPage();

      pages = [page1, page2, page3];

      for (const page of pages) {
        await clearLocalStorageAndIndexedDB(page);
        await disableAnimations(page);
        await page.goto("/");
        await waitForAppReady(page);

        const createFirstBoardButton = page.locator(
          '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
        );
        if (await createFirstBoardButton.isVisible()) {
          await createFirstBoardButton.click();
          await page.waitForTimeout(500);
        }
      }

      shareLink = await createShareLinkForFirstBoard(pages[0]!);

      for (const page of pages.slice(1)) {
        await page.goto(shareLink);
        await waitForAppReady(page);
        await page
          .locator('[data-testid="board-node"]')
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
      }
    });

    test.afterEach(async () => {
      for (const page of pages) {
        await page?.close();
      }
      pages = [];
    });

    test("multiple reconnects maintain state consistency", async () => {
      const addColumnTrigger = pages[0]!
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await pages[0]!.fill(
        '[data-testid="column-name-input"]',
        "Round 1 Column"
      );
      await pages[0]!.click('[data-testid="column-create-submit"]');
      await pages[0]!.waitForTimeout(500);

      for (let round = 0; round < 3; round++) {
        pages[0]!.evaluate(() => {
          window.dispatchEvent(new Event("offline"));
        });
        await pages[0]!.waitForTimeout(500);

        pages[0]!.evaluate(() => {
          window.dispatchEvent(new Event("online"));
        });
        await pages[0]!.waitForTimeout(2000);

        await addColumnTrigger.click();
        await pages[0]!.fill(
          '[data-testid="column-name-input"]',
          `Round ${round + 2} Column`
        );
        await pages[0]!.click('[data-testid="column-create-submit"]');
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

    test("presence survives reconnection to different worker", async () => {
      await pages[0]!.locator('[data-testid="board-node"]').first().hover();
      await pages[0]!.mouse.move(300, 200);
      await pages[0]!.waitForTimeout(500);

      const initialCursors = pages[2]!.locator('[data-testid="peer-cursor"]');
      await expect(initialCursors).toHaveCount(2, { timeout: 5000 });

      await pages[0]!.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await pages[0]!.waitForTimeout(1000);

      await pages[0]!.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });
      await pages[0]!.waitForTimeout(3000);

      await pages[1]!.locator('[data-testid="board-node"]').first().hover();
      await pages[1]!.mouse.move(500, 300);
      await pages[1]!.waitForTimeout(500);

      await pages[0]!.locator('[data-testid="board-node"]').first().hover();
      await pages[0]!.mouse.move(700, 400);
      await pages[0]!.waitForTimeout(1000);

      const reconnectCursors = pages[2]!.locator('[data-testid="peer-cursor"]');
      await expect(reconnectCursors).toHaveCount(2, { timeout: 5000 });
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

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Cross-Worker Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await editorPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Cross-Worker Column")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await editorPage.waitForTimeout(1000);

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Cross-Worker Column 2"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await ownerPage.waitForTimeout(500);

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });
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
      expect(secondaryInstanceId).toBe(`workers-${3003}`);

      const addColumnTrigger = ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');

      await addColumnTrigger.click();
      await ownerPage.fill(
        '[data-testid="column-name-input"]',
        "Secondary Worker Column"
      );
      await ownerPage.click('[data-testid="column-create-submit"]');
      await editorPage
        .locator(
          '[data-testid="kanban-column"]:has-text("Secondary Worker Column")'
        )
        .waitFor({ state: "visible", timeout: 10_000 });

      const stateBeforeReconnect = await captureStateSnapshot(editorPage);

      const editorSession = await editorPage.context();
      await editorSession.clearCookies();

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
      await editorPage.waitForTimeout(1500);

      await editorPage.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });
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
        "http://localhost:3002"
      );
      const secondaryInstanceId = await fetchWorkersInstanceId(
        getSecondaryWorkersUrl()
      );
      expect(primaryInstanceId).toBe("workers-3002");
      expect(secondaryInstanceId).toBe("workers-3003");

      const primaryAddColumn = primaryPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');
      await primaryAddColumn.click();
      await primaryPage.fill(
        '[data-testid="column-name-input"]',
        "Verify Routing Column"
      );
      await primaryPage.click('[data-testid="column-create-submit"]');
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
        await page2.evaluate(() => {
          window.dispatchEvent(new Event("offline"));
        });
        await page2.waitForTimeout(300);

        await page2.evaluate(() => {
          window.dispatchEvent(new Event("online"));
        });
        await page2.waitForTimeout(500);
      }

      const syncIndicator = page2.locator(
        '[data-testid="sync-status-indicator"]'
      );
      await expect(syncIndicator).toContainText(CONNECTED_REGEX, {
        timeout: 5000,
      });

      const addColumnTrigger = page1
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="add-column-trigger"]');
      await addColumnTrigger.click();
      await page1.fill(
        '[data-testid="column-name-input"]',
        "Post-Stress Column"
      );
      await page1.click('[data-testid="column-create-submit"]');
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
