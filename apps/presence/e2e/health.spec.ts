import { expect, test } from "@playwright/test";

const ISO8601_UTC_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/;
const ISO8601_MICROSECONDS_TO_MILLISECONDS_REGEX = /\.(\d{3})\d*Z$/;

test.describe("Health Endpoint", () => {
  test("returns healthy status", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("presence");
    expect(body.timestamp).toBeDefined();
  });

  test("returns valid ISO8601 timestamp", async ({ request }) => {
    const response = await request.get("/health");
    const body = await response.json();

    expect(typeof body.timestamp).toBe("string");
    expect(body.timestamp).toMatch(ISO8601_UTC_TIMESTAMP_REGEX);
    expect(Date.parse(body.timestamp)).not.toBeNaN();

    const parsedResult = new Date(body.timestamp).toISOString();
    const normalizedTimestamp = body.timestamp.replace(
      ISO8601_MICROSECONDS_TO_MILLISECONDS_REGEX,
      ".$1Z"
    );
    expect(normalizedTimestamp).toBe(parsedResult);
  });

  test("handles concurrent requests", async ({ request }) => {
    const requests = new Array(10).fill(null).map(() => request.get("/health"));
    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
  });

  test("returns JSON content type", async ({ request }) => {
    const response = await request.get("/health");
    const contentType = response.headers()["content-type"];

    expect(contentType).toContain("application/json");
  });
});

test.describe("Health Endpoint - Browser", () => {
  test("displays healthy status in browser", async ({ page }) => {
    const response = await page.goto("/health");

    expect(response?.status()).toBe(200);

    const body = await page.locator("body").textContent();
    const data = JSON.parse(body || "{}");

    expect(data.status).toBe("healthy");
  });
});

test.describe("Visual Regression", () => {
  // Follow-up tracked in docs/presence-health-screenshot-follow-up.md (GitHub issue creation currently blocked by local gh auth).
  test.fixme("health endpoint screenshot", async ({ page }) => {
    await page.goto("/health");
    await expect(page).toHaveScreenshot("health-endpoint.png", {
      maxDiffPixels: 100,
    });
  });
});
