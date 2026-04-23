import { expect, test } from "@playwright/test";
import {
  createAuthenticatedDevicePage,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E Auth: Session Lifecycle", () => {
  test("profile modal shows the seeded user details", async ({ browser }) => {
    const { page, seed } = await createAuthenticatedDevicePage(browser);

    await page.goto("/");
    await waitForAppReady(page);

    const userButton = page.locator('button[title="E2E User"]');
    await userButton.waitFor({ state: "visible", timeout: 15_000 });
    await userButton.click();

    const seededEmail = `${seed.userId}@e2e.test`;
    await expect(page.getByText(seededEmail)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("user can sign out successfully", async ({ browser }) => {
    const { page } = await createAuthenticatedDevicePage(browser);

    await page.goto("/");
    await waitForAppReady(page);

    const userButton = page.locator('button[title="E2E User"]');
    await userButton.waitFor({ state: "visible", timeout: 15_000 });
    await userButton.click();

    const signOutButton = page.getByRole("button", { name: "Sign out" });
    await signOutButton.waitFor({ state: "visible", timeout: 5000 });

    await signOutButton.click();
    await page.waitForLoadState("networkidle");
    await waitForAppReady(page);

    // Confirm the auth session cookie has been cleared after sign-out.
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === "better-auth.session_token"
    );

    expect(sessionCookie).toBeUndefined();
    await expect(signOutButton).toHaveCount(0);
  });
});
