import type {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
} from "@playwright/test";

import { cleanupE2EAuth, type SeedResult, seedE2EAuth } from "./auth";
import { waitForConnectionState } from "./waits";

function registerSeedCleanup(context: BrowserContext, seed: SeedResult): void {
  context.once("close", () => {
    cleanupE2EAuth(seed.userId, seed.sessionId).catch((error) => {
      console.error("Failed to cleanup E2E auth seed", error);
    });
  });
}

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
    const errorMessage = e instanceof Error ? e.message : String(e);
    const isSecurityError =
      errorMessage.includes("SecurityError") ||
      errorMessage.includes("The operation is insecure") ||
      errorMessage.includes("about:blank") ||
      (e instanceof Error && e.name === "SecurityError");

    const isAboutBlank = (await page.url()) === "about:blank";
    if (!(isSecurityError && isAboutBlank)) {
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

export async function openCommentsDrawer(page: Page): Promise<void> {
  const newCommentInput = page.locator('[data-testid="new-comment-input"]');
  if (await newCommentInput.isVisible()) {
    return;
  }

  const commentsTab = page.locator(
    'button:has-text("Comments"):not([data-testid="comments-drawer-trigger"])'
  );

  if (await commentsTab.last().isVisible()) {
    try {
      await commentsTab.last().click({ force: true });
      await newCommentInput.waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      // Fall through to trigger click.
    }
  }

  const commentsDrawerTrigger = page.locator(
    '[data-testid="comments-drawer-trigger"]'
  );
  await commentsDrawerTrigger.waitFor({ state: "visible", timeout: 10_000 });

  try {
    await commentsDrawerTrigger.click({ force: true });
  } catch {
    const clickedViaDom = await page.evaluate(() => {
      const trigger = document.querySelector(
        '[data-testid="comments-drawer-trigger"]'
      ) as HTMLButtonElement | null;
      if (!trigger) {
        return false;
      }

      trigger.click();
      return true;
    });

    if (!clickedViaDom) {
      throw new Error("Unable to click comments drawer trigger");
    }
  }

  try {
    await newCommentInput.waitFor({ state: "visible", timeout: 2500 });
    return;
  } catch {
    // If drawer last opened on Discussion tab, switch back to Comments tab.
  }

  try {
    await commentsTab.last().click({ force: true });
  } catch {
    const switchedViaDom = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("button"));
      const tab = candidates.find((button) => {
        const label = button.textContent?.toLowerCase() ?? "";
        return (
          label.includes("comments") &&
          button.getAttribute("data-testid") !== "comments-drawer-trigger"
        );
      }) as HTMLButtonElement | undefined;

      tab?.click();
      return Boolean(tab);
    });

    if (!switchedViaDom) {
      throw new Error("Unable to switch to comments tab");
    }
  }

  await newCommentInput.waitFor({ state: "visible", timeout: 10_000 });
}

export async function openChatDrawer(page: Page): Promise<void> {
  const chatInput = page.locator('[data-testid="chat-input"]');
  if (await chatInput.isVisible()) {
    return;
  }

  const chatDrawerTrigger = page.locator('[data-testid="chat-drawer-trigger"]');
  await chatDrawerTrigger.waitFor({ state: "visible", timeout: 10_000 });

  try {
    await chatDrawerTrigger.click({ force: true });
    await chatInput.waitFor({ state: "visible", timeout: 2500 });
    return;
  } catch {
    // Fall back to DOM click and tab switching.
  }

  const clickedViaDom = await page.evaluate(() => {
    const trigger = document.querySelector(
      '[data-testid="chat-drawer-trigger"]'
    ) as HTMLButtonElement | null;
    if (!trigger) {
      return false;
    }

    trigger.click();
    return true;
  });

  if (clickedViaDom) {
    try {
      await chatInput.waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      // Fall through to explicit comments->discussion flow.
    }
  }

  await openCommentsDrawer(page);

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const discussion = buttons.find((button) =>
      button.textContent?.toLowerCase().includes("discussion")
    ) as HTMLButtonElement | undefined;

    discussion?.click();
  });

  await chatInput.waitFor({ state: "visible", timeout: 10_000 });
}

