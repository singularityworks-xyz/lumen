import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "lumen-kanban-store";

type VersionedData<T> = {
  version: number;
  data: T;
  timestamp: number;
};

function migrate<T>(oldVersion: number, data: T): T {
  if (oldVersion < STORAGE_VERSION) {
    console.info(
      `[Storage] Migrated data from v${oldVersion} to v${STORAGE_VERSION}`
    );
  }

  return data;
}

export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const stored = await get<VersionedData<unknown>>(name);

      if (!stored) {
        return null;
      }

      if (!("version" in stored)) {
        console.info("[Storage] Found legacy data, wrapping with version");
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

export async function clearStorage(): Promise<void> {
  try {
    await del(STORAGE_KEY);
    console.info("[Storage] Cleared all kanban data");
  } catch (error) {
    console.error("[Storage] Error clearing storage:", error);
  }
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
