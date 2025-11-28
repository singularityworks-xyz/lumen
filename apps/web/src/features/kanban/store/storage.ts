import { createLogger } from "@lumen/logger";
import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

const logger = createLogger({ name: "[client] storage" });

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "lumen-kanban-store";

type VersionedData<T> = {
  version: number;
  data: T;
  timestamp: number;
};

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

export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // Skip on server-side
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const stored = await get<VersionedData<unknown>>(name);

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
        await set(name, {
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
    // Skip on server-side
    if (typeof window === "undefined") {
      return;
    }

    try {
      const data = JSON.parse(value) as unknown;
      const versionedData: VersionedData<unknown> = {
        version: STORAGE_VERSION,
        data,
        timestamp: Date.now(),
      };
      await set(name, versionedData);
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        "Error writing to IndexedDB"
      );
    }
  },

  removeItem: async (name: string): Promise<void> => {
    // Skip on server-side
    if (typeof window === "undefined") {
      return;
    }

    try {
      await del(name);
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
    await del(STORAGE_KEY);
    logger.info("Cleared all kanban data");
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
