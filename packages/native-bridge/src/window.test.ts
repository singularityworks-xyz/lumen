import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface MockWindow {
  __TAURI_INTERNALS__?: object | undefined;
}

const originalWindow = globalThis.window;

function setMockWindow(win: MockWindow | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

// Configurable mock functions - set at top level so module cache issue is avoided
const mockMinimize = mock(() => Promise.resolve());
const mockToggleMaximize = mock(() => Promise.resolve());
const mockClose = mock(() => Promise.resolve());
const mockStartDragging = mock(() => Promise.resolve());
const mockIsMaximized = mock(() => Promise.resolve(false));

mock.module("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    startDragging: mockStartDragging,
    isMaximized: mockIsMaximized,
  }),
}));

import {
  closeWindow,
  isMaximized,
  minimizeWindow,
  startDragging,
  toggleMaximize,
} from "./window";

beforeEach(() => {
  mockMinimize.mockClear();
  mockMinimize.mockImplementation(() => Promise.resolve());
  mockToggleMaximize.mockClear();
  mockToggleMaximize.mockImplementation(() => Promise.resolve());
  mockClose.mockClear();
  mockClose.mockImplementation(() => Promise.resolve());
  mockStartDragging.mockClear();
  mockStartDragging.mockImplementation(() => Promise.resolve());
  mockIsMaximized.mockClear();
  mockIsMaximized.mockImplementation(() => Promise.resolve(false));
});

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("window", () => {
  describe("minimizeWindow", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      await expect(minimizeWindow()).resolves.toBeUndefined();
      expect(mockMinimize).not.toHaveBeenCalled();
    });

    it("no-ops in SSR context", async () => {
      setMockWindow(undefined);
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });

    it("calls minimize in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await minimizeWindow();
      expect(mockMinimize).toHaveBeenCalled();
    });

    it("swallows errors when minimize rejects", async () => {
      mockMinimize.mockImplementation(() =>
        Promise.reject(new Error("minimize failed"))
      );
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });
  });

  describe("toggleMaximize", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      await expect(toggleMaximize()).resolves.toBeUndefined();
      expect(mockToggleMaximize).not.toHaveBeenCalled();
    });

    it("no-ops in SSR context", async () => {
      setMockWindow(undefined);
      await expect(toggleMaximize()).resolves.toBeUndefined();
    });

    it("calls toggleMaximize in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await toggleMaximize();
      expect(mockToggleMaximize).toHaveBeenCalled();
    });

    it("swallows errors when toggleMaximize rejects", async () => {
      mockToggleMaximize.mockImplementation(() =>
        Promise.reject(new Error("toggle failed"))
      );
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await expect(toggleMaximize()).resolves.toBeUndefined();
    });
  });

  describe("closeWindow", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      await expect(closeWindow()).resolves.toBeUndefined();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("no-ops in SSR context", async () => {
      setMockWindow(undefined);
      await expect(closeWindow()).resolves.toBeUndefined();
    });

    it("calls close in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await closeWindow();
      expect(mockClose).toHaveBeenCalled();
    });

    it("swallows errors when close rejects", async () => {
      mockClose.mockImplementation(() =>
        Promise.reject(new Error("close failed"))
      );
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await expect(closeWindow()).resolves.toBeUndefined();
    });
  });

  describe("startDragging", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      await expect(startDragging()).resolves.toBeUndefined();
      expect(mockStartDragging).not.toHaveBeenCalled();
    });

    it("no-ops in SSR context", async () => {
      setMockWindow(undefined);
      await expect(startDragging()).resolves.toBeUndefined();
    });

    it("calls startDragging in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await startDragging();
      expect(mockStartDragging).toHaveBeenCalled();
    });

    it("swallows errors when startDragging rejects", async () => {
      mockStartDragging.mockImplementation(() =>
        Promise.reject(new Error("drag failed"))
      );
      setMockWindow({ __TAURI_INTERNALS__: {} });
      await expect(startDragging()).resolves.toBeUndefined();
    });
  });

  describe("isMaximized", () => {
    it("returns false in web context", async () => {
      setMockWindow({});
      expect(await isMaximized()).toBe(false);
    });

    it("returns false in SSR context", async () => {
      setMockWindow(undefined);
      expect(await isMaximized()).toBe(false);
    });

    it("returns false when native import fails", async () => {
      mockIsMaximized.mockImplementation(() =>
        Promise.reject(new Error("failed"))
      );
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(await isMaximized()).toBe(false);
    });

    it("returns true when native window is maximized", async () => {
      mockIsMaximized.mockImplementation(() => Promise.resolve(true));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(await isMaximized()).toBe(true);
    });

    it("returns false when native window is not maximized", async () => {
      mockIsMaximized.mockImplementation(() => Promise.resolve(false));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      expect(await isMaximized()).toBe(false);
    });
  });
});
