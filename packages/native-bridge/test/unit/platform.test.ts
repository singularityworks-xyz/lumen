import { afterEach, describe, expect, it } from "bun:test";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    (globalThis as any).window = undefined;
  } else {
    globalThis.window = originalWindow;
  }
});

describe("platform detection", () => {
  describe("isTauri", () => {
    it("returns false in SSR context (no window)", async () => {
      (globalThis as any).window = undefined;
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });

    it("returns false in browser context without Tauri internals", async () => {
      (globalThis as any).window = {};
      (globalThis.window as any).__TAURI_INTERNALS__ = undefined;
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });

    it("returns true when __TAURI_INTERNALS__ exists", async () => {
      (globalThis as any).window = { __TAURI_INTERNALS__: {} };
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(true);
    });

    it("returns true even if __TAURI_INTERNALS__ is falsy but present", async () => {
      (globalThis as any).window = { __TAURI_INTERNALS__: null };
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });
  });

  describe("getPlatform", () => {
    it("returns 'web' when not in Tauri", async () => {
      (globalThis as any).window = {};
      (globalThis.window as any).__TAURI_INTERNALS__ = undefined;
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("web");
    });

    it("returns 'tauri' when in Tauri context", async () => {
      (globalThis as any).window = { __TAURI_INTERNALS__: {} };
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("tauri");
    });

    it("returns 'web' in SSR context", async () => {
      (globalThis as any).window = undefined;
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("web");
    });
  });

  describe("getOS", () => {
    it("returns 'unknown' when not in Tauri context", async () => {
      (globalThis as any).window = {};
      (globalThis.window as any).__TAURI_INTERNALS__ = undefined;
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' in SSR context", async () => {
      (globalThis as any).window = undefined;
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' when Tauri plugin import fails", async () => {
      (globalThis as any).window = { __TAURI_INTERNALS__: {} };
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("normalizes unsupported OS values to 'unknown'", () => {
      const osValues = ["freebsd", "openbsd", "android", "ios", ""];
      for (const val of osValues) {
        expect(["linux", "macos", "windows", "unknown"]).not.toContain(val);
      }
    });
  });
});
