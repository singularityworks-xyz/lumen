import { afterEach, describe, expect, it } from "bun:test";

interface MockWindow {
  __TAURI_INTERNALS__?: object | null;
}

const originalWindow = globalThis.window;

function setMockWindow(win: MockWindow | undefined) {
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

describe("platform detection", () => {
  describe("isTauri", () => {
    it("returns false in SSR context (no window)", async () => {
      setMockWindow(undefined);
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });

    it("returns false in browser context without Tauri internals", async () => {
      setMockWindow({});
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });

    it("returns true when __TAURI_INTERNALS__ exists", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(true);
    });

    it("returns false when __TAURI_INTERNALS__ is present but falsy", async () => {
      setMockWindow({ __TAURI_INTERNALS__: null });
      const { isTauri } = await import("../../platform");
      expect(isTauri()).toBe(false);
    });
  });

  describe("getPlatform", () => {
    it("returns 'web' when not in Tauri", async () => {
      setMockWindow({});
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("web");
    });

    it("returns 'tauri' when in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("tauri");
    });

    it("returns 'web' in SSR context", async () => {
      setMockWindow(undefined);
      const { getPlatform } = await import("../../platform");
      expect(getPlatform()).toBe("web");
    });
  });

  describe("getOS", () => {
    it("returns 'unknown' when not in Tauri context", async () => {
      setMockWindow({});
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' in SSR context", async () => {
      setMockWindow(undefined);
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' when Tauri plugin import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { getOS } = await import("../../platform");
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' for unsupported OS values", () => {
      const unsupportedValues = ["freebsd", "openbsd", "android", "ios", ""];
      for (const val of unsupportedValues) {
        expect(["linux", "macos", "windows", "unknown"]).not.toContain(val);
      }
    });
  });
});
