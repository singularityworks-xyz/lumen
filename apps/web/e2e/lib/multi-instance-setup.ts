import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export interface InstanceConfig {
  name: string;
  port: number;
  type: "workers" | "presence";
}

export interface InstanceProcess {
  config: InstanceConfig;
  process: ChildProcess;
  url: string;
}

function resolvePrimaryPresencePort(): number {
  const fallbackPort = 4010;
  const configuredPresencePort = process.env.E2E_PRESENCE_PORT;
  if (configuredPresencePort) {
    const parsed = Number.parseInt(configuredPresencePort, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const configuredPresenceUrl =
    process.env.E2E_PRESENCE_URL ?? process.env.PRESENCE_URL;

  if (!configuredPresenceUrl) {
    return fallbackPort;
  }

  try {
    const parsedUrl = new URL(configuredPresenceUrl);
    const parsedPort = Number.parseInt(
      parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80"),
      10
    );
    return Number.isFinite(parsedPort) && parsedPort > 0
      ? parsedPort
      : fallbackPort;
  } catch {
    return fallbackPort;
  }
}

const WORKER_PORT_STRIDE = 20;

const parseNonNegativeInteger = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

export function resolvePlaywrightWorkerIndex(
  env: NodeJS.ProcessEnv = process.env
): number {
  const testWorkerIndex = parseNonNegativeInteger(env.TEST_WORKER_INDEX);
  if (testWorkerIndex !== null) {
    return testWorkerIndex;
  }

  const fallbackWorkerIndex = parseNonNegativeInteger(env.PLAYWRIGHT_WORKER);
  return fallbackWorkerIndex ?? 0;
}

export function resolveTopologyPorts(
  workerIndex = resolvePlaywrightWorkerIndex(),
  primaryPresencePort = resolvePrimaryPresencePort()
): {
  workers: { primary: number; secondary: number };
  presence: { primary: number; secondary: number };
} {
  const workerOffset = workerIndex * WORKER_PORT_STRIDE;
  const workersPrimaryPort = (() => {
    const configuredWorkersPort = process.env.E2E_WORKERS_PORT;
    if (configuredWorkersPort) {
      const parsed = Number.parseInt(configuredWorkersPort, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 3002;
  })();

  return {
    workers: {
      primary: workersPrimaryPort,
      secondary: workersPrimaryPort + 1 + workerOffset,
    },
    presence: {
      primary: primaryPresencePort,
      secondary: primaryPresencePort + 2 + workerOffset,
    },
  };
}

const DEFAULT_PORTS = resolveTopologyPorts();

export class MultiInstanceTopology {
  private instances: InstanceProcess[] = [];
  private readonly basePorts;

  constructor(basePorts: typeof DEFAULT_PORTS = DEFAULT_PORTS) {
    this.basePorts = basePorts;
  }

  async startSecondaryWorkers(): Promise<InstanceProcess> {
    const config: InstanceConfig = {
      name: "workers-secondary",
      port: this.basePorts.workers.secondary,
      type: "workers",
    };

    const proc = spawn("bun", ["run", "src/index.ts"], {
      cwd: "apps/workers",
      env: {
        ...process.env,
        PORT: String(config.port),
        NODE_ENV: "test",
        BETTER_AUTH_URL:
          process.env.E2E_WORKERS_URL ?? process.env.BETTER_AUTH_URL,
        BETTER_AUTH_TRUSTED_ORIGINS:
          process.env.E2E_WEB_URL ?? process.env.BETTER_AUTH_TRUSTED_ORIGINS,
        WEB_URL: process.env.E2E_WEB_URL ?? process.env.WEB_URL,
        ALLOWED_ORIGINS: process.env.E2E_WEB_URL ?? process.env.ALLOWED_ORIGINS,
      },
      stdio: "pipe",
    });

    const instance: InstanceProcess = {
      config,
      process: proc,
      url: `http://127.0.0.1:${config.port}`,
    };

    this.instances.push(instance);
    await this.waitForHealth(instance.url);

    return instance;
  }

  async startSecondaryPresence(): Promise<InstanceProcess> {
    const config: InstanceConfig = {
      name: "presence-secondary",
      port: this.basePorts.presence.secondary,
      type: "presence",
    };

    const proc = spawn("mix", ["phx.server"], {
      cwd: "apps/presence",
      env: {
        ...process.env,
        ALLOW_E2E_ANON_SOCKET: process.env.ALLOW_E2E_ANON_SOCKET ?? "true",
        BETTER_AUTH_URL:
          process.env.E2E_WORKERS_URL ??
          process.env.BETTER_AUTH_URL ??
          "http://127.0.0.1:3002",
        WORKERS_API_URL:
          process.env.E2E_WORKERS_URL ??
          process.env.WORKERS_API_URL ??
          "http://127.0.0.1:3002",
        MIX_ENV: process.env.PRESENCE_MIX_ENV ?? "test",
        PHX_SERVER: "true",
        PORT: String(config.port),
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });

    const instance: InstanceProcess = {
      config,
      process: proc,
      url: `http://127.0.0.1:${config.port}`,
    };

    this.instances.push(instance);
    await this.waitForHealth(instance.url);

    return instance;
  }

  private async waitForHealth(url: string, timeout = 30_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(`${url}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          return;
        }
      } catch {
        // continue polling
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Instance at ${url} failed to become healthy`);
  }

  async stopAll(): Promise<void> {
    await Promise.all(
      this.instances.map(
        (instance) =>
          new Promise<void>((resolve) => {
            let exited = false;
            instance.process.once("exit", () => {
              exited = true;
              resolve();
            });
            instance.process.kill("SIGTERM");
            setTimeout(() => {
              if (!exited) {
                instance.process.kill("SIGKILL");
              }
            }, 5000);
          })
      )
    );
    this.instances = [];
  }

  getPrimaryWorkersUrl(): string {
    return `http://127.0.0.1:${this.basePorts.workers.primary}`;
  }

  getPrimaryPresenceUrl(): string {
    return `ws://127.0.0.1:${this.basePorts.presence.primary}`;
  }
}

export interface MultiInstancePageSetup {
  context: BrowserContext;
  instanceType: "workers" | "presence";
  instanceUrl: string;
  page: Page;
}

export async function createPageConnectedToInstance(
  browser: Browser,
  instanceUrl: string,
  instanceType: "workers" | "presence"
): Promise<MultiInstancePageSetup> {
  const context = await browser.newContext();
  const page = await context.newPage();

  if (instanceType === "workers") {
    await page.goto("/");
  }

  return {
    page,
    context,
    instanceUrl,
    instanceType,
  };
}

export function getSecondaryWorkersUrl(): string {
  return `http://127.0.0.1:${getSecondaryWorkersPort()}`;
}

export function getSecondaryPresenceUrl(): string {
  return `ws://127.0.0.1:${getSecondaryPresencePort()}`;
}

export function getSecondaryWorkersPort(): number {
  return DEFAULT_PORTS.workers.secondary;
}

export function getSecondaryPresencePort(): number {
  return DEFAULT_PORTS.presence.secondary;
}

export function getSecondaryWorkersInstanceId(): string {
  return `workers-${getSecondaryWorkersPort()}`;
}

export const SECONDARY_PORTS = {
  workers: getSecondaryWorkersPort(),
  presence: getSecondaryPresencePort(),
};

export interface WorkersRoutingOptions {
  presenceUrl?: string;
  workersUrl: string;
}

function normalizeUrl(url?: string): string | undefined {
  if (url === undefined) {
    return;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export async function createPageConnectedToWorkers(
  page: Page,
  workersUrl: string,
  presenceUrl?: string
): Promise<void> {
  const normalizedWorkersUrl = normalizeUrl(workersUrl);
  const normalizedPresenceUrl = normalizeUrl(presenceUrl);

  await page.addInitScript(
    `(() => {
      window.__TEST_WORKERS_URL__ = ${JSON.stringify(normalizedWorkersUrl)};
      window.__TEST_PRESENCE_URL__ = ${JSON.stringify(normalizedPresenceUrl ?? "")};
    })()`
  );
}

export async function routePageToWorkers(
  page: Page,
  workersUrl: string,
  presenceUrl?: string
): Promise<void> {
  const normalizedWorkersUrl = normalizeUrl(workersUrl);
  const normalizedPresenceUrl = normalizeUrl(presenceUrl);

  await page.addInitScript(
    `(() => {
      window.__TEST_WORKERS_URL__ = ${JSON.stringify(normalizedWorkersUrl)};
      window.__TEST_PRESENCE_URL__ = ${JSON.stringify(normalizedPresenceUrl ?? normalizedWorkersUrl?.replace("http", "ws"))};
    })()`
  );
}

export function getInstanceIdentifier(page: Page): Promise<{
  workersInstance: string | null;
  presenceInstance: string | null;
}> {
  return page.evaluate(() => ({
    workersInstance:
      (window as Window & { __WORKERS_INSTANCE_ID__?: string })
        .__WORKERS_INSTANCE_ID__ ?? null,
    presenceInstance:
      (window as Window & { __PRESENCE_INSTANCE_ID__?: string })
        .__PRESENCE_INSTANCE_ID__ ?? null,
  }));
}

export async function fetchWorkersInstanceId(
  workersUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(`${workersUrl}/instance-id`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.instanceId ?? null;
    }
  } catch {
    // instance may not have /instance-id endpoint yet
  }
  return null;
}

export async function fetchPresenceInstanceId(
  presenceUrl: string
): Promise<string | null> {
  const wsUrl = presenceUrl
    .replace("ws://", "http://")
    .replace("wss://", "https://");
  try {
    const response = await fetch(`${wsUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.instance_id ?? null;
    }
  } catch {
    // instance may not have instance_id in health yet
  }
  return null;
}

export async function getWorkersInstanceIdFromPage(
  page: Page,
  url = process.env.E2E_WORKERS_URL ?? "http://127.0.0.1:3002"
): Promise<string | null> {
  try {
    const response = await page.evaluate(async (instanceUrl) => {
      const res = await fetch(`${instanceUrl}/instance-id`);
      if (res.ok) {
        const data = await res.json();
        return data.instanceId ?? null;
      }
      return null;
    }, url);
    return response;
  } catch {
    return null;
  }
}

export function getPresenceInstanceIdFromSocket(
  page: Page
): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as Window & { __PRESENCE_INSTANCE_ID__?: string })
        .__PRESENCE_INSTANCE_ID__ ?? null
  );
}

export interface StateSnapshot {
  columnCount: number;
  kanbanHtml: string;
  taskCount: number;
}

export async function captureStateSnapshot(page: Page): Promise<StateSnapshot> {
  const columnCount = await page
    .locator('[data-testid="kanban-column"]')
    .count();
  const taskCount = await page.locator('[data-testid="kanban-task"]').count();
  const kanbanHtml = await page
    .locator('[data-testid="kanban-board"]')
    .innerHTML()
    .catch(() => "");

  return {
    columnCount,
    taskCount,
    kanbanHtml,
  };
}

export function assertStateIntegrity(
  before: StateSnapshot,
  after: StateSnapshot,
  context: string
): void {
  expect(
    after.columnCount,
    `${context}: Column count mismatch after reconnect - expected ${before.columnCount}, got ${after.columnCount}`
  ).toBe(before.columnCount);
  expect(
    after.taskCount,
    `${context}: Task count mismatch after reconnect - expected ${before.taskCount}, got ${after.taskCount}`
  ).toBe(before.taskCount);
  expect(
    after.kanbanHtml,
    `${context}: Kanban HTML mismatch after reconnect - states are not identical`
  ).toBe(before.kanbanHtml);
}
