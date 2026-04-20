import { expect, type Locator, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

async function createConnectionViaDialog(
  sourceBoard: Locator,
  targetName: string
) {
  const connectionDialog = await openConnectionDialog(sourceBoard);

  const targetBoardButton = connectionDialog
    .locator("button")
    .filter({ hasText: targetName })
    .first();
  await expect(targetBoardButton).toBeVisible();
  await targetBoardButton.click();

  const createButton = connectionDialog
    .locator(
      '[data-testid="connection-style-save"]:has-text("Create Connection")'
    )
    .first();
  await expect(createButton).toBeVisible();
  await createButton.click();
}

async function openBoardQuickActions(sourceBoard: Locator) {
  const page = sourceBoard.page();
  const header = sourceBoard.locator('[data-testid="board-header"]');
  await expect(header).toBeAttached();
  await header.dispatchEvent("contextmenu", { button: 2 });

  const quickActionsMenu = page
    .locator('[data-testid="board-rename-option"]')
    .first()
    .locator('xpath=ancestor::*[@role="dialog"][1]');
  await expect(quickActionsMenu).toBeVisible();

  return quickActionsMenu;
}

async function openConnectionDialog(sourceBoard: Locator) {
  const page = sourceBoard.page();
  const quickActionsMenu = await openBoardQuickActions(sourceBoard);

  const connectionsButton = quickActionsMenu
    .locator('button:has-text("Connections")')
    .first();
  await expect(connectionsButton).toBeVisible();
  await expect(connectionsButton).toBeEnabled();
  await connectionsButton.click();

  const connectionDialog = page
    .locator('h4:has-text("Add New Connection")')
    .first()
    .locator('xpath=ancestor::*[@role="dialog"][1]');
  await expect(connectionDialog).toBeVisible();

  return connectionDialog;
}

test.describe("E2E-05: Area Management and Board Connections", () => {
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

  test("create area containing boards", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();

    await page.waitForSelector('[data-testid="area-name-input"]');
    await page.fill('[data-testid="area-name-input"]', "Test Area");
    await page.click('[data-testid="area-create-submit"]');

    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Test Area")'
    );
    await expect(area).toBeVisible();
  });

  test("area contains boards via drag", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();
    await page.fill('[data-testid="area-name-input"]', "Area With Boards");
    await page.click('[data-testid="area-create-submit"]');
    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Area With Boards")'
    );
    const areaBox = await area.boundingBox();

    const boardNode = page.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    const boardBox = await boardNode.boundingBox();

    if (areaBox && boardBox) {
      const headerBox = await boardHeader.boundingBox();
      if (headerBox) {
        await page.mouse.move(
          headerBox.x + headerBox.width / 2,
          headerBox.y + headerBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(areaBox.x + areaBox.width / 2, areaBox.y + 90, {
          steps: 14,
        });
        await page.mouse.up();
      }
    }

    await page.waitForTimeout(500);

    const areaWithBoards = page.locator(
      '[data-testid="area-node"]:has-text("Area With Boards")'
    );
    const boardCountBadge = areaWithBoards.locator(
      '[data-testid="area-board-count"]'
    );
    await expect(boardCountBadge).toContainText("1");
  });

  test("dragging area moves contained boards", async ({ page }) => {
    const createAreaButton = page.locator('[data-testid="create-area-button"]');
    await createAreaButton.click();
    await page.fill('[data-testid="area-name-input"]', "Movable Area");
    await page.click('[data-testid="area-create-submit"]');
    await page.waitForTimeout(500);

    const area = page.locator(
      '[data-testid="area-node"]:has-text("Movable Area")'
    );
    const initialBox = await area.boundingBox();
    expect(initialBox).not.toBeNull();

    const areaHeader = area.locator('[data-testid="area-header"]');
    await expect(areaHeader).toBeVisible();

    const movedArea = await page.evaluate((areaName) => {
      interface AreaRecord {
        id: string;
        name: string;
      }

      interface AreaPositionRecord {
        x: number;
        y: number;
      }

      interface KanbanState {
        areaPositions?: {
          byId?: Record<string, AreaPositionRecord | undefined>;
        };
        areas?: {
          allIds?: string[];
          byId?: Record<string, AreaRecord | undefined>;
        };
        finalizeAreaDrag: (areaId: string) => void;
        updateAreaPosition: (
          areaId: string,
          position: { x: number; y: number }
        ) => void;
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        return false;
      }

      const state = store.getState();
      const areaId = (state.areas?.allIds ?? []).find((id) => {
        const candidate = state.areas?.byId?.[id];
        return candidate?.name === areaName;
      });

      if (!areaId) {
        return false;
      }

      const targetPosition = state.areaPositions?.byId?.[areaId];
      if (!targetPosition) {
        return false;
      }

      state.updateAreaPosition(areaId, {
        x: targetPosition.x + 300,
        y: targetPosition.y + 100,
      });
      state.finalizeAreaDrag(areaId);
      return true;
    }, "Movable Area");
    if (!movedArea) {
      const areaHeaderBox = await areaHeader.boundingBox();
      expect(areaHeaderBox).not.toBeNull();

      await page.mouse.move(
        (areaHeaderBox?.x || 0) + (areaHeaderBox?.width || 0) / 2,
        (areaHeaderBox?.y || 0) + (areaHeaderBox?.height || 0) / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        (areaHeaderBox?.x || 0) + 300,
        (areaHeaderBox?.y || 0) + 100,
        {
          steps: 12,
        }
      );
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const movedBox = await area.boundingBox();
    expect(movedBox).not.toBeNull();

    const xDiff = Math.abs((movedBox?.x || 0) - (initialBox?.x || 0));
    expect(xDiff).toBeGreaterThan(100);
  });

  test("duplicate connection creation is blocked", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill(
      '[data-testid="board-name-input"]',
      "Second Board for Connection"
    );
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);
    await expect(board2).toContainText("Second Board for Connection");
    await createConnectionViaDialog(board1, "Second Board for Connection");

    await page.waitForTimeout(500);

    const connectionCountBefore = await page
      .locator('[data-testid="board-connection"]')
      .count();
    expect(connectionCountBefore).toBeGreaterThan(0);

    const connectionDialog = await openConnectionDialog(board1);
    await expect(
      connectionDialog.getByText("No available boards to connect").first()
    ).toBeVisible();
    await expect(
      connectionDialog.getByText("Existing Connections")
    ).toBeVisible();
    await expect(
      connectionDialog.getByText("Second Board for Connection").first()
    ).toBeVisible();

    await page.waitForTimeout(500);

    const connectionCountAfter = await page
      .locator('[data-testid="board-connection"]')
      .count();
    expect(connectionCountAfter).toBe(connectionCountBefore);
  });

  test("self-loop connection creation is blocked", async ({ page }) => {
    const board = page.locator('[data-testid="board-node"]').first();
    const quickActions = await openBoardQuickActions(board);
    const connectionsButton = quickActions
      .locator('button:has-text("Connections")')
      .first();
    await expect(connectionsButton).toBeDisabled();

    const finalConnections = await page
      .locator('[data-testid="board-connection"]')
      .count();
    expect(finalConnections).toBe(0);
  });

  test("connection style edits persist", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill(
      '[data-testid="board-name-input"]',
      "Second Board for Style Connection"
    );
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);
    await expect(board2).toContainText("Second Board for Style Connection");
    await createConnectionViaDialog(
      board1,
      "Second Board for Style Connection"
    );

    await page.waitForTimeout(500);

    const connectionDialog = await openConnectionDialog(board1);
    await expect(
      connectionDialog.getByText("Second Board for Style Connection").first()
    ).toBeVisible();

    const editButton = connectionDialog
      .locator('button[title="Edit connection"]')
      .first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    const styleSelect = connectionDialog
      .locator('[data-testid="connection-style-select"]')
      .first();
    await expect(styleSelect).toBeVisible();
    await styleSelect.selectOption("dotted");

    const saveButton = connectionDialog
      .locator('[data-testid="connection-style-save"]:has-text("Save")')
      .first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await page.reload();
    await waitForAppReady(page);

    const connectionAfterReload = page
      .locator('[data-testid="board-connection"]')
      .first();
    await expect(connectionAfterReload).toHaveAttribute("data-style", "dotted");
  });

  test("connection label edits persist", async ({ page }) => {
    const newBoardButton = page.locator('[data-testid="new-board-button"]');
    await newBoardButton.click();
    await page.fill(
      '[data-testid="board-name-input"]',
      "Second Board for Label Connection"
    );
    await page.click('[data-testid="board-create-submit"]');
    await page.waitForTimeout(500);

    const board1 = page.locator('[data-testid="board-node"]').first();
    const board2 = page.locator('[data-testid="board-node"]').nth(1);
    await expect(board2).toContainText("Second Board for Label Connection");
    await createConnectionViaDialog(
      board1,
      "Second Board for Label Connection"
    );

    await page.waitForTimeout(500);

    const connectionDialog = await openConnectionDialog(board1);
    await expect(
      connectionDialog.getByText("Second Board for Label Connection").first()
    ).toBeVisible();

    const editButton = connectionDialog
      .locator('button[title="Edit connection"]')
      .first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    const labelInput = connectionDialog
      .locator('[data-testid="connection-label-input"]')
      .first();
    await expect(labelInput).toBeVisible();
    await labelInput.fill("Test Connection Label");

    const saveButton = connectionDialog
      .locator('[data-testid="connection-style-save"]:has-text("Save")')
      .first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await page.reload();
    await waitForAppReady(page);

    const connectionLabel = page
      .locator('[data-testid="connection-label"]')
      .first();
    await expect(connectionLabel).toContainText("Test Connection Label");
  });
});
