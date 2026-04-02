import type { Page } from "@playwright/test";

export async function clearLocalStorageAndIndexedDB(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("lumen-kanban-store");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB blocked"));
    });
  });
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
  await page.waitForLoadState("networkidle");
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
  const workspaceSelector = page.locator('[data-testid="workspace-selector"]');
  await workspaceSelector.click();
  await page.waitForSelector('[data-testid="workspace-option"]', {
    timeout: 5000,
  });

  const boardNode = page.locator('[data-testid="board-node"]').first();
  await boardNode
    .locator('[data-testid="board-header"]')
    .click({ button: "right" });
  await page.waitForSelector('[data-testid="board-share-option"]');
  await page.click('[data-testid="board-share-option"]');
  await page.waitForSelector('[data-testid="share-dialog"]');
  await page.click('[data-testid="create-share-link-button"]');
  await page.waitForSelector('[data-testid="share-link-input"]');
  return page.locator('[data-testid="share-link-input"]').inputValue();
}

export interface TwoUserSetup {
  editorPage: Page;
  ownerPage: Page;
  shareLink: string;
}

/**
 * Sets up two users on the same browser engine using separate contexts.
 * Returns both pages and the share link.
 */
export async function setupTwoUsers(browser: Browser): Promise<TwoUserSetup> {
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

/**
 * Sets up two users on different browser engines.
 * Owner uses the primary browser, editor uses the secondary browser type.
 */
export async function setupTwoUsersCrossBrowser(
  ownerBrowser: Browser,
  editorBrowserType: BrowserType
): Promise<TwoUserSetup> {
  const editorBrowser = await editorBrowserType.launch();
  const ownerContext = await ownerBrowser.newContext();
  const editorContext = await editorBrowser.newContext();
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
