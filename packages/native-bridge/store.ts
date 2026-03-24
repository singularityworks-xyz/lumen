import { createLogger } from "@lumen/logger";
import { isTauri } from "./platform";

const logger = createLogger({ name: "native-bridge:store" });

interface StoreInstance {
  clear: () => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  get: <T>(key: string) => Promise<T | null>;
  has: (key: string) => Promise<boolean>;
  keys: () => Promise<string[]>;
  save: () => Promise<void>;
  set: (key: string, value: unknown) => Promise<void>;
}

let storeInstance: StoreInstance | null = null;

// Get or create a Tauri store instance.
// Uses lazy loading to avoid importing Tauri modules in browser context.
export async function getStore(
  storeName = "lumen-store.json"
): Promise<StoreInstance> {
  if (storeInstance) {
    return storeInstance;
  }

  if (!isTauri()) {
    storeInstance = createNoOpStore();
    return storeInstance;
  }

  try {
    const { LazyStore } = await import("@tauri-apps/plugin-store");
    const store = new LazyStore(storeName);

    storeInstance = {
      get: async <T>(key: string): Promise<T | null> =>
        (await store.get<T>(key)) ?? null,
      set: async (key: string, value: unknown): Promise<void> => {
        await store.set(key, value);
      },
      delete: async (key: string): Promise<boolean> => store.delete(key),
      has: async (key: string): Promise<boolean> => store.has(key),
      keys: async (): Promise<string[]> => store.keys(),
      clear: async (): Promise<void> => {
        await store.clear();
      },
      save: async (): Promise<void> => {
        await store.save();
      },
    };

    return storeInstance;
  } catch (error) {
    logger.warn("Failed to initialize Tauri store, using no-op store", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    storeInstance = createNoOpStore();
    return storeInstance;
  }
}

function createNoOpStore(): StoreInstance {
  return {
    get: async <T>(): Promise<T | null> => null,
    set: async (): Promise<void> => undefined,
    delete: async (): Promise<boolean> => false,
    has: async (): Promise<boolean> => false,
    keys: async (): Promise<string[]> => [],
    clear: async (): Promise<void> => undefined,
    save: async (): Promise<void> => undefined,
  };
}

export const NativeStore = {
  async get<T>(key: string): Promise<T | null> {
    const store = await getStore();
    return store.get<T>(key);
  },

  async set(key: string, value: unknown): Promise<void> {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  },

  async delete(key: string): Promise<boolean> {
    const store = await getStore();
    const result = await store.delete(key);
    await store.save();
    return result;
  },

  async has(key: string): Promise<boolean> {
    const store = await getStore();
    return store.has(key);
  },

  async keys(): Promise<string[]> {
    const store = await getStore();
    return store.keys();
  },

  async clear(): Promise<void> {
    const store = await getStore();
    await store.clear();
    await store.save();
  },
};
