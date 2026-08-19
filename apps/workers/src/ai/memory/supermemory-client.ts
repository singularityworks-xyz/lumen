import { createLogger } from "@lumen/logger";
import Supermemory from "supermemory";

const logger = createLogger({ name: "ai:supermemory" });

// The self-hosted Supermemory server listens on 6767 by default.
// See https://supermemory.ai/docs/self-hosting/overview
const DEFAULT_SUPERMEMORY_URL = "http://localhost:6767";

let client: Supermemory | null = null;

export function isMemoryEnabled(): boolean {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  return typeof apiKey === "string" && apiKey.length > 0;
}

export function getSupermemoryBaseUrl(): string {
  return process.env.SUPERMEMORY_API_URL ?? DEFAULT_SUPERMEMORY_URL;
}

export function getSupermemoryClient(): Supermemory | null {
  if (client) {
    return client;
  }

  if (!isMemoryEnabled()) {
    return null;
  }

  try {
    client = new Supermemory({
      apiKey: process.env.SUPERMEMORY_API_KEY as string,
      baseURL: getSupermemoryBaseUrl(),
    });
  } catch (error) {
    client = null;
    logger.error("Failed to initialize Supermemory client", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }

  return client;
}

// Test hook: reset the cached client (used by unit tests)
export function __resetSupermemoryClient(): void {
  client = null;
}
