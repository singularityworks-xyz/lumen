import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const isIgnorableEnvLine = (line: string): boolean =>
  !line || line.startsWith("#") || !line.includes("=");

try {
  const workersEnvPath = fileURLToPath(
    new URL("../apps/workers/.env", import.meta.url)
  );
  const envConfig = readFileSync(workersEnvPath, "utf-8");
  for (const rawLine of envConfig.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (isIgnorableEnvLine(line)) {
      continue;
    }

    const [rawKey, ...value] = line.split("=");
    const key = rawKey.trim();
    if (key && value.length > 0) {
      process.env[key] = value.join("=").trim();
    }
  }
} catch (_e) {
  // Ignore if .env file doesn't exist - tests will use default or CI env
}

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
