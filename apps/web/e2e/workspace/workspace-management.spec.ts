import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-06: Workspace Management", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("create local workspace", async ({ page }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="create-workspace-option"]');
    await page.click('[data-testid="create-workspace-option"]');

    await page.waitForSelector('[data-testid="workspace-name-input"]');
    await page.fill(
      '[data-testid="workspace-name-input"]',
      "New Test Workspace"
    );
    await page.fill(
      '[data-testid="workspace-description-input"]',
      "Test workspace description"
    );
    await page.click('[data-testid="workspace-create-submit"]');

    await page.waitForTimeout(500);

    await page.locator('[data-testid="workspace-selector"]').click();
    const workspaceOption = page.locator(
      '[data-testid="workspace-option"]:has-text("New Test Workspace")'
    );
    await expect(workspaceOption).toBeVisible();
  });

  test("rename local workspace", async ({ page }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click({ button: "right" });

    await page.waitForSelector('[data-testid="workspace-rename-option"]');
    await page.click('[data-testid="workspace-rename-option"]');

    await page.waitForSelector('[data-testid="workspace-rename-input"]');
    await page.fill(
      '[data-testid="workspace-rename-input"]',
      "Renamed Workspace"
    );
    await page.click('[data-testid="workspace-rename-submit"]');

    await page.waitForTimeout(300);

    await expect(workspaceSelector.locator("span")).toContainText(
      "Renamed Workspace"
    );
  });

  test("duplicate local workspace", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Board in Original");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click({ button: "right" });

    await page.waitForSelector('[data-testid="workspace-duplicate-option"]');
    await page.click('[data-testid="workspace-duplicate-option"]');

    await page.waitForSelector(
      '[data-testid="workspace-duplicate-name-input"]'
    );
    await page.fill(
      '[data-testid="workspace-duplicate-name-input"]',
      "Duplicated Workspace"
    );
    await page.click('[data-testid="workspace-duplicate-submit"]');

    await page.waitForTimeout(500);

    const selector = page.locator('[data-testid="workspace-selector"]');
    await expect(selector.locator("span")).toContainText(
      "Duplicated Workspace"
    );

    const duplicatedBoard = page.locator(
      '[data-testid="board-node"]:has-text("Board in Original")'
    );
    await expect(duplicatedBoard).toBeVisible();
  });

  test("reset local workspace", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Board to Reset");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const boardNode = page.locator(
      '[data-testid="board-node"]:has-text("Board to Reset")'
    );
    await expect(boardNode).toBeVisible();

    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click({ button: "right" });

    await page.waitForSelector('[data-testid="workspace-reset-option"]');
    await page.click('[data-testid="workspace-reset-option"]');

    await page.waitForSelector(
      '[data-testid="workspace-reset-confirm-checkbox"]'
    );
    await page.click('[data-testid="workspace-reset-confirm-checkbox"]');
    await page.click('[data-testid="workspace-reset-submit"]');

    await page.waitForTimeout(500);

    await expect(boardNode).not.toBeVisible();
  });

  test("delete local workspace", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Board to Delete");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click({ button: "right" });

    await page.waitForSelector('[data-testid="workspace-delete-option"]');
    await page.click('[data-testid="workspace-delete-option"]');

    await page.waitForSelector(
      '[data-testid="workspace-delete-confirm-input"]'
    );
    await page.fill('[data-testid="workspace-delete-confirm-input"]', "DELETE");
    await page.click('[data-testid="workspace-delete-submit"]');

    await page.waitForTimeout(500);

    const welcomeScreen = page.locator('[data-testid="welcome-screen"]');
    await expect(welcomeScreen).toBeVisible();
  });

  test("switching workspaces restores board context", async ({ page }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="create-workspace-option"]');
    await page.click('[data-testid="create-workspace-option"]');

    await page.fill('[data-testid="workspace-name-input"]', "Second Workspace");
    await page.click('[data-testid="workspace-create-submit"]');
    await page.waitForTimeout(500);

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Board in Second WS");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const boardInSecond = page.locator(
      '[data-testid="board-node"]:has-text("Board in Second WS")'
    );
    await expect(boardInSecond).toBeVisible();

    await workspaceSelector.click();
    await page.waitForSelector('[data-testid="workspace-option"]');
    const firstWorkspace = page
      .locator('[data-testid="workspace-option"]')
      .first();
    await firstWorkspace.click();

    await page.waitForTimeout(500);

    const boardInFirst = page.locator('[data-testid="board-node"]').first();
    await expect(boardInFirst).toBeVisible();
    await expect(boardInSecond).not.toBeVisible();
  });

  test("switching workspaces restores dialog context", async ({ page }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await workspaceSelector.click();

    await page.waitForSelector('[data-testid="create-workspace-option"]');
    await page.click('[data-testid="create-workspace-option"]');

    await page.fill('[data-testid="workspace-name-input"]', "Dialog Test WS");
    await page.click('[data-testid="workspace-create-submit"]');
    await page.waitForTimeout(500);

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill('[data-testid="board-name-input"]', "Dialog Test Board");
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const boardNode = page.locator(
      '[data-testid="board-node"]:has-text("Dialog Test Board")'
    );
    await boardNode
      .locator('[data-testid="board-header"]')
      .click({ button: "right" });

    await page.waitForSelector('[data-testid="board-rename-option"]');

    await workspaceSelector.click();
    await page.waitForSelector('[data-testid="workspace-option"]');
    const firstWorkspace = page
      .locator('[data-testid="workspace-option"]')
      .first();
    await firstWorkspace.click();

    await page.waitForTimeout(500);

    await workspaceSelector.click();
    await page.waitForSelector(
      '[data-testid="workspace-option"]:has-text("Dialog Test WS")'
    );
    await page.click(
      '[data-testid="workspace-option"]:has-text("Dialog Test WS")'
    );

    await page.waitForTimeout(500);

    const dialogRestore = page.locator('[data-testid="board-rename-dialog"]');
    await expect(dialogRestore).toBeVisible();
  });
});
