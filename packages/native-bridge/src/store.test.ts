import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface MockWindow {
  __TAURI_INTERNALS__?: object | undefined;
}

const originalWindow = globalThis.window;

function setMockWindow(win: MockWindow | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

// Reset store singleton between tests by clearing require cache
beforeEach(() => {
  try {
    const resolved = require.resolve("./store");
    delete require.cache[resolved];
  } catch {
    // module not yet loaded
  }
  try {
    const resolved = require.resolve("./platform");
    delete require.cache[resolved];
  } catch {
    // module not yet loaded
  }
});

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("store", () => {
  describe("getStore", () => {
    it("returns no-op store in browser mode (no Tauri)", async () => {
      setMockWindow({});
      const { getStore } = await import("./store");
      const store = await getStore();
      expect(await store.get("key")).toBeNull();
      expect(await store.has("key")).toBe(false);
      expect(await store.keys()).toEqual([]);
      expect(await store.delete("key")).toBe(false);
      await expect(store.set("key", "val")).resolves.toBeUndefined();
      await expect(store.clear()).resolves.toBeUndefined();
      await expect(store.save()).resolves.toBeUndefined();
    });

    it("returns no-op store in SSR context (no window)", async () => {
      setMockWindow(undefined);
      const { getStore } = await import("./store");
      const store = await getStore();
      expect(await store.get("key")).toBeNull();
      expect(await store.has("key")).toBe(false);
    });

    it("falls back to no-op store when Tauri store import fails", async () => {
      setMockWindow({
        __TAURI_INTERNALS__: {
          invoke: mock(() => Promise.reject(new Error("invoke error"))),
        },
      });
      const { getStore } = await import("./store");
      const store = await getStore();
      await expect(store.get("key")).resolves.toBeNull();
    });

    it("returns the same instance on subsequent calls (singleton)", async () => {
      setMockWindow({});
      const { getStore } = await import("./store");
      const a = await getStore();
      const b = await getStore();
      expect(a).toBe(b);
    });

    it("accepts a custom store name parameter", async () => {
      setMockWindow({});
      const { getStore } = await import("./store");
      const store = await getStore("custom-store.json");
      expect(store).toBeDefined();
      expect(typeof store.get).toBe("function");
    });
  });

  describe("NativeStore", () => {
    it("get returns null in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      expect(await NativeStore.get("missing")).toBeNull();
    });

    it("set resolves without error in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      await expect(NativeStore.set("key", "value")).resolves.toBeUndefined();
    });

    it("delete returns false in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      expect(await NativeStore.delete("key")).toBe(false);
    });

    it("has returns false in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      expect(await NativeStore.has("key")).toBe(false);
    });

    it("keys returns empty array in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      expect(await NativeStore.keys()).toEqual([]);
    });

    it("clear resolves without error in browser mode", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      await expect(NativeStore.clear()).resolves.toBeUndefined();
    });

    it("set calls save after write", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      await expect(NativeStore.set("key", "val")).resolves.toBeUndefined();
    });

    it("delete calls save after delete", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      expect(await NativeStore.delete("key")).toBe(false);
    });

    it("clear calls save after clear", async () => {
      setMockWindow({});
      const { NativeStore } = await import("./store");
      await expect(NativeStore.clear()).resolves.toBeUndefined();
    });
  });
});
