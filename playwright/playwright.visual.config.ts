import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../apps/web/e2e/visual",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    colorScheme: "light",
    viewport: { width: 1280, height: 720 },
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: {
      "x-playwright-visual-test": "true",
    },
  },
  snapshotPathTemplate:
    "../apps/web/e2e/visual/__screenshots__/{/projectName}/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      threshold: 0.015,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        viewport: { width: 1280, height: 720 },
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
      },
    },
    {
      name: "chromium-dark",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
        viewport: { width: 1280, height: 720 },
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
      },
    },
  ],
  webServer: {
    command: "bun run dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
