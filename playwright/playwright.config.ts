import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
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
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: (() => {
    const rawWorkers = process.env.PLAYWRIGHT_WORKERS;
    if (rawWorkers) {
      const parsedWorkers = Number.parseInt(rawWorkers, 10);
      if (Number.isFinite(parsedWorkers) && parsedWorkers >= 1) {
        return parsedWorkers;
      }
    }

    if (process.env.CI) {
      return 2;
    }

    const halfCores = Math.floor(availableParallelism() / 2);
    return Math.max(2, Math.min(6, halfCores));
  })(),
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
