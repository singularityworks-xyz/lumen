import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * Current storage schema version.
 * Increment this when making breaking changes to the persisted state shape.
 */
export const STORAGE_VERSION = 1;

/**
 * Key used for storing kanban data in IndexedDB
 */
export const STORAGE_KEY = "lumen-kanban-store";

/**
 * Wrapper type for persisted data that includes version metadata
 */
type VersionedData<T> = {
  version: number;
  data: T;
  timestamp: number;
};

/**
 * Migrate data from an older version to the current version.
 * Add migration logic here when STORAGE_VERSION is incremented.
 *
 * @param oldVersion - The version of the stored data
 * @param data - The stored data to migrate
 * @returns The migrated data compatible with current version
 */
function migrate<T>(oldVersion: number, data: T): T {
  // Example migration pattern for future use:
  // let migrated = data;
  // if (oldVersion < 2) {
  //   migrated = migrateV1ToV2(migrated);
  // }
  // if (oldVersion < 3) {
  //   migrated = migrateV2ToV3(migrated);
  // }
  // return migrated;

  // Currently at version 1, no migrations needed yet
  if (oldVersion < STORAGE_VERSION) {
    console.info(
      `[Storage] Migrated data from v${oldVersion} to v${STORAGE_VERSION}`
    );
  }

  return data;
}

/**
 * IndexedDB storage adapter for Zustand persist middleware.
 * Uses idb-keyval for a simple key-value interface to IndexedDB.
 *
 * Features:
 * - Versioned schema with automatic migrations
 * - Error recovery with console warnings
 * - Async operations for better performance
 */
export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const stored = await get<VersionedData<unknown>>(name);

      if (!stored) {
        return null;
      }

      // Handle legacy data without version wrapper
      if (!("version" in stored)) {
        console.info("[Storage] Found legacy data, wrapping with version");
        return JSON.stringify(stored);
      }

      // Migrate if needed
      const { version, data } = stored;
      if (version < STORAGE_VERSION) {
        const migrated = migrate(version, data);
        // Save migrated data back to storage
        await set(name, {
          version: STORAGE_VERSION,
          data: migrated,
          timestamp: Date.now(),
        } satisfies VersionedData<unknown>);
        return JSON.stringify(migrated);
      }

      return JSON.stringify(data);
    } catch (error) {
      console.error("[Storage] Error reading from IndexedDB:", error);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const data = JSON.parse(value) as unknown;
      const versionedData: VersionedData<unknown> = {
        version: STORAGE_VERSION,
        data,
        timestamp: Date.now(),
      };
      await set(name, versionedData);
    } catch (error) {
      console.error("[Storage] Error writing to IndexedDB:", error);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch (error) {
      console.error("[Storage] Error removing from IndexedDB:", error);
    }
  },
};

/**
 * Clear all kanban data from IndexedDB.
 * Useful for debugging or resetting the application.
 */
export async function clearStorage(): Promise<void> {
  try {
    await del(STORAGE_KEY);
    console.info("[Storage] Cleared all kanban data");
  } catch (error) {
    console.error("[Storage] Error clearing storage:", error);
  }
}

/**
 * Check if IndexedDB is available in the current environment.
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
