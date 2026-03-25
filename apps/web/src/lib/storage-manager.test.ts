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
  });
});
