import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  seedEmptyWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-AI-01: AI Drawer Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await freezeDate(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedEmptyWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(500);
  });

  test("AI floating indicator visible", async ({ page }) => {
    await expect(page).toHaveScreenshot("ai-floating-indicator.png", {
      animations: "disabled",
    });
  });

  test("AI drawer open in light mode", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Light mode visual test only on chromium"
    );

    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("ai-drawer-open-light.png", {
      animations: "disabled",
    });
  });

  test("AI drawer open in dark mode", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Dark mode visual test only on chromium"
    );

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(300);

    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("ai-drawer-open-dark.png", {
      animations: "disabled",
    });
  });

  test("AI drawer empty state with suggestions", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Visual test only on chromium");

    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();
    await page.waitForTimeout(500);

    // Focus on just the drawer content area
    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveScreenshot("ai-drawer-empty-state.png", {
      animations: "disabled",
    });
  });
});
