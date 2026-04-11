import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import type { Browser, BrowserContext, Page } from "@playwright/test";

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
    return `ws://localhost:${this.basePorts.presence.primary - 1}`;
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
