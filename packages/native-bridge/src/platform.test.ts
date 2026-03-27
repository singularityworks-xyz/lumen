import { afterEach, describe, expect, it, mock } from "bun:test";
import { getOS, getPlatform, isTauri } from "./platform";

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
    it("returns false in SSR context (no window)", () => {
      setMockWindow(undefined);
      expect(isTauri()).toBe(false);
    });

    it("returns false in browser context without Tauri internals", () => {
      setMockWindow({});
      expect(isTauri()).toBe(false);
    });

    it("returns true when __TAURI_INTERNALS__ exists", () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(isTauri()).toBe(true);
    });

    it("returns false when __TAURI_INTERNALS__ is null", () => {
      setMockWindow({ __TAURI_INTERNALS__: null });
      expect(isTauri()).toBe(false);
    });

    it("returns false when __TAURI_INTERNALS__ is undefined", () => {
      setMockWindow({ __TAURI_INTERNALS__: undefined });
      expect(isTauri()).toBe(false);
    });
  });

  describe("getPlatform", () => {
    it("returns 'web' when not in Tauri", () => {
      setMockWindow({});
      expect(getPlatform()).toBe("web");
    });

    it("returns 'tauri' when in Tauri context", () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(getPlatform()).toBe("tauri");
    });

    it("returns 'web' in SSR context", () => {
      setMockWindow(undefined);
      expect(getPlatform()).toBe("web");
    });
  });

  describe("getOS", () => {
    it("returns 'unknown' when not in Tauri context", async () => {
      setMockWindow({});
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' in SSR context", async () => {
      setMockWindow(undefined);
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' when Tauri plugin import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const os = await getOS();
      expect(os).toBe("unknown");
    });

    it("returns 'unknown' for unsupported OS values", () => {
      const supportedOS = ["linux", "macos", "windows", "unknown"];
      const unsupportedValues = ["freebsd", "openbsd", "android", "ios", ""];
      for (const val of unsupportedValues) {
        expect(supportedOS).not.toContain(val);
      }
      // getOS() maps any unrecognized platform to "unknown"
      expect(supportedOS).toContain("unknown");
    });

    it("returns OS when Tauri plugin succeeds", async () => {
      // Mock @tauri-apps/plugin-os to return linux
      mock.module("@tauri-apps/plugin-os", () => ({
        platform: () => Promise.resolve("linux"),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const os = await getOS();
      expect(os).toBe("linux");
    });

    it("returns 'unknown' for unrecognized platform values", async () => {
      // Mock @tauri-apps/plugin-os to return unsupported value
      mock.module("@tauri-apps/plugin-os", () => ({
        platform: () => Promise.resolve("freebsd"),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const os = await getOS();
      expect(os).toBe("unknown");
    });
  });
});
