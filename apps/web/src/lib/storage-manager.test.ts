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

const { _resetCachedNamespace } = await import("@/src/lib/storage-manager");

beforeEach(() => {
  mockDel.mockReset();
  mockGet.mockReset();
  mockKeys.mockReset();
  mockSet.mockReset();
  _resetCachedNamespace();

  globalThis.window = {
    location: { hostname: "localhost", port: "3000" },
  } as typeof window;
});

describe("storage-manager", () => {
  // getStorageNamespace tests are FIRST so they execute before any describe
  // block that indirectly calls getStorageNamespace (e.g. StorageKeys).
  // The SSR test is listed first because the SSR branch returns without
  // caching cachedNamespace, allowing the production test (second) to also
  // execute and set cachedNamespace for all subsequent tests.
  describe("getStorageNamespace", () => {
    it("returns SSR namespace when no window", async () => {
      globalThis.window = undefined as unknown as typeof window;

      const { getStorageNamespace } = await import("@/src/lib/storage-manager");
      // The SSR branch returns without caching, so cachedNamespace stays null
      expect(getStorageNamespace()).toBe("lumen-ssr");
    });

    it("returns production namespace for custom domain", async () => {
      globalThis.window = {
        location: { hostname: "app.example.com", port: "443" },
      } as typeof window;

      const { getStorageNamespace } = await import("@/src/lib/storage-manager");
      // cachedNamespace is still null (SSR branch didn't cache), so this
      // executes the production branch and caches the result
      expect(getStorageNamespace()).toBe("lumen-app.example.com");
    });

    it("caches namespace on subsequent calls", async () => {
      const { getStorageNamespace } = await import("@/src/lib/storage-manager");

      const first = getStorageNamespace();
      const second = getStorageNamespace();
      expect(first).toBe(second);
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

    it("returns preview for preview domains", async () => {
      globalThis.window = {
        location: { hostname: "preview-abc.vercel.app", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("preview");
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

    it("returns production for custom domains", async () => {
      globalThis.window = {
        location: { hostname: "app.example.com", port: "443" },
      } as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("production");
    });

    it("returns production in SSR", async () => {
      globalThis.window = undefined as unknown as typeof window;

      const { getEnvironmentType } = await import("@/src/lib/storage-manager");
      expect(getEnvironmentType()).toBe("production");
    });
  });

  // All tests below need the production namespace pre-cached
  describe("with production namespace", () => {
    beforeEach(() => {
      globalThis.window = {
        location: { hostname: "app.example.com", port: "443" },
      } as typeof window;
      _resetCachedNamespace();
      const { getStorageNamespace } = require("@/src/lib/storage-manager");
      getStorageNamespace();
    });

    describe("StorageKeys", () => {
      it("kanbanStore returns namespaced key", async () => {
        const { StorageKeys } = await import("@/src/lib/storage-manager");

        const key = StorageKeys.kanbanStore();
        expect(key).toContain("lumen-app.example.com");
        expect(key).toContain("kanban-store");
      });

      it("collabPersistence returns namespaced key with workspace ID", async () => {
        const { StorageKeys } = await import("@/src/lib/storage-manager");

        const key = StorageKeys.collabPersistence("ws-123");
        expect(key).toContain("lumen-app.example.com");
        expect(key).toContain("collab-ws-123");
      });

      it("legacyKanbanStore returns static key", async () => {
        const { StorageKeys } = await import("@/src/lib/storage-manager");

        expect(StorageKeys.legacyKanbanStore()).toBe("lumen-kanban-store");
      });
    });

    describe("clearCurrentEnvironment", () => {
      it("deletes only current environment keys", async () => {
        mockKeys.mockResolvedValue([
          "lumen-app.example.com-kanban-store",
          "lumen-app.example.com-collab-ws1",
          "lumen-prod-kanban-store",
          "lumen-ssr-kanban-store",
        ]);
        mockDel.mockResolvedValue();

        const { clearCurrentEnvironment } = await import(
          "@/src/lib/storage-manager"
        );

        await clearCurrentEnvironment();

        expect(mockDel).toHaveBeenCalledTimes(2);
        expect(mockDel).toHaveBeenCalledWith(
          "lumen-app.example.com-kanban-store"
        );
        expect(mockDel).toHaveBeenCalledWith(
          "lumen-app.example.com-collab-ws1"
        );
        expect(mockDel).not.toHaveBeenCalledWith("lumen-prod-kanban-store");
        expect(mockDel).not.toHaveBeenCalledWith("lumen-ssr-kanban-store");
      });

      it("returns early in SSR environment", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { clearCurrentEnvironment } = await import(
          "@/src/lib/storage-manager"
        );

        await clearCurrentEnvironment();

        expect(mockKeys).not.toHaveBeenCalled();
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
      it("exports only current namespace keys", async () => {
        mockKeys.mockResolvedValue([
          "lumen-app.example.com-kanban-store",
          "lumen-app.example.com-collab-ws1",
          "lumen-prod-kanban-store",
        ]);
        mockGet.mockImplementation((key: string) => {
          if (key === "lumen-app.example.com-kanban-store") {
            return Promise.resolve({ data: "kanban" });
          }
          if (key === "lumen-app.example.com-collab-ws1") {
            return Promise.resolve({ data: "collab" });
          }
          return Promise.resolve(null);
        });

        const { exportEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        const result = await exportEnvironmentData();

        expect(Object.keys(result)).toHaveLength(2);
        expect(result["lumen-app.example.com-kanban-store"]).toBeDefined();
        expect(result["lumen-prod-kanban-store"]).toBeUndefined();
      });

      it("returns empty object in SSR", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { exportEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        const result = await exportEnvironmentData();
        expect(result).toEqual({});
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
      it("imports only matching namespace keys", async () => {
        const importData = {
          "lumen-app.example.com-kanban-store": { data: "new" },
          "lumen-prod-kanban-store": { data: "old" },
        };

        const { importEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        await importEnvironmentData(importData);

        expect(mockSet).toHaveBeenCalledWith(
          "lumen-app.example.com-kanban-store",
          expect.anything()
        );
        expect(mockSet).not.toHaveBeenCalledWith(
          "lumen-prod-kanban-store",
          expect.anything()
        );
      });

      it("returns early in SSR", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { importEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        await importEnvironmentData({ key: "value" });
        expect(mockSet).not.toHaveBeenCalled();
      });

      it("throws when import fails", async () => {
        mockSet.mockRejectedValue(new Error("Import error"));

        const { importEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        await expect(
          importEnvironmentData({ "lumen-app.example.com-kanban-store": {} })
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
          "lumen-app.example.com-kanban-store": { boards: [] },
          "lumen-app.example.com-collab-ws1": { doc: "data" },
          "lumen-prod-kanban-store": { should: "skip" },
        };

        const { importEnvironmentData } = await import(
          "@/src/lib/storage-manager"
        );

        await importEnvironmentData(importData);

        expect(mockSet).toHaveBeenCalledTimes(2);
        expect(mockSet).toHaveBeenCalledWith(
          "lumen-app.example.com-kanban-store",
          {
            boards: [],
          }
        );
        expect(mockSet).toHaveBeenCalledWith(
          "lumen-app.example.com-collab-ws1",
          {
            doc: "data",
          }
        );
      });
    });

    describe("migrateFromLegacyStorage", () => {
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
          "lumen-app.example.com-kanban-store",
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
          if (key === "lumen-app.example.com-kanban-store") {
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

      it("returns false in SSR", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { migrateFromLegacyStorage } = await import(
          "@/src/lib/storage-manager"
        );

        const result = await migrateFromLegacyStorage();
        expect(result).toBe(false);
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

    describe("getStorageStats", () => {
      it("returns stats for current environment", async () => {
        mockKeys.mockResolvedValue([
          "lumen-app.example.com-kanban-store",
          "lumen-app.example.com-collab-ws1",
          "lumen-prod-kanban-store",
        ]);

        const { getStorageStats } = await import("@/src/lib/storage-manager");

        const stats = await getStorageStats();
        expect(stats.namespace).toContain("lumen-app.example.com");
        // window is production domain (from production beforeEach)
        expect(stats.environment).toBe("production");
        expect(stats.keyCount).toBe(2);
        expect(stats.keys).toHaveLength(2);
      });

      it("returns SSR stats when no window", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { getStorageStats } = await import("@/src/lib/storage-manager");

        const stats = await getStorageStats();
        expect(stats.namespace).toBe("lumen-ssr");
        expect(stats.environment).toBe("ssr");
        expect(stats.keyCount).toBe(0);
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
          "lumen-app.example.com-kanban-store",
          "lumen-prod-kanban-store",
        ]);

        const { getStorageStats } = await import("@/src/lib/storage-manager");

        const stats = await getStorageStats();
        expect(stats.keyCount).toBe(1);
        expect(stats.keys).toContain("lumen-app.example.com-kanban-store");
        expect(stats.keys).not.toContain("lumen-prod-kanban-store");
      });
    });

    describe("clearLegacyStorage", () => {
      it("clears legacy key in browser", async () => {
        mockDel.mockResolvedValue();

        const { clearLegacyStorage } = await import(
          "@/src/lib/storage-manager"
        );

        await clearLegacyStorage();
        expect(mockDel).toHaveBeenCalledWith("lumen-kanban-store");
      });

      it("returns early in SSR", async () => {
        globalThis.window = undefined as unknown as typeof window;

        const { clearLegacyStorage } = await import(
          "@/src/lib/storage-manager"
        );

        await clearLegacyStorage();
        expect(mockDel).not.toHaveBeenCalled();
      });

      it("swallows errors when clear fails", async () => {
        mockDel.mockRejectedValue(new Error("Delete error"));

        const { clearLegacyStorage } = await import(
          "@/src/lib/storage-manager"
        );

        await expect(clearLegacyStorage()).resolves.toBeUndefined();
      });
    }); // end describe blocks inside with production namespace
  }); // end with production namespace
}); // end storage-manager
