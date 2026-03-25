import { afterEach, describe, expect, it } from "bun:test";
import { NATIVE_TITLEBAR_HEIGHT } from "./use-native-titlebar";

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow as Window & typeof globalThis;
});

const mockIsTauri = (): boolean => {
  return !!(globalThis.window as { __TAURI_INTERNALS__?: object } | undefined)
    ?.__TAURI_INTERNALS__;
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
      (globalThis as any).window = { __TAURI_INTERNALS__: {} };
      expect(mockIsTauri()).toBe(true);
    });

    it("returns false in non-Tauri context", () => {
      (globalThis as any).window = {};
      expect(mockIsTauri()).toBe(false);
    });

    it("returns false when window is undefined", () => {
      (globalThis as any).window = undefined;
      expect(mockIsTauri()).toBe(false);
    });

    it("returns false when __TAURI_INTERNALS__ is null", () => {
      (globalThis as any).window = { __TAURI_INTERNALS__: null };
      expect(mockIsTauri()).toBe(false);
    });
  });
});
