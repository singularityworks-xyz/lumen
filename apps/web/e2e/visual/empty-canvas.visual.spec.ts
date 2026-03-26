import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  seedEmptyWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-02: Empty Canvas Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedEmptyWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(500);
  });

  test("canvas chrome with no boards selected", async ({ page }) => {
    const reactFlow = page.locator(".react-flow");
    await expect(reactFlow).toBeVisible();

    await expect(page).toHaveScreenshot("empty-canvas-chrome.png", {
      animations: "disabled",
    });
  });

  test("workspace selector visible in empty canvas", async ({ page }) => {
    const workspaceSelector = page.locator(
      'button:has-text("Visual Test Workspace")'
    );
    await expect(workspaceSelector).toBeVisible();

    await expect(page).toHaveScreenshot("empty-canvas-workspace-selector.png", {
      animations: "disabled",
    });
  });

  test("right controls visible in empty canvas", async ({ page }) => {
    const rightControls = page.locator(".react-flow__controls");
    await expect(rightControls).toBeVisible();

    await expect(page).toHaveScreenshot("empty-canvas-right-controls.png", {
      animations: "disabled",
    });
  });

  test("minimap hidden by default in empty canvas", async ({ page }) => {
    const minimap = page.locator(".react-flow__minimap");
    await expect(minimap).not.toBeVisible();

    await expect(page).toHaveScreenshot("empty-canvas-no-minimap.png", {
      animations: "disabled",
    });
  });

  test("background dots pattern visible", async ({ page }) => {
    const background = page.locator(".react-flow__background");
    await expect(background).toBeVisible();

    await expect(page).toHaveScreenshot("empty-canvas-background-dots.png", {
      animations: "disabled",
    });
  });
});
