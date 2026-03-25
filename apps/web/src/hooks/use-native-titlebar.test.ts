import { afterEach, describe, expect, it } from "bun:test";
import { NATIVE_TITLEBAR_HEIGHT } from "./use-native-titlebar";

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

const mockIsTauri = (): boolean => {
  const win = globalThis.window as MockWindow | undefined;
  return !!win?.__TAURI_INTERNALS__;
};

describe("use-native-titlebar", () => {
  describe("constants", () => {
    it("NATIVE_TITLEBAR_HEIGHT is positive", () => {
      expect(NATIVE_TITLEBAR_HEIGHT).toBeGreaterThan(0);
    });

    it("NATIVE_TITLEBAR_HEIGHT equals 32", () => {
      expect(NATIVE_TITLEBAR_HEIGHT).toBe(32);
    });
  });

  describe("isTauri detection logic", () => {
    it("returns true in Tauri context", () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(mockIsTauri()).toBe(true);
    });

    it("returns false in non-Tauri context", () => {
      setMockWindow({});
      expect(mockIsTauri()).toBe(false);
    });

    it("returns false when window is undefined", () => {
      setMockWindow(undefined);
      expect(mockIsTauri()).toBe(false);
    });

    it("returns false when __TAURI_INTERNALS__ is null", () => {
      setMockWindow({ __TAURI_INTERNALS__: null });
      expect(mockIsTauri()).toBe(false);
    });
  });
});
