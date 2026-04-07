"use client";

import { createLogger } from "@lumen/logger";
import { del, get, keys, set } from "idb-keyval";

const logger = createLogger({ name: "[client] storage-manager" });

// Storage Manager
// Provides environment-isolated storage keys to prevent data conflicts
// between different environments (localhost, production, previews).
// Cached namespace to avoid repeated calculations
let cachedNamespace: string | null = null;

/** @testonly Reset cached namespace for test isolation */
export function _resetCachedNamespace(): void {
  cachedNamespace = null;
}

// Get the storage namespace based on the current environment.
// Automatically detects hostname and port without environment variables.
export function getStorageNamespace(): string {
  if (cachedNamespace) {
    return cachedNamespace;
  }

  if (typeof window === "undefined") {
    return "lumen-ssr";
  }

  const { hostname, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    cachedNamespace = `lumen-dev-${port || "80"}`;
    logger.debug({ namespace: cachedNamespace }, "Using development namespace");
    return cachedNamespace;
  }

  cachedNamespace = `lumen-${hostname}`;
  logger.debug({ namespace: cachedNamespace }, "Using production namespace");
  return cachedNamespace;
}

export function getEnvironmentType(): "development" | "production" | "preview" {
  if (typeof window === "undefined") {
    return "production";
  }

  const { hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "development";
  }

  if (
    hostname.includes("preview") ||
    hostname.includes("staging") ||
    hostname.includes("vercel.app")
  ) {
    return "preview";
  }

  return "production";
}

export const StorageKeys = {
  // Get the key for the main Kanban store
  kanbanStore(): string {
    return `${getStorageNamespace()}-kanban-store`;
  },

  // Get the key for Yjs collab persistence
  collabPersistence(workspaceId: string): string {
    return `${getStorageNamespace()}-collab-${workspaceId}`;
  },

  // Get the legacy key (for migration)
  legacyKanbanStore(): string {
    return "lumen-kanban-store";
  },
};

// Utility functions for storage management
// Clear all data for the current environment
export async function clearCurrentEnvironment(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const namespace = getStorageNamespace();
    const allKeys = await keys();
    const keysToDelete = allKeys.filter(
      (key) => typeof key === "string" && key.startsWith(namespace)
    );

    for (const key of keysToDelete) {
      await del(key);
    }

    logger.info(
      { namespace, deletedCount: keysToDelete.length },
      "Cleared environment storage"
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to clear environment storage"
    );
    throw error;
  }
}

// Export data for the current environment
export async function exportEnvironmentData(): Promise<
  Record<string, unknown>
> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const namespace = getStorageNamespace();
    const allKeys = await keys();
    const environmentKeys = allKeys.filter(
      (key) => typeof key === "string" && key.startsWith(namespace)
    );

    const data: Record<string, unknown> = {};
    for (const key of environmentKeys) {
      const value = await get(key);
      if (typeof key === "string") {
        data[key] = value;
      }
    }

    logger.info(
      { namespace, keyCount: environmentKeys.length },
      "Exported environment data"
    );

    return data;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to export environment data"
    );
    throw error;
  }
}

// Import data into the current environment
export async function importEnvironmentData(
  data: Record<string, unknown>
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const namespace = getStorageNamespace();
    let importedCount = 0;

    for (const [key, value] of Object.entries(data)) {
      // Only import keys that match the current namespace
      // OR transform keys to match current namespace
      if (key.startsWith(namespace)) {
        await set(key, value);
        importedCount += 1;
      }
    }

    logger.info({ namespace, importedCount }, "Imported environment data");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to import environment data"
    );
    throw error;
  }
}

// Migrate data from legacy storage to environment-scoped storage
export async function migrateFromLegacyStorage(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const legacyKey = StorageKeys.legacyKanbanStore();
    const newKey = StorageKeys.kanbanStore();

    // Check if we already have data in the new location
    const existingData = await get(newKey);
    if (existingData) {
      logger.debug("New storage already has data, skipping migration");
      return false;
    }

    // Check for legacy data
    const legacyData = await get(legacyKey);
    if (!legacyData) {
      logger.debug("No legacy data to migrate");
      return false;
    }

    // Migrate the data
    await set(newKey, legacyData);
    logger.info(
      { from: legacyKey, to: newKey },
      "Migrated data from legacy storage"
    );

    return true;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to migrate from legacy storage"
    );
    return false;
  }
}

// Get storage statistics for the current environment
export async function getStorageStats(): Promise<{
  namespace: string;
  environment: string;
  keyCount: number;
  keys: string[];
}> {
  if (typeof window === "undefined") {
    return {
      namespace: "lumen-ssr",
      environment: "ssr",
      keyCount: 0,
      keys: [],
    };
  }

  const namespace = getStorageNamespace();
  const allKeys = await keys();
  const environmentKeys = allKeys.filter(
    (key) => typeof key === "string" && key.startsWith(namespace)
  ) as string[];

  return {
    namespace,
    environment: getEnvironmentType(),
    keyCount: environmentKeys.length,
    keys: environmentKeys,
  };
}

// Clear legacy storage (after confirming migration)
export async function clearLegacyStorage(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const legacyKey = StorageKeys.legacyKanbanStore();
    await del(legacyKey);
    logger.info({ key: legacyKey }, "Cleared legacy storage");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to clear legacy storage"
    );
  }
}
