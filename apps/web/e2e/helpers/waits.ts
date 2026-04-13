import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const CONNECTED_REGEX = /connected|synced|online/i;
const DISCONNECTED_REGEX = /disconnected|offline/i;

export async function waitForDrawerOpen(
  page: Page,
  drawerTestId: string,
  triggerLocator: Locator
): Promise<void> {
  await triggerLocator.click();
  await page
    .locator(`[data-testid="${drawerTestId}"]`)
    .waitFor({ state: "visible", timeout: 5000 });
}

export async function waitForDrawerClose(
  page: Page,
  drawerTestId: string
): Promise<void> {
  await page
    .locator(`[data-testid="${drawerTestId}"]`)
    .waitFor({ state: "hidden", timeout: 5000 });
}

export async function waitForCollabSync(
  page: Page,
  expectedTestId: string,
  expectedText?: string,
  timeout = 10_000
): Promise<Locator> {
  const selector = expectedText
    ? `[data-testid="${expectedTestId}"]:has-text("${expectedText}")`
    : `[data-testid="${expectedTestId}"]`;
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

export async function waitForCollabSyncHidden(
  page: Page,
  expectedTestId: string,
  expectedText?: string,
  timeout = 10_000
): Promise<Locator> {
  const selector = expectedText
    ? `[data-testid="${expectedTestId}"]:has-text("${expectedText}")`
    : `[data-testid="${expectedTestId}"]`;
  const locator = page.locator(selector);
  await locator.waitFor({ state: "hidden", timeout });
  return locator;
}

export async function waitForDragEnd(
  page: Page,
  elementTestId: string,
  expectedFinalText?: string
): Promise<void> {
  if (expectedFinalText) {
    await page
      .locator(
        `[data-testid="${elementTestId}"]:has-text("${expectedFinalText}")`
      )
      .waitFor({ state: "visible", timeout: 10_000 });
  }
  await page.waitForLoadState("networkidle");
}

export async function waitForConnectionState(
  page: Page,
  syncIndicatorTestId: string,
  expectedState: "connected" | "disconnected",
  timeout = 5000
): Promise<void> {
  const indicator = page.locator(`[data-testid="${syncIndicatorTestId}"]`);
  await indicator.waitFor({ state: "visible", timeout });
  const regex =
    expectedState === "connected" ? CONNECTED_REGEX : DISCONNECTED_REGEX;
  await expect(indicator).toContainText(regex, { timeout });
}

export async function waitForPresenceCursor(
  page: Page,
  cursorOrCount?: string | number,
  cursorTestIdOrTimeout?: string | number,
  timeout = 5000
): Promise<Locator | Locator[]> {
  let cursorTestId: string;
  let expectedCount: number | undefined;
  let resolvedTimeout = timeout;

  if (cursorOrCount === undefined) {
    cursorTestId = "peer-cursor";
  } else if (typeof cursorOrCount === "number") {
    expectedCount = cursorOrCount;
    cursorTestId = (cursorTestIdOrTimeout as string) ?? "peer-cursor";
    resolvedTimeout =
      typeof cursorTestIdOrTimeout === "number"
        ? cursorTestIdOrTimeout
        : timeout;
  } else {
    cursorTestId = cursorOrCount;
    resolvedTimeout = (cursorTestIdOrTimeout as number) ?? 5000;
  }

  const cursor = page.locator(`[data-testid="${cursorTestId}"]`);

  if (expectedCount !== undefined) {
    await expect(cursor).toHaveCount(expectedCount, {
      timeout: resolvedTimeout,
    });
    return cursor.all();
  }

  await cursor.waitFor({ state: "visible", timeout: resolvedTimeout });
  return cursor;
}

export async function waitForPresenceCursorHidden(
  page: Page,
  cursorTestId = "peer-cursor",
  timeout = 10_000
): Promise<Locator> {
  const cursor = page.locator(`[data-testid="${cursorTestId}"]`);
  await cursor.waitFor({ state: "hidden", timeout });
  return cursor;
}

export async function waitForNetworkIdleForPage(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

export async function waitForReconnected(
  page: Page,
  syncIndicatorTestId = "sync-status-indicator",
  timeout = 10_000
): Promise<void> {
  const indicator = page.locator(`[data-testid="${syncIndicatorTestId}"]`);
  await indicator.waitFor({ state: "visible", timeout });
  await expect(indicator).toContainText(CONNECTED_REGEX, { timeout });
}

export async function waitForDisconnected(
  page: Page,
  syncIndicatorTestId = "sync-status-indicator",
  timeout = 5000
): Promise<void> {
  const indicator = page.locator(`[data-testid="${syncIndicatorTestId}"]`);
  await indicator.waitFor({ state: "visible", timeout });
  await expect(indicator).toContainText(DISCONNECTED_REGEX, { timeout });
}

export async function waitForPeerCursors(
  page: Page,
  expectedCount: number,
  cursorTestId = "peer-cursor",
  timeout = 5000
): Promise<Locator[]> {
  const cursor = page.locator(`[data-testid="${cursorTestId}"]`);
  await expect(cursor).toHaveCount(expectedCount, { timeout });
  return cursor.all();
}

export async function waitForCollabUpdate<T extends string>(
  page: Page,
  expectedTestId: string,
  expectedText: T,
  timeout = 10_000
): Promise<Locator> {
  const selector = `[data-testid="${expectedTestId}"]:has-text("${expectedText}")`;
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

export async function waitForCollabUpdateCount(
  page: Page,
  testId: string,
  expectedCount: number,
  timeout = 10_000
): Promise<Locator[]> {
  const locator = page.locator(`[data-testid="${testId}"]`);
  await expect(locator).toHaveCount(expectedCount, { timeout });
  return locator.all();
}

export async function waitForPeerSelection(
  page: Page,
  selectionTestId = "peer-selection",
  timeout = 5000
): Promise<Locator> {
  const selection = page.locator(`[data-testid="${selectionTestId}"]`);
  await selection.waitFor({ state: "visible", timeout });
  return selection;
}
