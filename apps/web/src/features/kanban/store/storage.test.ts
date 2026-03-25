import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockDel = mock(() => Promise.resolve()) as any;
const mockGet = mock(() => Promise.resolve(null)) as any;
const mockKeys = mock(() => Promise.resolve([])) as any;
const mockSet = mock(() => Promise.resolve()) as any;

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

describe("storage", () => {
  describe("environment-scoped key transformation", () => {
    it("transforms static STORAGE_KEY to environment-scoped key", async () => {
      const { getStorageKey, STORAGE_KEY } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = getStorageKey();
      expect(result).toContain("kanban-store");
      expect(result).not.toBe(STORAGE_KEY);
      expect(result).not.toBe("lumen-kanban-store");
    });

    it("leaves non-STORAGE_KEY names unchanged", async () => {
      const { transformStorageKey } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = transformStorageKey("other-storage");
      expect(result).toBe("other-storage");
    });
  });

  describe("legacy migration", () => {
    it("runs once and reuses migrated data", async () => {
      let callCount = 0;
      mockGet.mockImplementation((key: string) => {
        callCount++;
        if (key === "lumen-kanban-store") {
          return Promise.resolve({
            data: { test: "value" },
            timestamp: 123,
            version: 1,
          });
        }
        if (key.includes("lumen-dev")) {
          if (callCount <= 2) {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            data: { migrated: true },
            timestamp: 456,
            version: 1,
          });
        }
        return Promise.resolve(null);
      });

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      const firstResult = await indexedDBStorage.getItem("lumen-kanban-store");
      const secondResult = await indexedDBStorage.getItem("lumen-kanban-store");

      expect(firstResult).not.toBeNull();
      expect(secondResult).not.toBeNull();
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it("does not run migration if already completed", async () => {
      mockGet.mockResolvedValue(null);

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = await indexedDBStorage.getItem("lumen-kanban-store");
      expect(result).toBeNull();
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe("versioned data migration", () => {
    it("wraps data with version and migrates old version", async () => {
      mockGet.mockResolvedValue({
        data: { oldData: true },
        timestamp: 123,
        version: 0,
      });

      const { indexedDBStorage, STORAGE_VERSION } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = await indexedDBStorage.getItem("lumen-kanban-store");

      expect(result).not.toBeNull();
      expect(JSON.parse(result!)).toEqual({ oldData: true });
      expect(mockSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          version: STORAGE_VERSION,
          data: { oldData: true },
        })
      );
    });

    it("returns current version data without migration", async () => {
      const currentData = { current: true };
      mockGet.mockResolvedValue({
        data: currentData,
        timestamp: Date.now(),
        version: 1,
      });

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = await indexedDBStorage.getItem("lumen-kanban-store");

      expect(JSON.parse(result!)).toEqual(currentData);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe("storage operations fail closed", () => {
    it("returns null on get error", async () => {
      mockGet.mockRejectedValue(new Error("DB error"));

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = await indexedDBStorage.getItem("lumen-kanban-store");
      expect(result).toBeNull();
    });

    it("returns data when version field exists (even if data is string)", async () => {
      mockGet.mockResolvedValue({
        data: "invalid",
        timestamp: 123,
        version: 1,
      });

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      const result = await indexedDBStorage.getItem("lumen-kanban-store");
      expect(result).not.toBeNull();
      expect(result).toBe('"invalid"');
    });

    it("does not throw on set error", async () => {
      mockSet.mockRejectedValue(new Error("Write error"));

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      let threwError = false;
      try {
        await indexedDBStorage.setItem(
          "lumen-kanban-store",
          JSON.stringify({ test: true })
        );
      } catch {
        threwError = true;
      }
      expect(threwError).toBe(false);
    });

    it("does not throw on remove error", async () => {
      mockDel.mockRejectedValue(new Error("Delete error"));

      const { indexedDBStorage } = await import(
        "@/src/features/kanban/store/storage"
      );

      let threwError = false;
      try {
        await indexedDBStorage.removeItem("lumen-kanban-store");
      } catch {
        threwError = true;
      }
      expect(threwError).toBe(false);
    });
  });
});
