import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "./helpers/commands";

test.describe("E2E-01: App Shell and Welcome Flow", () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorageAndIndexedDB(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");
  });

  test("app shell hydrates without error", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");

    const hasWorkspaceSelector = await page
      .locator('[data-testid="workspace-selector"]')
      .isVisible();
    expect(hasWorkspaceSelector).toBeTruthy();

    const criticalErrors = consoleErrors.filter(
      (err) => !(err.includes("Warning") || err.includes("hydration"))
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("welcome screen appears for empty workspace", async ({ page }) => {
    const welcomeScreen = page.locator('[data-testid="welcome-screen"]');
    await expect(welcomeScreen).toBeVisible();

    const createFirstBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    await expect(createFirstBoardButton).toBeVisible();
  });

  test("first-board CTA creates the initial board", async ({ page }) => {
    const createFirstBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    await createFirstBoardButton.click();

    await page.waitForTimeout(500);

    const boardNode = page.locator('[data-testid="board-node"]');
    await expect(boardNode).toBeVisible({ timeout: 10_000 });

    const welcomeScreen = page.locator('[data-testid="welcome-screen"]');
    await expect(welcomeScreen).not.toBeVisible();
  });

  test("workspace selector is present after board creation", async ({
    page,
  }) => {
    const createFirstBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    await createFirstBoardButton.click();

    await page.waitForTimeout(500);

    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await expect(workspaceSelector).toBeVisible();

    const workspaceName = await workspaceSelector.textContent();
    expect(workspaceName).toBeTruthy();
  });

  test("canvas is visible and interactive after board creation", async ({
    page,
  }) => {
    const createFirstBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    await createFirstBoardButton.click();

    await page.waitForTimeout(1000);

    const canvas = page.locator(".react-flow");
    await expect(canvas).toBeVisible();

    const boardNode = page.locator('[data-testid="board-node"]');
    await expect(boardNode).toBeVisible();
  });
});
