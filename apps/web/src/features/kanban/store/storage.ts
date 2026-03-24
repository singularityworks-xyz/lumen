import { createLogger } from "@lumen/logger";
import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";
import {
  migrateFromLegacyStorage,
  StorageKeys,
} from "@/src/lib/storage-manager";

const logger = createLogger({ name: "[client] storage" });

export const STORAGE_VERSION = 1;
export const getStorageKey = (): string => StorageKeys.kanbanStore();
export const STORAGE_KEY = "lumen-kanban-store";

interface VersionedData<T> {
  data: T;
  timestamp: number;
  version: number;
}

// Migration lock to prevent concurrent migration attempts
let migrationInProgress: Promise<void> | null = null;
let migrationCompleted = false;

function serializeError(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  return { message: String(error) };
}

function migrate<T>(oldVersion: number, data: T): T {
  if (oldVersion < STORAGE_VERSION) {
    logger.info(
      { from: oldVersion, to: STORAGE_VERSION },
      "Migrated storage data"
    );
  }

  return data;
}

// Transform the static storage name to an environment-scoped key
// This allows us to use a static name in Zustand config while getting automatic environment isolation at runtime
function transformStorageKey(name: string): string {
  if (name === STORAGE_KEY) {
    return getStorageKey();
  }
  return name;
}

async function performLegacyMigration(
  key: string,
  name: string
): Promise<VersionedData<unknown> | null> {
  if (migrationCompleted) {
    return null;
  }

  if (migrationInProgress) {
    await migrationInProgress;
    return (await get<VersionedData<unknown>>(key)) ?? null;
  }

  migrationInProgress = (async () => {
    try {
      if (name !== STORAGE_KEY || key === STORAGE_KEY) {
        return;
      }

      const legacyData =
        (await get<VersionedData<unknown>>(STORAGE_KEY)) ?? null;
      if (legacyData) {
        logger.info(
          "Found legacy data, migrating to environment-scoped storage"
        );
        await set(key, legacyData);
      }
      migrationCompleted = true;
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        "Error during legacy migration"
      );
    } finally {
      migrationInProgress = null;
    }
  })();

  await migrationInProgress;
  return (await get<VersionedData<unknown>>(key)) ?? null;
}

export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }

    const key = transformStorageKey(name);

    try {
      let stored = (await get<VersionedData<unknown>>(key)) ?? null;
      if (!stored && name === STORAGE_KEY && key !== STORAGE_KEY) {
        stored = await performLegacyMigration(key, name);
      }

      if (!stored) {
        return null;
      }

      if (!("version" in stored)) {
        logger.info("Found legacy data, wrapping with version");
        return JSON.stringify(stored);
      }

      const { version, data } = stored;
      if (version < STORAGE_VERSION) {
        const migrated = migrate(version, data);
        await set(key, {
          version: STORAGE_VERSION,
          data: migrated,
          timestamp: Date.now(),
        } satisfies VersionedData<unknown>);
        return JSON.stringify(migrated);
      }

      return JSON.stringify(data);
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        "Error reading from IndexedDB"
      );
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    const key = transformStorageKey(name);

    try {
      const data = JSON.parse(value) as unknown;
      const versionedData: VersionedData<unknown> = {
        version: STORAGE_VERSION,
        data,
        timestamp: Date.now(),
      };
      await set(key, versionedData);
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        "Error writing to IndexedDB"
      );
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    const key = transformStorageKey(name);

    try {
      await del(key);
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        "Error removing from IndexedDB"
      );
    }
  },
};

export async function clearStorage(): Promise<void> {
  try {
    const key = getStorageKey();
    await del(key);
    logger.info({ key }, "Cleared kanban data");
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Error clearing storage");
  }
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

// Run migration from legacy storage to environment-scoped storage
// Should be called once on app startup
export async function runStorageMigration(): Promise<void> {
  try {
    // Mark migration as completed to prevent inline migration attempts
    migrationCompleted = true;

    const migrated = await migrateFromLegacyStorage();
    if (migrated) {
      logger.info("Successfully migrated from legacy storage");
    }
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Storage migration failed");
    // Reset flag on failure to allow retry
    migrationCompleted = false;
  }
}
