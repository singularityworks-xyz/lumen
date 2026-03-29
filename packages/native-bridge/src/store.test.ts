import { afterEach, describe, expect, it, mock } from "bun:test";

// Mock logger to avoid OpenTelemetry dependency issues
mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    warn: () => undefined,
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  }),
}));

const originalWindow = globalThis.window;

function setMockWindow(win: object | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("store", () => {
  describe("getStore - no-op path", () => {
    it("returns no-op store in browser mode (no Tauri)", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();
      const store = await getStore("test-browser");
      expect(await store.get("key")).toBeNull();
      expect(await store.has("key")).toBe(false);
      expect(await store.keys()).toEqual([]);
      expect(await store.delete("key")).toBe(false);
      await expect(store.set("key", "val")).resolves.toBeUndefined();
      await expect(store.clear()).resolves.toBeUndefined();
      await expect(store.save()).resolves.toBeUndefined();
    });

    it("returns no-op store in SSR context (no window)", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow(undefined);
      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();
      const store = await getStore("test-ssr");
      expect(await store.get("key")).toBeNull();
      expect(await store.has("key")).toBe(false);
    });

    it("falls back to no-op store when Tauri store import fails", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();
      const store = await getStore("test-fallback");
      await expect(store.get("key")).resolves.toBeNull();
      await expect(store.has("key")).resolves.toBe(false);
      await expect(store.keys()).resolves.toEqual([]);
    });

    it("returns the same instance on subsequent calls (singleton)", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();
      const a = await getStore("test-singleton");
      const b = await getStore("test-singleton");
      expect(a).toBe(b);
    });

    it("accepts a custom store name parameter", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();
      const store = await getStore("custom-store.json");
      expect(store).toBeDefined();
      expect(typeof store.get).toBe("function");
    });
  });

  describe("NativeStore - browser mode", () => {
    it("get returns null in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      expect(await NativeStore.get("missing")).toBeNull();
    });

    it("set resolves without error in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      await expect(NativeStore.set("key", "value")).resolves.toBeUndefined();
    });

    it("delete returns false in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      expect(await NativeStore.delete("key")).toBe(false);
    });

    it("has returns false in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      expect(await NativeStore.has("key")).toBe(false);
    });

    it("keys returns empty array in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      expect(await NativeStore.keys()).toEqual([]);
    });

    it("clear resolves without error in browser mode", async () => {
      mock.module("@tauri-apps/plugin-store", () => {
        throw new Error("plugin-store not available");
      });
      setMockWindow({});
      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();
      await expect(NativeStore.clear()).resolves.toBeUndefined();
    });
  });

  describe("Tauri store success path", () => {
    const mockStoreData = new Map<string, unknown>();

    class MockLazyStore {
      path: string;

      constructor(path: string) {
        this.path = path;
      }

      async get<T>(key: string): Promise<T | undefined> {
        return await Promise.resolve(mockStoreData.get(key) as T | undefined);
      }

      async set(key: string, value: unknown): Promise<void> {
        await Promise.resolve(mockStoreData.set(key, value));
      }

      async delete(key: string): Promise<boolean> {
        return await Promise.resolve(mockStoreData.delete(key));
      }

      async has(key: string): Promise<boolean> {
        return await Promise.resolve(mockStoreData.has(key));
      }

      async keys(): Promise<string[]> {
        return await Promise.resolve(Array.from(mockStoreData.keys()));
      }

      async clear(): Promise<void> {
        await Promise.resolve(mockStoreData.clear());
      }

      async save(): Promise<void> {
        await Promise.resolve();
      }
    }

    it("uses Tauri store when plugin is available", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, getStore } = await import("./store");
      __resetStoreForTesting();

      const store = await getStore("tauri-success.json");

      await store.set("key1", "value1");
      const val = await store.get<string>("key1");
      expect(val).toBe("value1");

      const missing = await store.get<string>("nonexistent");
      expect(missing).toBeNull();

      expect(await store.has("key1")).toBe(true);
      expect(await store.has("nonexistent")).toBe(false);

      await store.set("key2", 42);
      const keys = await store.keys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");

      expect(await store.delete("key1")).toBe(true);
      expect(await store.has("key1")).toBe(false);

      await store.clear();
      expect(mockStoreData.size).toBe(0);

      await store.save();
    });

    it("NativeStore set delegates and saves with Tauri store", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();

      await NativeStore.set("ns-key", { nested: true });
      expect(mockStoreData.get("ns-key")).toEqual({ nested: true });

      const result = await NativeStore.get("ns-key");
      expect(result).toEqual({ nested: true });
    });

    it("NativeStore delete delegates and saves with Tauri store", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();

      await NativeStore.set("del-key", "val");
      const result = await NativeStore.delete("del-key");
      expect(result).toBe(true);
    });

    it("NativeStore has delegates with Tauri store", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();

      await NativeStore.set("exists-key", 1);
      expect(await NativeStore.has("exists-key")).toBe(true);
      expect(await NativeStore.has("missing-key")).toBe(false);
    });

    it("NativeStore keys delegates with Tauri store", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();

      await NativeStore.set("a", 1);
      await NativeStore.set("b", 2);
      const keys = await NativeStore.keys();
      expect(keys).toContain("a");
      expect(keys).toContain("b");
    });

    it("NativeStore clear delegates with Tauri store", async () => {
      mock.module("@tauri-apps/plugin-store", () => ({
        LazyStore: MockLazyStore,
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      mockStoreData.clear();

      const { __resetStoreForTesting, NativeStore } = await import("./store");
      __resetStoreForTesting();

      await NativeStore.set("x", 1);
      await NativeStore.clear();
      expect(mockStoreData.size).toBe(0);
    });
  });
});
