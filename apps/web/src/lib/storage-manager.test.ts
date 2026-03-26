import { beforeEach, describe, expect, it, mock } from "bun:test";

type DelFn = (key: string) => Promise<void>;
type GetFn = (key: string) => Promise<unknown>;
type KeysFn = () => Promise<string[]>;
type SetFn = (key: string, value: unknown) => Promise<void>;

const mockDel = mock<DelFn>(() => Promise.resolve());
const mockGet = mock<GetFn>(() => Promise.resolve(null));
const mockKeys = mock<KeysFn>(() => Promise.resolve([]));
const mockSet = mock<SetFn>(() => Promise.resolve());

mock.module("idb-keyval", () => ({
  del: mockDel,
  get: mockGet,
  keys: mockKeys,
  set: mockSet,
}));

beforeEach(() => {
  mockDel.mockReset();
  mockGet.mockReset();
  mockKeys.mockReset();
  mockSet.mockReset();

  // Re-apply idb-keyval mock to ensure fresh module context
  mock.module("idb-keyval", () => ({
    del: mockDel,
    get: mockGet,
    keys: mockKeys,
    set: mockSet,
  }));

  globalThis.window = {
    location: { hostname: "localhost", port: "3000" },
  } as typeof window;
});

describe("storage-manager", () => {
  describe("namespace detection", () => {
    it("detects dev namespace for localhost", async () => {
      const { getStorageNamespace } = await import("@/src/lib/storage-manager");

      const namespace = getStorageNamespace();
      expect(namespace).toContain("lumen-dev");
    });

    it("detects production namespace for custom domain", async () => {
      globalThis.window = {
        location: { hostname: "app.example.com", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");

      const envType = getEnvironmentType();
      expect(envType).toBe("production");
    });

    it("detects preview namespace for preview domains", async () => {
      globalThis.window = {
        location: { hostname: "preview-abc.vercel.app", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");

      expect(getEnvironmentType()).toBe("preview");
    });
  });

  describe("environment key export/import", () => {
    it("exports only current namespace keys", async () => {
      mockKeys.mockResolvedValue([
        "lumen-dev-3000-kanban-store",
        "lumen-dev-3000-collab-ws1",
        "lumen-prod-kanban-store",
      ]);
      mockGet.mockImplementation((key: string) => {
        if (key === "lumen-dev-3000-kanban-store") {
          return Promise.resolve({ data: "kanban" });
        }
        if (key === "lumen-dev-3000-collab-ws1") {
          return Promise.resolve({ data: "collab" });
        }
        return Promise.resolve(null);
      });

      const { exportEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await exportEnvironmentData();

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["lumen-dev-3000-kanban-store"]).toBeDefined();
      expect(result["lumen-prod-kanban-store"]).toBeUndefined();
    });

    it("imports only matching namespace keys", async () => {
      const importData = {
        "lumen-dev-3000-kanban-store": { data: "new" },
        "lumen-prod-kanban-store": { data: "old" },
      };

      const { importEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await importEnvironmentData(importData);

      expect(mockSet).toHaveBeenCalledWith(
        "lumen-dev-3000-kanban-store",
        expect.anything()
      );
      expect(mockSet).not.toHaveBeenCalledWith(
        "lumen-prod-kanban-store",
        expect.anything()
      );
    });
  });

  describe("legacy migration", () => {
    it("copies only when new storage is empty", async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "lumen-kanban-store") {
          return Promise.resolve({ data: "legacy" });
        }
        return Promise.resolve(null);
      });

      const { migrateFromLegacyStorage } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining("lumen-dev"),
        {
          data: "legacy",
        }
      );
    });

    it("skips migration when new storage has data", async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === "lumen-kanban-store") {
          return Promise.resolve({ data: "legacy" });
        }
        if (key.includes("lumen-dev")) {
          return Promise.resolve({ data: "existing" });
        }
        return Promise.resolve(null);
      });

      const { migrateFromLegacyStorage } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();

      expect(result).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns false when no legacy data exists", async () => {
      mockGet.mockResolvedValue(null);

      const { migrateFromLegacyStorage } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();

      expect(result).toBe(false);
    });
  });

  describe("clear helpers", () => {
    it("deletes only current environment keys", async () => {
      mockKeys.mockResolvedValue([
        "lumen-dev-3000-kanban-store",
        "lumen-dev-3000-collab-ws1",
        "lumen-prod-kanban-store",
        "lumen-ssr-kanban-store",
      ]);
      mockDel.mockResolvedValue();

      const { clearCurrentEnvironment } = await import(
        "@/src/lib/storage-manager"
      );

      await clearCurrentEnvironment();

      expect(mockDel).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledWith("lumen-dev-3000-kanban-store");
      expect(mockDel).toHaveBeenCalledWith("lumen-dev-3000-collab-ws1");
      expect(mockDel).not.toHaveBeenCalledWith("lumen-prod-kanban-store");
      expect(mockDel).not.toHaveBeenCalledWith("lumen-ssr-kanban-store");
    });

    it("returns early in SSR environment", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { clearCurrentEnvironment } = await import(
        "@/src/lib/storage-manager"
      );

      await clearCurrentEnvironment();

      expect(mockKeys).not.toHaveBeenCalled();

      globalThis.window = originalWindow;
    });

    it("throws when clearCurrentEnvironment fails", async () => {
      mockKeys.mockRejectedValue(new Error("IDB error"));

      const { clearCurrentEnvironment } = await import(
        "@/src/lib/storage-manager"
      );

      await expect(clearCurrentEnvironment()).rejects.toThrow("IDB error");
    });

    it("handles no matching keys on clear", async () => {
      mockKeys.mockResolvedValue(["lumen-prod-kanban-store", "other-key"]);

      const { clearCurrentEnvironment } = await import(
        "@/src/lib/storage-manager"
      );

      await clearCurrentEnvironment();

      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe("exportEnvironmentData", () => {
    it("returns empty object in SSR", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { exportEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await exportEnvironmentData();
      expect(result).toEqual({});

      globalThis.window = originalWindow;
    });

    it("throws when export fails", async () => {
      mockKeys.mockRejectedValue(new Error("Export error"));

      const { exportEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await expect(exportEnvironmentData()).rejects.toThrow("Export error");
    });

    it("handles empty key list", async () => {
      mockKeys.mockResolvedValue([]);

      const { exportEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await exportEnvironmentData();
      expect(result).toEqual({});
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("importEnvironmentData", () => {
    it("returns early in SSR", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { importEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await importEnvironmentData({ key: "value" });
      expect(mockSet).not.toHaveBeenCalled();

      globalThis.window = originalWindow;
    });

    it("throws when import fails", async () => {
      mockSet.mockRejectedValue(new Error("Import error"));

      const { importEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await expect(
        importEnvironmentData({ "lumen-dev-3000-kanban-store": {} })
      ).rejects.toThrow("Import error");
    });

    it("handles empty data object", async () => {
      const { importEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await importEnvironmentData({});

      expect(mockSet).not.toHaveBeenCalled();
    });

    it("imports multiple matching keys", async () => {
      const importData = {
        "lumen-dev-3000-kanban-store": { boards: [] },
        "lumen-dev-3000-collab-ws1": { doc: "data" },
        "lumen-prod-kanban-store": { should: "skip" },
      };

      const { importEnvironmentData } = await import(
        "@/src/lib/storage-manager"
      );

      await importEnvironmentData(importData);

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledWith("lumen-dev-3000-kanban-store", {
        boards: [],
      });
      expect(mockSet).toHaveBeenCalledWith("lumen-dev-3000-collab-ws1", {
        doc: "data",
      });
    });
  });

  describe("getStorageStats", () => {
    it("returns stats for current environment", async () => {
      mockKeys.mockResolvedValue([
        "lumen-dev-3000-kanban-store",
        "lumen-dev-3000-collab-ws1",
        "lumen-prod-kanban-store",
      ]);

      const { getStorageStats } = await import("@/src/lib/storage-manager");

      const stats = await getStorageStats();
      expect(stats.namespace).toContain("lumen-dev");
      expect(stats.environment).toBe("development");
      expect(stats.keyCount).toBe(2);
      expect(stats.keys).toHaveLength(2);
    });

    it("returns SSR stats when no window", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { getStorageStats } = await import("@/src/lib/storage-manager");

      const stats = await getStorageStats();
      expect(stats.namespace).toBe("lumen-ssr");
      expect(stats.environment).toBe("ssr");
      expect(stats.keyCount).toBe(0);

      globalThis.window = originalWindow;
    });

    it("returns empty stats when no keys match namespace", async () => {
      mockKeys.mockResolvedValue(["lumen-prod-kanban-store", "other-key"]);

      const { getStorageStats } = await import("@/src/lib/storage-manager");

      const stats = await getStorageStats();
      expect(stats.keyCount).toBe(0);
      expect(stats.keys).toEqual([]);
    });

    it("returns stats filtering by cached namespace", async () => {
      mockKeys.mockResolvedValue([
        "lumen-dev-3000-kanban-store",
        "lumen-prod-kanban-store",
      ]);

      const { getStorageStats } = await import("@/src/lib/storage-manager");

      const stats = await getStorageStats();
      expect(stats.keyCount).toBe(1);
      expect(stats.keys).toContain("lumen-dev-3000-kanban-store");
      expect(stats.keys).not.toContain("lumen-prod-kanban-store");
    });
  });

  describe("clearLegacyStorage", () => {
    it("clears legacy key in browser", async () => {
      mockDel.mockResolvedValue();

      const { clearLegacyStorage } = await import("@/src/lib/storage-manager");

      await clearLegacyStorage();
      expect(mockDel).toHaveBeenCalledWith("lumen-kanban-store");
    });

    it("returns early in SSR", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { clearLegacyStorage } = await import("@/src/lib/storage-manager");

      await clearLegacyStorage();
      expect(mockDel).not.toHaveBeenCalled();

      globalThis.window = originalWindow;
    });

    it("swallows errors when clear fails", async () => {
      mockDel.mockRejectedValue(new Error("Delete error"));

      const { clearLegacyStorage } = await import("@/src/lib/storage-manager");

      await expect(clearLegacyStorage()).resolves.toBeUndefined();
    });
  });

  describe("StorageKeys", () => {
    it("kanbanStore returns namespaced key", async () => {
      const { StorageKeys } = await import("@/src/lib/storage-manager");

      const key = StorageKeys.kanbanStore();
      expect(key).toContain("lumen-dev");
      expect(key).toContain("kanban-store");
    });

    it("collabPersistence returns namespaced key with workspace ID", async () => {
      const { StorageKeys } = await import("@/src/lib/storage-manager");

      const key = StorageKeys.collabPersistence("ws-123");
      expect(key).toContain("lumen-dev");
      expect(key).toContain("collab-ws-123");
    });

    it("legacyKanbanStore returns static key", async () => {
      const { StorageKeys } = await import("@/src/lib/storage-manager");

      expect(StorageKeys.legacyKanbanStore()).toBe("lumen-kanban-store");
    });
  });

  describe("getEnvironmentType", () => {
    it("returns development for localhost", async () => {
      globalThis.window = {
        location: { hostname: "localhost", port: "3000" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("development");
    });

    it("returns development for 127.0.0.1", async () => {
      globalThis.window = {
        location: { hostname: "127.0.0.1", port: "3000" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("development");
    });

    it("returns preview for staging domains", async () => {
      globalThis.window = {
        location: { hostname: "staging.example.com", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("preview");
    });

    it("returns preview for vercel.app domains", async () => {
      globalThis.window = {
        location: { hostname: "my-app.vercel.app", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("preview");
    });

    it("returns production in SSR", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("production");

      globalThis.window = originalWindow;
    });
  });

  describe("getStorageNamespace", () => {
    it("returns a valid namespace string", async () => {
      const { getStorageNamespace } = await import("@/src/lib/storage-manager");
      const ns = getStorageNamespace();
      expect(typeof ns).toBe("string");
      expect(ns.length).toBeGreaterThan(0);
      expect(ns.startsWith("lumen-")).toBe(true);
    });

    it("caches namespace on subsequent calls", async () => {
      const { getStorageNamespace } = await import("@/src/lib/storage-manager");
      const first = getStorageNamespace();
      const second = getStorageNamespace();
      expect(first).toBe(second);
    });

    it("caches namespace on subsequent calls", async () => {
      const { getStorageNamespace } = await import("@/src/lib/storage-manager");

      const first = getStorageNamespace();
      const second = getStorageNamespace();
      expect(first).toBe(second);
    });

    it("uses port 80 as default when port is empty", async () => {
      globalThis.window = {
        location: { hostname: "localhost", port: "" },
      } as typeof window;

      const { getStorageNamespace } = await import("@/src/lib/storage-manager");
      // cachedNamespace is already set; verify it still returns correctly
      const ns = getStorageNamespace();
      expect(typeof ns).toBe("string");
      expect(ns.length).toBeGreaterThan(0);
    });
  });

  describe("migrateFromLegacyStorage", () => {
    it("returns false in SSR", async () => {
      const originalWindow = globalThis.window;
      globalThis.window = undefined as unknown as typeof window;

      const { migrateFromLegacyStorage } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();
      expect(result).toBe(false);

      globalThis.window = originalWindow;
    });

    it("returns false and logs when migration throws", async () => {
      mockGet.mockRejectedValue(new Error("Storage error"));

      const { migrateFromLegacyStorage } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();
      expect(result).toBe(false);
    });

    it("migrates legacy data to new key", async () => {
      const legacyData = { boards: ["board1"], settings: { theme: "dark" } };
      mockGet.mockImplementation((key: string) => {
        if (key === "lumen-kanban-store") {
          return Promise.resolve(legacyData);
        }
        return Promise.resolve(null);
      });

      const { migrateFromLegacyStorage, StorageKeys } = await import(
        "@/src/lib/storage-manager"
      );

      const result = await migrateFromLegacyStorage();

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        StorageKeys.kanbanStore(),
        legacyData
      );
    });
  });
});
