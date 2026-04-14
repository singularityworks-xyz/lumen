import type {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
} from "@playwright/test";

import { type SeedResult, seedE2EAuth } from "./auth";

export async function clearLocalStorageAndIndexedDB(page: Page) {
  try {
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("lumen-kanban-store");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB blocked"));
      });
    });
  } catch (e: unknown) {
    // Only ignore about:blank cross-origin security errors on initial setup
    const errorMessage = e instanceof Error ? e.message : String(e);
    const isSecurityError =
      errorMessage.includes("SecurityError") ||
      errorMessage.includes("The operation is insecure") ||
      errorMessage.includes("about:blank") ||
      (e instanceof Error && e.name === "SecurityError");

    if (!isSecurityError) {
      throw e;
    }
  }
}

export async function disableAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => {
      return (
        document.querySelector('[data-testid="workspace-selector"]') !== null ||
        document.querySelector('[data-testid="welcome-screen"]') !== null
      );
    },
    { timeout: 15_000 }
  );
}

export function getStoreState(
  page: Page
): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const storeElement = document.querySelector('[data-testid="kanban-store"]');
    return storeElement
      ? JSON.parse(storeElement.getAttribute("data-state") || "{}")
      : null;
  });
}

interface ReactFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export function getReactFlowViewport(page: Page): Promise<ReactFlowViewport> {
  return page.evaluate(() => {
    const rf = (
      window as Window & {
        __reactFlow?: { getViewport: () => ReactFlowViewport };
      }
    ).__reactFlow;
    return rf ? rf.getViewport() : { x: 0, y: 0, zoom: 1 };
  });
}

export async function deleteWorkspace(page: Page) {
  const deleteWorkspaceButton = page.locator(
    '[data-testid="workspace-selector"]'
  );
  await deleteWorkspaceButton.click({ button: "right" });
  await page.waitForSelector('[data-testid="workspace-delete-option"]');
  await page.click('[data-testid="workspace-delete-option"]');
  await page.waitForSelector('[data-testid="workspace-delete-confirm-input"]');
  await page.fill('[data-testid="workspace-delete-confirm-input"]', "DELETE");
  await page.click('[data-testid="workspace-delete-submit"]');
}

export async function createShareLinkForFirstBoard(
  page: Page
): Promise<string> {
  const boardNode = page.locator('[data-testid="board-node"]').first();
  await boardNode.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(2000); // Waiting for background API calls to finish

  const workspaceSelector = page.locator('[data-testid="workspace-selector"]');
  await workspaceSelector.click({ timeout: 10_000 });
  await page.waitForSelector('[data-testid="workspace-option"]', {
    timeout: 10_000,
  });
  await page.waitForTimeout(1000);

  // Retry the share link button if it fails
  let shareLink = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await boardNode
        .locator('[data-testid="board-header"]')
        .click({ button: "right", timeout: 10_000 });
      await page.waitForSelector('[data-testid="board-share-option"]', {
        timeout: 10_000,
      });
      await page.click('[data-testid="board-share-option"]', {
        timeout: 10_000,
      });
      await page.waitForSelector('[data-testid="share-dialog"]', {
        timeout: 10_000,
      });

      await page.waitForTimeout(1000); // Give the board time to be fully initialized and persisted

      await page.click('[data-testid="create-share-link-button"]', {
        timeout: 5000,
      });
      await page.waitForSelector('[data-testid="share-link-input"]', {
        timeout: 5000,
      });
      shareLink = await page
        .locator('[data-testid="share-link-input"]')
        .inputValue({ timeout: 5000 });
      break;
    } catch (e: unknown) {
      if (attempt === 2) {
        throw e;
      }
      await page.waitForTimeout(2000);
      // close and reopen the dialog if it failed
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }
  }

  if (!shareLink) {
    throw new Error("Could not retrieve share link");
  }

  return shareLink;
}

export interface TwoUserSetup {
  editorPage: Page;
  editorSeed?: SeedResult;
  ownerPage: Page;
  ownerSeed?: SeedResult;
  shareLink: string;
}

export async function setupTwoUsers(browser: Browser): Promise<TwoUserSetup> {
  const ownerSeed = await seedE2EAuth();
  const editorSeed = await seedE2EAuth();

  for (const c of ownerSeed.storageState.cookies) {
    c.domain = "127.0.0.1";
  }
  for (const c of editorSeed.storageState.cookies) {
    c.domain = "127.0.0.1";
  }

  const ownerContext = await browser.newContext({
    storageState: ownerSeed.storageState,
  });
  const editorContext = await browser.newContext({
    storageState: editorSeed.storageState,
  });

  // Inject E2E bypass headers
  await ownerContext.route("**/api/**", (route) => {
    const headers = route.request().headers();
    if (route.request().method() !== "OPTIONS") {
      headers["x-e2e-bypass"] = "true";
      headers["x-e2e-user-id"] = ownerSeed.userId;
    }
    route.continue({ headers });
  });

  await editorContext.route("**/api/**", (route) => {
    const headers = route.request().headers();
    if (route.request().method() !== "OPTIONS") {
      headers["x-e2e-bypass"] = "true";
      headers["x-e2e-user-id"] = editorSeed.userId;
    }
    route.continue({ headers });
  });

  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();

  ownerPage.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  await clearLocalStorageAndIndexedDB(ownerPage);
  await disableAnimations(ownerPage);
  await ownerPage.goto("/");
  await waitForAppReady(ownerPage);

  const createFirstBoardButton = ownerPage.locator(
    '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
  );
  if (await createFirstBoardButton.isVisible()) {
    await createFirstBoardButton.click();
    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
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

  return { ownerPage, editorPage, shareLink, ownerSeed, editorSeed };
}

export interface TwoUserCrossBrowserSetup {
  editorBrowser: Browser;
  editorPage: Page;
  editorSeed?: SeedResult;
  ownerPage: Page;
  ownerSeed?: SeedResult;
  shareLink: string;
}

export async function setupTwoUsersCrossBrowser(
  ownerBrowser: Browser,
  editorBrowserType: BrowserType
): Promise<TwoUserCrossBrowserSetup> {
  const ownerSeed = await seedE2EAuth();
  const editorSeed = await seedE2EAuth();

  for (const c of ownerSeed.storageState.cookies) {
    c.domain = "127.0.0.1";
  }
  for (const c of editorSeed.storageState.cookies) {
    c.domain = "127.0.0.1";
  }

  const editorBrowser = await editorBrowserType.launch();
  let ownerContext: BrowserContext | null = null;

  try {
    ownerContext = await ownerBrowser.newContext({
      storageState: ownerSeed.storageState,
    });
    const editorContext = await editorBrowser.newContext({
      storageState: editorSeed.storageState,
    });

    await ownerContext.route("**/api/**", (route) => {
      const headers = route.request().headers();
      if (route.request().method() !== "OPTIONS") {
        headers["x-e2e-bypass"] = "true";
        headers["x-e2e-user-id"] = ownerSeed.userId;
      }
      route.continue({ headers });
    });

    await editorContext.route("**/api/**", (route) => {
      const headers = route.request().headers();
      if (route.request().method() !== "OPTIONS") {
        headers["x-e2e-bypass"] = "true";
        headers["x-e2e-user-id"] = editorSeed.userId;
      }
      route.continue({ headers });
    });

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
      await ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
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

    return {
      ownerPage,
      editorPage,
      shareLink,
      editorBrowser,
      ownerSeed,
      editorSeed,
    };
  } catch (e) {
    await editorBrowser.close();
    if (ownerContext) {
      await ownerContext.close();
    }
    throw e;
  }
}
