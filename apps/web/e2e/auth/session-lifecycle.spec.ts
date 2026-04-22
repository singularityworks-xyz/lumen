import { expect, test } from "@playwright/test";
import {
  createAuthenticatedDevicePage,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E Auth: Session Lifecycle", () => {
  test("user can sign out successfully", async ({ browser }) => {
    const { page } = await createAuthenticatedDevicePage(browser);

    await page.goto("/");
    await waitForAppReady(page);

    // Find the user button. It uses the user's name as the title.
    // The E2E auth seed sets the name to "E2E Test User".
    const userButton = page.locator('button[title="E2E Test User"]');
    await userButton.waitFor({ state: "visible", timeout: 15_000 });
    await userButton.click();

    // Wait for the profile modal to open.
    // We can look for the sign out button.
    const signOutButton = page.locator('button:has-text("Sign out")');
    await signOutButton.waitFor({ state: "visible", timeout: 5000 });

    // Click sign out
    await signOutButton.click();

    // Verify redirect. Depending on the app's routing, it might redirect to /auth/native-signin
    // or just the root / with the welcome screen.
    // Let's just wait for network idle and check that the user button is no longer visible,
    // or that we are on an auth page.
    await page.waitForLoadState("networkidle");

    // Confirm the auth session cookie has been cleared after sign-out.
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === "better-auth.session_token"
    );

    expect(sessionCookie).toBeUndefined();
  });
});
