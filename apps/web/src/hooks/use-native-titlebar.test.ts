import { afterEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import {
  NATIVE_TITLEBAR_HEIGHT,
  useIsNative,
  useNativeTitlebarOffset,
} from "./use-native-titlebar";

// Mock the native-bridge module
const mockIsTauri = mock(() => false);
mock.module("@lumen/native-bridge", () => ({
  isTauri: mockIsTauri,
}));

describe("use-native-titlebar", () => {
  afterEach(() => {
    mockIsTauri.mockClear();
  });

  describe("constants", () => {
    it("NATIVE_TITLEBAR_HEIGHT equals 32", () => {
      expect(NATIVE_TITLEBAR_HEIGHT).toBe(32);
    });

    it("NATIVE_TITLEBAR_HEIGHT is positive", () => {
      expect(NATIVE_TITLEBAR_HEIGHT).toBeGreaterThan(0);
    });
  });

  describe("useNativeTitlebarOffset", () => {
    it("returns 0 in non-Tauri context", () => {
      mockIsTauri.mockReturnValue(false);
      const { result } = renderHook(() => useNativeTitlebarOffset());
      expect(result.current).toBe(0);
    });

    it("returns NATIVE_TITLEBAR_HEIGHT in Tauri context", () => {
      mockIsTauri.mockReturnValue(true);
      const { result } = renderHook(() => useNativeTitlebarOffset());
      expect(result.current).toBe(NATIVE_TITLEBAR_HEIGHT);
    });
  });

  describe("useIsNative", () => {
    it("returns false in non-Tauri context", () => {
      mockIsTauri.mockReturnValue(false);
      const { result } = renderHook(() => useIsNative());
      expect(result.current).toBe(false);
    });

    it("returns true in Tauri context", () => {
      mockIsTauri.mockReturnValue(true);
      const { result } = renderHook(() => useIsNative());
      expect(result.current).toBe(true);
    });
  });
});
