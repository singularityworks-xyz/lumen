import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const storageStatePath = path.join(
  import.meta.dirname,
  "e2e",
  "fixtures",
  "storage-state.json"
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    storageState: storageStatePath,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "cd apps/web && bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  timeout: 30_000,
});
