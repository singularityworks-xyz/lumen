import { expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  openWorkspaceSelector,
  seedEmptyWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-05: Workspace Selector and Share UI Visual Regression", () => {
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

  test("workspace selector dropdown renders", async ({ page }) => {
    await openWorkspaceSelector(page);
    await page.waitForTimeout(500);

    const dropdownContent = page.locator('[role="menu"], .absolute.z-50');
    await expect(dropdownContent.first()).toBeVisible();

    await expect(page).toHaveScreenshot(
      "workspace-selector-dropdown-open.png",
      {
        animations: "disabled",
      }
    );
  });

  test("workspace selector shows my workspaces section", async ({ page }) => {
    await openWorkspaceSelector(page);
    await page.waitForTimeout(500);

    const myWorkspacesLabel = page.locator("text=My Workspaces");
    await expect(myWorkspacesLabel).toBeVisible();

    await expect(page).toHaveScreenshot(
      "workspace-selector-my-workspaces.png",
      {
        animations: "disabled",
      }
    );
  });

  test("workspace selector shows create workspace option", async ({ page }) => {
    await openWorkspaceSelector(page);
    await page.waitForTimeout(500);

    const createOption = page.locator('text="Create Workspace"');
    await expect(createOption).toBeVisible();

    await expect(page).toHaveScreenshot(
      "workspace-selector-create-option.png",
      {
        animations: "disabled",
      }
    );
  });

  test("create workspace dialog baseline", async ({ page }) => {
    await openWorkspaceSelector(page);
    await page.waitForTimeout(300);

    const createOption = page.locator('text="Create Workspace"');
    await createOption.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"], .fixed.inset-0.z-50');
    await expect(dialog.first()).toBeVisible();

    await expect(page).toHaveScreenshot("workspace-create-dialog.png", {
      animations: "disabled",
    });
  });

  test("workspace selector shows selected workspace", async ({ page }) => {
    const selectorButton = page.locator(
      'button:has-text("Visual Test Workspace")'
    );
    await expect(selectorButton).toBeVisible();

    await expect(page).toHaveScreenshot(
      "workspace-selector-selected-visible.png",
      {
        animations: "disabled",
      }
    );
  });
});
