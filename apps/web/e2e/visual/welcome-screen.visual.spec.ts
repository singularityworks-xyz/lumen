import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  seedEmptyWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-01: Welcome Screen Visual Regression", () => {
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

  test("welcome screen matches baseline in empty workspace", async ({
    page,
  }) => {
    const welcomeScreen = page.locator(
      ".pointer-events-auto.relative.w-full.max-w-sm"
    );
    await expect(welcomeScreen).toBeVisible();

    await expect(page).toHaveScreenshot("welcome-screen-empty-workspace.png", {
      animations: "disabled",
    });
  });

  test("welcome screen shows create first board button", async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create Your First Board")'
    );
    await expect(createButton).toBeVisible();

    await expect(page).toHaveScreenshot(
      "welcome-screen-create-button-visible.png",
      {
        animations: "disabled",
      }
    );
  });

  test("welcome screen shows help button", async ({ page }) => {
    const helpButton = page.locator(
      'button:has-text("Help & Shortcuts"), button:has-text("View Keyboard Shortcuts")'
    );
    await expect(helpButton).toBeVisible();

    await expect(page).toHaveScreenshot(
      "welcome-screen-help-button-visible.png",
      {
        animations: "disabled",
      }
    );
  });

  test("welcome screen logo and branding visible", async ({ page }) => {
    const logo = page.locator("img[alt='Lumen Logo']").first();
    await expect(logo).toBeVisible();

    const title = page.locator("h1:has-text('Lumen')");
    await expect(title).toBeVisible();

    await expect(page).toHaveScreenshot("welcome-screen-logo-visible.png", {
      animations: "disabled",
    });
  });
});
