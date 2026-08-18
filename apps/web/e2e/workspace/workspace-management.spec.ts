import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

async function createWorkspaceFromMenu(
  page: Page,
  name: string,
  description?: string
): Promise<void> {
  await page.locator('[data-testid="workspace-selector"]').click();
  await page.locator('[data-testid="create-workspace-option"]').click();

  const nameInput = page.locator('[data-testid="workspace-name-input"]');
  await expect(nameInput).toBeVisible();
  let populated = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    await nameInput.click();
    await nameInput.fill(name);

    const currentValue = await nameInput.inputValue();
    if (currentValue === name) {
      populated = true;
      break;
    }

    await nameInput.press("ControlOrMeta+a");
    await page.keyboard.type(name, { delay: 15 });

    const typedValue = await nameInput.inputValue();
    if (typedValue === name) {
      populated = true;
      break;
    }
  }

  expect(populated).toBe(true);

  if (description) {
    const descriptionInput = page.locator(
      '[data-testid="workspace-description-input"]'
    );
    await descriptionInput.fill(description);
  }

  const createButton = page.locator('[data-testid="workspace-create-submit"]');
  await expect(createButton).toBeEnabled();
  await createButton.click();

  await expect(nameInput).toBeHidden({ timeout: 10_000 });
}

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
    await createWorkspaceFromMenu(
      page,
      "New Test Workspace",
      "Test workspace description"
    );

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

    const duplicatedBoard = page.locator('[data-testid="board-node"]').first();
    await expect(duplicatedBoard).toBeVisible();
  });

  test("reset local workspace", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.waitForTimeout(500);

    const boardNode = page.locator('[data-testid="board-node"]').last();
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

    const boardCountAfterReset = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardCountAfterReset).toBe(0);
  });

  test("delete local workspace", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
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
    await createWorkspaceFromMenu(page, "Second Workspace");

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.waitForTimeout(500);

    const boardInSecond = page.locator('[data-testid="board-node"]').last();
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

    // Only the first workspace's board renders; the second workspace's board
    // belongs to a different workspace and is filtered out of the canvas.
    const boardCountInFirst = await page
      .locator('[data-testid="board-node"]')
      .count();
    expect(boardCountInFirst).toBe(1);
  });

  test("switching workspaces restores dialog context", async ({ page }) => {
    const workspaceSelector = page.locator(
      '[data-testid="workspace-selector"]'
    );
    await createWorkspaceFromMenu(page, "Dialog Test WS");

    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.waitForTimeout(500);

    const boardNode = page.locator('[data-testid="board-node"]').last();
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