interface ShareWorkspaceInfo {
  workspaceId: string | null;
  workspaceName: string | null;
}

function getWorkspaceInfoFromShareToken(
  page: Page,
  shareToken: string
): Promise<ShareWorkspaceInfo> {
  return page.evaluate(async (token) => {
    try {
      const response = await fetch(`/api/share/${token}`, {
        credentials: "include",
      });

      if (!response.ok) {
        return {
          workspaceId: null,
          workspaceName: null,
        };
      }

      const data = (await response.json()) as {
        workspaceId?: string;
        workspaceName?: string;
      };

      return {
        workspaceId:
          typeof data.workspaceId === "string" ? data.workspaceId : null,
        workspaceName:
          typeof data.workspaceName === "string" ? data.workspaceName : null,
      };
    } catch {
      return {
        workspaceId: null,
        workspaceName: null,
      };
    }
  }, shareToken);
}

function normalizeWorkspaceLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim().toLowerCase();
}

async function getWorkspaceSelectorLabel(page: Page): Promise<string> {
  const workspaceSelector = page.locator('[data-testid="workspace-selector"]');

  try {
    await workspaceSelector.waitFor({ state: "visible", timeout: 5000 });
    return (await workspaceSelector.textContent())?.trim() ?? "";
  } catch {
    return "";
  }
}

async function isExpectedWorkspaceSelected(
  page: Page,
  workspaceName?: string
): Promise<boolean> {
  if (!workspaceName) {
    return true;
  }

  const currentLabel = normalizeWorkspaceLabel(
    await getWorkspaceSelectorLabel(page)
  );
  const expectedLabel = normalizeWorkspaceLabel(workspaceName);

  return currentLabel.includes(expectedLabel);
}

async function getCurrentWorkspaceIdFromStore(
  page: Page
): Promise<string | null> {
  const state = await getStoreState(page);
  const candidate = state?.currentWorkspaceId;
  return typeof candidate === "string" ? candidate : null;
}

