import { defineConfig, devices } from "@playwright/test";

const isCI = process.env.CI === "true";
const configuredPresenceUrl = process.env.PRESENCE_URL;
const presenceBaseUrl = configuredPresenceUrl ?? "http://127.0.0.1:4010";
const presenceUrl = new URL(presenceBaseUrl);
const presencePort =
  presenceUrl.port || (presenceUrl.protocol === "https:" ? "443" : "80");
const shouldStartPresenceServer = configuredPresenceUrl === undefined;

process.env.PRESENCE_URL = presenceBaseUrl;
process.env.ALLOW_E2E_ANON_SOCKET = process.env.ALLOW_E2E_ANON_SOCKET ?? "true";

const configuredWorkers = Number.parseInt(
  process.env.PLAYWRIGHT_WORKERS ?? "1",
  10
);
const workers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : 1;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : workers,
  reporter: [
    ["html", { outputFolder: "e2e-report" }],
    ["json", { outputFile: "e2e-results.json" }],
  ],
  use: {
    baseURL: presenceBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
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
  ],
  webServer: shouldStartPresenceServer
    ? {
        command: `MIX_ENV=test PORT=${presencePort} mix phx.server`,
        cwd: ".",
        env: {
          ALLOW_E2E_ANON_SOCKET: process.env.ALLOW_E2E_ANON_SOCKET,
          PHX_SERVER: "true",
        },
        reuseExistingServer: false,
        timeout: 120_000,
        url: `${presenceBaseUrl}/health`,
      }
    : undefined,
});
