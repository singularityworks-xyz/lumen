import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const isIgnorableEnvLine = (line: string): boolean =>
  !line || line.startsWith("#") || !line.includes("=");

const resolveIntegerEnv = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

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
} catch {
  // Ignore if .env file doesn't exist - tests will use default or CI env
}

const e2eWebPort = resolveIntegerEnv("E2E_WEB_PORT", 3100);
const e2eWorkersPort = resolveIntegerEnv("E2E_WORKERS_PORT", 3102);
const e2ePresencePort = resolveIntegerEnv("E2E_PRESENCE_PORT", 4100);

const e2eWebUrl = `http://127.0.0.1:${e2eWebPort}`;
const e2eWorkersUrl = `http://127.0.0.1:${e2eWorkersPort}`;
const e2ePresenceHttpUrl = `http://127.0.0.1:${e2ePresencePort}`;
const e2ePresenceWsUrl = `ws://127.0.0.1:${e2ePresencePort}`;

process.env.E2E_WEB_PORT = String(e2eWebPort);
process.env.E2E_WORKERS_PORT = String(e2eWorkersPort);
process.env.E2E_PRESENCE_PORT = String(e2ePresencePort);
process.env.E2E_WEB_URL = e2eWebUrl;
process.env.E2E_WORKERS_URL = e2eWorkersUrl;
process.env.E2E_PRESENCE_URL = e2ePresenceWsUrl;

const useDedicatedServers =
  process.env.PLAYWRIGHT_DEDICATED_SERVERS !== "false";

export default defineConfig({
  testDir: "../apps/web/e2e",
  testIgnore: ["**/*.visual.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  workers: (() => {
    const rawWorkers = process.env.PLAYWRIGHT_WORKERS;
    if (rawWorkers) {
      const parsedWorkers = Number.parseInt(rawWorkers, 10);
      if (Number.isFinite(parsedWorkers) && parsedWorkers >= 1) {
        return parsedWorkers;
      }
    }

    return Math.max(1, availableParallelism());
  })(),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: e2eWebUrl,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
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
  webServer: useDedicatedServers
    ? [
        {
          command: "bun run src/index.ts",
          cwd: "../apps/workers",
          url: `${e2eWorkersUrl}/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            NODE_ENV: "test",
            PORT: String(e2eWorkersPort),
            WEB_URL: e2eWebUrl,
            BETTER_AUTH_URL: e2eWorkersUrl,
            BETTER_AUTH_TRUSTED_ORIGINS: e2eWebUrl,
            ALLOWED_ORIGINS: e2eWebUrl,
          },
        },
        {
          command: "mix phx.server",
          cwd: "../apps/presence",
          url: `${e2ePresenceHttpUrl}/health`,
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            ...process.env,
            PHX_SERVER: "true",
            MIX_ENV: process.env.PRESENCE_MIX_ENV ?? "test",
            PORT: String(e2ePresencePort),
            BETTER_AUTH_URL: e2eWorkersUrl,
            WORKERS_API_URL: e2eWorkersUrl,
            ALLOW_E2E_ANON_SOCKET: "true",
          },
        },
        {
          command: `bun run build && bun run --bun next start --port ${e2eWebPort}`,
          cwd: "../apps/web",
          url: e2eWebUrl,
          reuseExistingServer: false,
          timeout: 300_000,
          env: {
            ...process.env,
            NODE_ENV: "production",
            NEXT_PUBLIC_API_URL: e2eWorkersUrl,
            NEXT_PUBLIC_PRESENCE_WS_URL: e2ePresenceWsUrl,
          },
        },
      ]
    : undefined,
});
