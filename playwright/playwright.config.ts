import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";

try {
  const envConfig = readFileSync("../apps/workers/.env", "utf-8");
  for (const line of envConfig.split("\\n")) {
    const [key, ...value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.join("=").trim();
    }
  }
} catch (e) {}

export default defineConfig({
  testDir: "../apps/web/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  /*webServer: [
    {
      command: "cd ../apps/web && bun run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "cd ../apps/workers && bun run dev",
      url: "http://localhost:3002",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "cd ../apps/presence && mix phx.server",
      url: "http://localhost:4001",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],*/
});
