import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  seedPopulatedWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-03: Populated Canvas Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await freezeDate(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);
  });

  test("populated seeded canvas with boards", async ({ page }) => {
    const reactFlow = page.locator(".react-flow");
    await expect(reactFlow).toBeVisible();

    const boards = page.locator(".react-flow__node");
    await expect(boards.first()).toBeVisible();

    await expect(page).toHaveScreenshot("populated-canvas-boards-visible.png", {
      animations: "disabled",
    });
  });

  test("board layout stable with two boards", async ({ page }) => {
    const boardNodes = page.locator(".react-flow__node");
    const count = await boardNodes.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await expect(page).toHaveScreenshot(
      "populated-canvas-two-boards-layout.png",
      {
        animations: "disabled",
      }
    );
  });

  test("board columns and tasks visible", async ({ page }) => {
    const columns = page.locator(
      '[data-testid^="column-"], .bg-card.rounded-lg'
    );
    await expect(columns.first()).toBeVisible();

    await expect(page).toHaveScreenshot("populated-canvas-columns-tasks.png", {
      animations: "disabled",
    });
  });

  test("minimap renders when enabled", async ({ page }) => {
    await page.evaluate(() => {
      const {
        useKanbanStore,
      } = require("@/src/features/kanban/store/kanban-store");
      useKanbanStore.getState().setShowMiniMap(true);
    });

    await page.waitForTimeout(500);

    const minimap = page.locator(".react-flow__minimap");
    await expect(minimap).toBeVisible();

    await expect(page).toHaveScreenshot(
      "populated-canvas-minimap-enabled.png",
      {
        animations: "disabled",
      }
    );
  });

  test("connection rendering between boards", async ({ page }) => {
    await page.evaluate(() => {
      const {
        useKanbanStore,
      } = require("@/src/features/kanban/store/kanban-store");
      const state = useKanbanStore.getState();
      const boards = state.boards.byId;
      const boardIds = Object.keys(boards);
      if (boardIds.length >= 2) {
        state.addConnection(boardIds[0], boardIds[1], "Sprint to Bug");
      }
    });

    await page.waitForTimeout(500);

    const edges = page.locator(".react-flow__edge");
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);

    await expect(page).toHaveScreenshot("populated-canvas-connections.png", {
      animations: "disabled",
    });
  });
});