async function getWorkspaceNameFromStore(
  page: Page,
  workspaceId: string
): Promise<string | null> {
  const state = await getStoreState(page);
  const maybeWorkspaces = state?.workspaces;

  if (
    typeof maybeWorkspaces !== "object" ||
    maybeWorkspaces === null ||
    !("byId" in maybeWorkspaces)
  ) {
    return null;
  }

  const byId = maybeWorkspaces.byId;
  if (typeof byId !== "object" || byId === null) {
    return null;
  }

  const workspace = (byId as Record<string, unknown>)[workspaceId];
  if (typeof workspace !== "object" || workspace === null) {
    return null;
  }

  const name = (workspace as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

async function waitForCurrentWorkspaceId(
  page: Page,
  workspaceId: string,
  timeoutMs = 4000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const currentWorkspaceId = await getCurrentWorkspaceIdFromStore(page);
    if (currentWorkspaceId === workspaceId) {
      return true;
    }

    await page.waitForTimeout(250);
  }

  return false;
}

function setCurrentWorkspaceFromStore(
  page: Page,
  workspaceId: string
): Promise<boolean> {
  return page.evaluate((id) => {
    const store = (
      window as Window & {
        __KANBAN_STORE__?: {
          getState?: () => {
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
}

function isExpectedWorkspaceContext(
  page: Page,
  options: {
    workspaceId?: string;
    workspaceIdTimeoutMs?: number;
    workspaceName?: string;
  }
): Promise<boolean> {
  const { workspaceId, workspaceName, workspaceIdTimeoutMs = 1200 } = options;

  if (workspaceId) {
    return waitForCurrentWorkspaceId(page, workspaceId, workspaceIdTimeoutMs);
  }

  if (workspaceName) {
    return isExpectedWorkspaceSelected(page, workspaceName);
  }

  return Promise.resolve(true);
}

async function waitForShareJoinFlowToSettle(
  page: Page,
  shareToken: string,
  timeoutMs = 10_000
): Promise<void> {
  try {
    await page.waitForFunction(
      (token) => {
        const params = new URLSearchParams(window.location.search);
        return params.get("share") !== token;
      },
      shareToken,
      { timeout: timeoutMs }
    );
  } catch {
    // Non-fatal; recovery logic can still handle unresolved join state.
  }
}

async function ensureExpectedWorkspaceSelected(
  page: Page,
  workspaceName?: string,
  timeoutMs = 10_000,
  workspaceId?: string
): Promise<boolean> {
  const hasWorkspaceId =
    typeof workspaceId === "string" && workspaceId.length > 0;
  const resolvedWorkspaceName =
    workspaceName ??
    (hasWorkspaceId
      ? await getWorkspaceNameFromStore(page, workspaceId)
      : null);
  const hasWorkspaceName =
    typeof resolvedWorkspaceName === "string" &&
    resolvedWorkspaceName.length > 0;

  if (!(hasWorkspaceId || hasWorkspaceName)) {
    return true;
  }

  if (
    await isExpectedWorkspaceContext(page, {
      workspaceId: hasWorkspaceId ? workspaceId : undefined,
      workspaceIdTimeoutMs: 1500,
      workspaceName: hasWorkspaceName ? resolvedWorkspaceName : undefined,
    })
  ) {
    return true;
  }

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (
      await isExpectedWorkspaceContext(page, {
        workspaceId: hasWorkspaceId ? workspaceId : undefined,
        workspaceIdTimeoutMs: 600,
        workspaceName: hasWorkspaceName ? resolvedWorkspaceName : undefined,
      })
    ) {
      return true;
    }

    if (hasWorkspaceId && workspaceId) {
      const switchedViaStore = await setCurrentWorkspaceFromStore(
        page,
        workspaceId
      );

      if (
        switchedViaStore &&
        (await isExpectedWorkspaceContext(page, {
          workspaceId,
          workspaceIdTimeoutMs: 1200,
          workspaceName: hasWorkspaceName ? resolvedWorkspaceName : undefined,
        }))
      ) {
        return true;
      }
    }

    const switched = await selectSharedWorkspaceFromMenu(
      page,
      hasWorkspaceName ? resolvedWorkspaceName : undefined
    );

    if (
      switched &&
      (await isExpectedWorkspaceContext(page, {
        workspaceId: hasWorkspaceId ? workspaceId : undefined,
        workspaceIdTimeoutMs: 1200,
        workspaceName: hasWorkspaceName ? resolvedWorkspaceName : undefined,
      }))
    ) {
      return true;
    }

    await page.waitForTimeout(300);
  }

  const lastWorkspaceId = await getCurrentWorkspaceIdFromStore(page);
  const lastLabel = await getWorkspaceSelectorLabel(page);
  console.warn("Timed out ensuring expected workspace context", {
    expectedWorkspaceId: hasWorkspaceId ? workspaceId : null,
    expectedWorkspaceName: hasWorkspaceName ? resolvedWorkspaceName : null,
    currentWorkspaceId: lastWorkspaceId,
    currentWorkspaceLabel: lastLabel,
  });

  return false;
}

async function waitForSharedWorkspaceState(
  page: Page,
  workspaceId: string,
  timeoutMs = 15_000
): Promise<boolean> {
  const start = Date.now();
  let lastBoardCount = 0;
  let lastOk = false;

  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(async (id) => {
      try {
        const response = await fetch(`/api/workspaces/${id}/state`, {
          credentials: "include",
        });

        if (!response.ok) {
          return { boardCount: 0, ok: false };
        }

        const data = (await response.json()) as {
          boards?: Record<string, unknown>;
        };

        return {
          boardCount: Object.keys(data.boards ?? {}).length,
          ok: true,
        };
      } catch {
        return { boardCount: 0, ok: false };
      }
    }, workspaceId);

    lastBoardCount = state.boardCount;
    lastOk = state.ok;

    if (state.ok && state.boardCount > 0) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  console.warn("Timed out waiting for shared workspace state", {
    workspaceId,
    ok: lastOk,
    boardCount: lastBoardCount,
  });

  return false;
}

export function getStoreState(
  page: Page
): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => Record<string, unknown>;
      };
    };

    const kanbanStore = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (kanbanStore?.getState) {
      return kanbanStore.getState();
    }

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

  const boardNode = page.locator('[data-testid="board-node"]').first();
  await boardNode.waitFor({ state: "visible", timeout: 15_000 });

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

      const closeShareDialogButton = page.locator(
        'button[aria-label="Close share dialog"]'
      );
      if (await closeShareDialogButton.isVisible()) {
        await closeShareDialogButton.click({ timeout: 2000 });
      } else {
        await page.keyboard.press("Escape");
      }

      try {
        await page
          .locator('[data-testid="share-dialog"]')
          .waitFor({ state: "hidden", timeout: 5000 });
      } catch {
        // Non-fatal: continue even if dialog animation races.
      }

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

  const currentUrl = new URL(page.url());
  const normalizedShareUrl = new URL(shareLink, currentUrl.origin);
  normalizedShareUrl.protocol = currentUrl.protocol;
  normalizedShareUrl.hostname = currentUrl.hostname;
  normalizedShareUrl.port = currentUrl.port;

  const shareToken = normalizedShareUrl.searchParams.get("share");
  if (!shareToken) {
    throw new Error("Share link is missing share token");
  }

  return normalizedShareUrl.toString();
}

async function waitForBoardNodeVisible(
  page: Page,
  timeoutMs: number
): Promise<boolean> {
  try {
    await page
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function waitForSharedWorkspaceUi(
  page: Page,
  timeoutMs: number
): Promise<boolean> {
  try {
    await page
      .locator('[data-testid="sync-status-indicator"]')
      .waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function createBoardForSyncSeed(
  page: Page,
  boardName: string
): Promise<boolean> {
  try {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.waitFor({ state: "visible", timeout: 10_000 });
    await newBoardButton.click({ timeout: 5000 });

    const boardNameInput = page.locator('[data-testid="board-name-input"]');
    await boardNameInput.waitFor({ state: "visible", timeout: 5000 });
    await boardNameInput.fill(boardName);

    await page.click('[data-testid="board-create-submit"]', { timeout: 5000 });
    await page
      .locator(`[data-testid="board-node"]:has-text("${boardName}")`)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    return true;
  } catch {
    return false;
  }
}

interface JoinShareResult {
  message?: string;
  ok: boolean;
  status: number;
  workspaceId?: string;
  workspaceName?: string;
}

function joinWorkspaceFromShareToken(
  page: Page,
  shareToken: string
): Promise<JoinShareResult> {
  return page.evaluate(async (token) => {
    try {
      const response = await fetch(`/api/share/${token}/join`, {
        method: "POST",
        credentials: "include",
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        workspaceId?: string;
        workspaceName?: string;
      };

      return {
        ok: response.ok,
        status: response.status,
        message: data.message,
        workspaceId: data.workspaceId,
        workspaceName: data.workspaceName,
      };
    } catch {
      return {
        ok: false,
        status: 0,
      };
    }
  }, shareToken);
}

async function selectSharedWorkspaceFromMenu(
  page: Page,
  workspaceName?: string
): Promise<boolean> {
  const workspaceSelector = page.locator('[data-testid="workspace-selector"]');
  await workspaceSelector.click({ timeout: 5000 });

  const optionLocator = page.locator('[data-testid="workspace-option"]');
  await optionLocator.first().waitFor({ state: "visible", timeout: 5000 });

  const options = await optionLocator.all();
  let fallbackOption: (typeof options)[number] | null = null;

  for (const option of options) {
    const optionText = (await option.textContent())?.trim() ?? "";

    if (workspaceName && optionText.includes(workspaceName)) {
      try {
        await option.click({ timeout: 3000, force: true });
        return true;
      } catch {
        // Dropdown can re-render while selecting; try again on next loop.
        return false;
      }
    }

    if (!(fallbackOption || optionText.includes("Default Workspace"))) {
      fallbackOption = option;
    }
  }

  if (fallbackOption) {
    try {
      await fallbackOption.click({ timeout: 3000, force: true });
      return true;
    } catch {
      return false;
    }
  }

  await page.keyboard.press("Escape");
  return false;
}

async function recoverEditorWorkspaceFromShare(
  page: Page,
  shareLink: string,
  shareToken: string,
  options: {
    expectedWorkspaceName?: string;
    requireBoardSync: boolean;
  }
): Promise<boolean> {
  const requireBoardSync = options.requireBoardSync;
  const requireWorkspaceMatch = true;
  const joinResult = await joinWorkspaceFromShareToken(page, shareToken);
  const targetWorkspaceName =
    options.expectedWorkspaceName ?? joinResult.workspaceName;

  if (!joinResult.ok) {
    console.warn("Failed to join shared workspace from editor context", {
      status: joinResult.status,
      message: joinResult.message,
    });
    return false;
  }

  await page.goto(shareLink);
  await waitForAppReady(page);
  await waitForShareJoinFlowToSettle(page, shareToken, 6000);

  const targetWorkspaceId = joinResult.workspaceId;

  if (requireWorkspaceMatch) {
    await ensureExpectedWorkspaceSelected(
      page,
      targetWorkspaceName,
      6000,
      targetWorkspaceId
    );
  }

  try {
    await waitForConnectionState(
      page,
      "sync-status-indicator",
      "connected",
      10_000
    );
  } catch {
    // Continue with fallback workspace selection below.
  }

  const primaryReady = requireBoardSync
    ? await waitForBoardNodeVisible(page, 8000)
    : await waitForSharedWorkspaceUi(page, 8000);

  const primaryWorkspaceMatch = requireWorkspaceMatch
    ? await isExpectedWorkspaceContext(page, {
        workspaceId: targetWorkspaceId,
        workspaceIdTimeoutMs: 1000,
        workspaceName: targetWorkspaceName,
      })
    : true;

  if (primaryReady && primaryWorkspaceMatch) {
    return true;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const switched = await selectSharedWorkspaceFromMenu(
      page,
      targetWorkspaceName
    );
    if (switched) {
      const switchedReady = requireBoardSync
        ? await waitForBoardNodeVisible(page, 8000)
        : await waitForSharedWorkspaceUi(page, 8000);
      const switchedWorkspaceMatch = requireWorkspaceMatch
        ? await isExpectedWorkspaceContext(page, {
            workspaceId: targetWorkspaceId,
            workspaceIdTimeoutMs: 1500,
            workspaceName: targetWorkspaceName,
          })
        : true;

      if (switchedReady && switchedWorkspaceMatch) {
        return true;
      }
    }

    await page.waitForTimeout(1000);
  }

  if (joinResult.workspaceId) {
    await waitForSharedWorkspaceState(page, joinResult.workspaceId, 5000);
    const postStateReady = requireBoardSync
      ? await waitForBoardNodeVisible(page, 4000)
      : await waitForSharedWorkspaceUi(page, 4000);
    const postStateWorkspaceMatch = requireWorkspaceMatch
      ? await isExpectedWorkspaceContext(page, {
          workspaceId: targetWorkspaceId,
          workspaceIdTimeoutMs: 1500,
          workspaceName: targetWorkspaceName,
        })
      : true;

    if (postStateReady && postStateWorkspaceMatch) {
      return true;
    }
  }

  return false;
}

export interface TwoUserSetup {
  editorPage: Page;
  editorSeed?: SeedResult;
  ownerPage: Page;
  ownerSeed?: SeedResult;
  shareLink: string;
}

interface TwoUserSetupOptions {
  requireBoardSync?: boolean;
}

export async function setupTwoUsers(
  browser: Browser,
  options: TwoUserSetupOptions = {}
): Promise<TwoUserSetup> {
  const requireBoardSync = options.requireBoardSync ?? true;
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
    serviceWorkers: "block",
  });
  const editorContext = await browser.newContext({
    storageState: editorSeed.storageState,
    serviceWorkers: "block",
  });
  registerSeedCleanup(ownerContext, ownerSeed);
  registerSeedCleanup(editorContext, editorSeed);

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

  ownerPage.on("response", (response) => {
    if (response.status() === 401) {
      console.log(`OWNER 401 RESPONSE: ${response.url()}`);
    }
  });

  editorPage.on("response", (response) => {
    if (response.status() === 401) {
      console.log(`EDITOR 401 RESPONSE: ${response.url()}`);
    }
  });

  ownerPage.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`OWNER PAGE ERROR: ${msg.text()}`);
    }
  });

  editorPage.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`EDITOR PAGE ERROR: ${msg.text()}`);
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
  const shareToken = new URL(shareLink).searchParams.get("share");

  if (!shareToken) {
    throw new Error("Share token is missing from generated share link");
  }

  const shareWorkspaceInfo = await getWorkspaceInfoFromShareToken(
    ownerPage,
    shareToken
  );
  const workspaceId = shareWorkspaceInfo.workspaceId;
  const expectedWorkspaceName = shareWorkspaceInfo.workspaceName ?? undefined;

  if (requireBoardSync) {
    await ensureExpectedWorkspaceSelected(
      ownerPage,
      expectedWorkspaceName,
      8000,
      workspaceId ?? undefined
    );
  }

  await waitForConnectionState(
    ownerPage,
    "sync-status-indicator",
    "connected",
    15_000
  );

  if (requireBoardSync && workspaceId) {
    let ownerWorkspaceReady = await waitForSharedWorkspaceState(
      ownerPage,
      workspaceId,
      15_000
    );

    if (!ownerWorkspaceReady) {
      const seededBoardName = `E2E Seed ${Date.now()}`;
      const seeded = await createBoardForSyncSeed(ownerPage, seededBoardName);
      if (seeded) {
        ownerWorkspaceReady = await waitForSharedWorkspaceState(
          ownerPage,
          workspaceId,
          15_000
        );
      }
    }

    if (!ownerWorkspaceReady) {
      console.warn(
        "Owner shared workspace state remained empty before editor join",
        { workspaceId }
      );
    }
  }

  await editorPage.goto(shareLink);
  await waitForAppReady(editorPage);
  await waitForShareJoinFlowToSettle(editorPage, shareToken, 6000);

  const editorJoinResult = await joinWorkspaceFromShareToken(
    editorPage,
    shareToken
  );

  if (!editorJoinResult.ok) {
    throw new Error(
      `Editor failed to join shared workspace (status=${editorJoinResult.status})`
    );
  }

  const editorWorkspaceId =
    editorJoinResult.workspaceId ?? workspaceId ?? undefined;
  const editorWorkspaceName =
    editorJoinResult.workspaceName ?? expectedWorkspaceName;

  let editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
    editorPage,
    editorWorkspaceName,
    8000,
    editorWorkspaceId
  );

  try {
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );
  } catch {
    // Non-board collaboration tests can recover via explicit join/switch flow.
  }

  if (requireBoardSync) {
    let editorHasBoard = await waitForBoardNodeVisible(editorPage, 8000);
    let editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;

    if (!editorReadyForBoardSync) {
      editorHasBoard = await recoverEditorWorkspaceFromShare(
        editorPage,
        shareLink,
        shareToken,
        {
          requireBoardSync: true,
          expectedWorkspaceName: editorWorkspaceName,
        }
      );
      editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
        editorPage,
        editorWorkspaceName,
        6000,
        editorWorkspaceId
      );
      editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;
    }

    if (!editorReadyForBoardSync && editorWorkspaceId) {
      await waitForSharedWorkspaceState(ownerPage, editorWorkspaceId, 10_000);
      editorHasBoard = await waitForBoardNodeVisible(editorPage, 5000);
      editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
        editorPage,
        editorWorkspaceName,
        6000,
        editorWorkspaceId
      );
      editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;
    }

    if (!editorReadyForBoardSync) {
      throw new Error(
        "Editor workspace did not load expected shared board after share join"
      );
    }
  } else {
    let editorSharedReady = await waitForSharedWorkspaceUi(editorPage, 5000);
    let editorReadyForSharedUi = editorSharedReady && editorInExpectedWorkspace;

    if (!editorReadyForSharedUi) {
      editorSharedReady = await recoverEditorWorkspaceFromShare(
        editorPage,
        shareLink,
        shareToken,
        {
          requireBoardSync: false,
          expectedWorkspaceName: editorWorkspaceName,
        }
      );
      editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
        editorPage,
        editorWorkspaceName,
        6000,
        editorWorkspaceId
      );
      editorReadyForSharedUi = editorSharedReady && editorInExpectedWorkspace;
    }

    if (!editorReadyForSharedUi) {
      throw new Error(
        "Editor did not enter expected shared workspace after share join"
      );
    }

    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );
  }

  if (workspaceId) {
    await setCurrentWorkspaceFromStore(ownerPage, workspaceId);
    await waitForCurrentWorkspaceId(ownerPage, workspaceId, 3000);
  }

  if (editorWorkspaceId) {
    await setCurrentWorkspaceFromStore(editorPage, editorWorkspaceId);
    await waitForCurrentWorkspaceId(editorPage, editorWorkspaceId, 3000);
  }

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
      serviceWorkers: "block",
    });
    const editorContext = await editorBrowser.newContext({
      storageState: editorSeed.storageState,
      serviceWorkers: "block",
    });
    registerSeedCleanup(ownerContext, ownerSeed);
    registerSeedCleanup(editorContext, editorSeed);

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
    const shareToken = new URL(shareLink).searchParams.get("share");

    if (!shareToken) {
      throw new Error("Share token is missing from generated share link");
    }

    const shareWorkspaceInfo = await getWorkspaceInfoFromShareToken(
      ownerPage,
      shareToken
    );
    const workspaceId = shareWorkspaceInfo.workspaceId;
    const expectedWorkspaceName = shareWorkspaceInfo.workspaceName ?? undefined;

    await ensureExpectedWorkspaceSelected(
      ownerPage,
      expectedWorkspaceName,
      8000,
      workspaceId ?? undefined
    );

    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      15_000
    );

    if (workspaceId) {
      await waitForSharedWorkspaceState(ownerPage, workspaceId, 15_000);
    }

    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);
    await waitForShareJoinFlowToSettle(editorPage, shareToken, 6000);

    const editorJoinResult = await joinWorkspaceFromShareToken(
      editorPage,
      shareToken
    );

    if (!editorJoinResult.ok) {
      throw new Error(
        `Editor failed to join shared workspace (status=${editorJoinResult.status})`
      );
    }

    const editorWorkspaceId =
      editorJoinResult.workspaceId ?? workspaceId ?? undefined;
    const editorWorkspaceName =
      editorJoinResult.workspaceName ?? expectedWorkspaceName;

    let editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
      editorPage,
      editorWorkspaceName,
      8000,
      editorWorkspaceId
    );

    try {
      await waitForConnectionState(
        editorPage,
        "sync-status-indicator",
        "connected",
        10_000
      );
    } catch {
      // Continue to explicit recovery flow below.
    }

    let editorHasBoard = await waitForBoardNodeVisible(editorPage, 8000);
    let editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;

    if (!editorReadyForBoardSync) {
      editorHasBoard = await recoverEditorWorkspaceFromShare(
        editorPage,
        shareLink,
        shareToken,
        {
          requireBoardSync: true,
          expectedWorkspaceName: editorWorkspaceName,
        }
      );
      editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
        editorPage,
        editorWorkspaceName,
        6000,
        editorWorkspaceId
      );
      editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;
    }

    if (!editorReadyForBoardSync && editorWorkspaceId) {
      await waitForSharedWorkspaceState(ownerPage, editorWorkspaceId, 10_000);
      editorHasBoard = await waitForBoardNodeVisible(editorPage, 5000);
      editorInExpectedWorkspace = await ensureExpectedWorkspaceSelected(
        editorPage,
        editorWorkspaceName,
        6000,
        editorWorkspaceId
      );
      editorReadyForBoardSync = editorHasBoard && editorInExpectedWorkspace;
    }

    if (!editorReadyForBoardSync) {
      throw new Error(
        "Editor workspace did not load expected shared board after share join"
      );
    }

    if (workspaceId) {
      await setCurrentWorkspaceFromStore(ownerPage, workspaceId);
      await waitForCurrentWorkspaceId(ownerPage, workspaceId, 3000);
    }

    if (editorWorkspaceId) {
      await setCurrentWorkspaceFromStore(editorPage, editorWorkspaceId);
      await waitForCurrentWorkspaceId(editorPage, editorWorkspaceId, 3000);
    }

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
