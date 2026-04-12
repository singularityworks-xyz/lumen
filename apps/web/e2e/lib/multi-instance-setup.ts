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

const DEFAULT_PORTS = {
  workers: { primary: 3002, secondary: 3003 },
  presence: { primary: 4001, secondary: 4002 },
} as const;

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
      },
      stdio: "pipe",
    });

    const instance: InstanceProcess = {
      config,
      process: proc,
      url: `http://localhost:${config.port}`,
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
        PORT: String(config.port),
        NODE_ENV: "test",
      },
      stdio: "pipe",
    });

    const instance: InstanceProcess = {
      config,
      process: proc,
      url: `http://localhost:${config.port}`,
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
      this.instances.map((instance) => {
        return new Promise<void>((resolve) => {
          instance.process.once("exit", () => resolve());
          instance.process.kill("SIGTERM");
          setTimeout(() => {
            if (!instance.process.killed) {
              instance.process.kill("SIGKILL");
            }
            resolve();
          }, 5000);
        });
      })
    );
    this.instances = [];
  }

  getPrimaryWorkersUrl(): string {
    return `http://localhost:${this.basePorts.workers.primary}`;
  }

  getPrimaryPresenceUrl(): string {
    return `ws://localhost:${this.basePorts.presence.primary}`;
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
  return `http://localhost:${DEFAULT_PORTS.workers.secondary}`;
}

export function getSecondaryPresenceUrl(): string {
  return `ws://localhost:${DEFAULT_PORTS.presence.secondary}`;
}

export const SECONDARY_PORTS = {
  workers: DEFAULT_PORTS.workers.secondary,
  presence: DEFAULT_PORTS.presence.secondary,
} as const;

export interface WorkersRoutingOptions {
  presenceUrl?: string;
  workersUrl: string;
}

export async function createPageConnectedToWorkers(
  page: Page,
  workersUrl: string,
  presenceUrl?: string
): Promise<void> {
  const normalizedWorkersUrl = workersUrl.endsWith("/")
    ? workersUrl.slice(0, -1)
    : workersUrl;
  const normalizedPresenceUrl = presenceUrl?.endsWith("/")
    ? presenceUrl.slice(0, -1)
    : presenceUrl;

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
  const normalizedWorkersUrl = workersUrl.endsWith("/")
    ? workersUrl.slice(0, -1)
    : workersUrl;
  const normalizedPresenceUrl = presenceUrl?.endsWith("/")
    ? presenceUrl.slice(0, -1)
    : presenceUrl;

  await page.addInitScript(
    `(() => {
      Object.defineProperty(process.env, 'NEXT_PUBLIC_API_URL', {
        get: () => ${JSON.stringify(normalizedWorkersUrl)},
        configurable: true
      });
      Object.defineProperty(process.env, 'NEXT_PUBLIC_PRESENCE_WS_URL', {
        get: () => ${JSON.stringify(normalizedPresenceUrl ?? normalizedWorkersUrl.replace("http", "ws"))},
        configurable: true
      });
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
  page: Page
): Promise<string | null> {
  try {
    const response = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/instance-id`);
      if (res.ok) {
        const data = await res.json();
        return data.instanceId ?? null;
      }
      return null;
    }, "http://localhost:3002");
    return response;
  } catch {
    return null;
  }
}

export function getPresenceInstanceIdFromSocket(
  page: Page
): Promise<string | null> {
  return page.evaluate(() => {
    return (
      (window as Window & { __PRESENCE_INSTANCE_ID__?: string })
        .__PRESENCE_INSTANCE_ID__ ?? null
    );
  });
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
