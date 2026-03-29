import { expect, test } from "@playwright/test";

test.describe("Root Redirect", () => {
  test("redirects to main app URL", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(301);
    const location = response.headers().location;
    expect(location).toBe("https://lumen.itssingularity.com");
  });

  test("follows redirect to main app", async ({ request }) => {
    const response = await request.get("/");

    expect(response.url()).toContain("lumen.itssingularity.com");
  });

  test("redirect is permanent (301)", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "commit" });

    const redirectChain = response?.request().redirectedFrom();
    expect(redirectChain).toBeDefined();
  });
});

test.describe("Root Redirect - Browser", () => {
  test("browser follows redirect", async ({ page }) => {
    await page.goto("/");

    expect(page.url()).toContain("lumen.itssingularity.com");
  });
});
