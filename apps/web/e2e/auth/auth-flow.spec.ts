import { expect, test } from "@playwright/test";
import {
  createAuthenticatedDevicePage,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E Auth: Auth Flow", () => {
  test("guest session renders the app without the seeded auth user", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await waitForAppReady(page);

    const guestButton = page.locator('button[title="Guest"]');
    await expect(guestButton).toBeVisible();
    await expect(page.locator('button[title="E2E User"]')).toHaveCount(0);
  });

  test("seeded auth is reflected in the app shell", async ({ browser }) => {
    const { page, seed } = await createAuthenticatedDevicePage(browser);

    await page.goto("/");
    await waitForAppReady(page);

    const userButton = page.locator('button[title="E2E User"]');
    await expect(userButton).toBeVisible();

    await userButton.click();
    await expect(page.getByText(`${seed.userId}@e2e.test`)).toBeVisible();
  });
});
