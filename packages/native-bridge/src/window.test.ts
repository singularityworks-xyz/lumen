import { afterEach, describe, expect, it, mock } from "bun:test";

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
      const { minimizeWindow } = await import("./window");
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });

    it("no-ops in SSR context", async () => {
      setMockWindow(undefined);
      const { minimizeWindow } = await import("./window");
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });

    it("does not reject when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { minimizeWindow } = await import("./window");
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });
  });

  describe("toggleMaximize", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      const { toggleMaximize } = await import("./window");
      await expect(toggleMaximize()).resolves.toBeUndefined();
    });

    it("does not reject when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { toggleMaximize } = await import("./window");
      await expect(toggleMaximize()).resolves.toBeUndefined();
    });
  });

  describe("closeWindow", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      const { closeWindow } = await import("./window");
      await expect(closeWindow()).resolves.toBeUndefined();
    });

    it("does not reject when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { closeWindow } = await import("./window");
      await expect(closeWindow()).resolves.toBeUndefined();
    });
  });

  describe("startDragging", () => {
    it("no-ops in web context", async () => {
      setMockWindow({});
      const { startDragging } = await import("./window");
      await expect(startDragging()).resolves.toBeUndefined();
    });

    it("does not reject when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { startDragging } = await import("./window");
      await expect(startDragging()).resolves.toBeUndefined();
    });
  });

  describe("isMaximized", () => {
    it("returns false in web context", async () => {
      setMockWindow({});
      const { isMaximized } = await import("./window");
      expect(await isMaximized()).toBe(false);
    });

    it("returns false in SSR context", async () => {
      setMockWindow(undefined);
      const { isMaximized } = await import("./window");
      expect(await isMaximized()).toBe(false);
    });

    it("returns false when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { isMaximized } = await import("./window");
      expect(await isMaximized()).toBe(false);
    });

    it("returns true when native window is maximized", async () => {
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          isMaximized: mock(() => Promise.resolve(true)),
          minimize: mock(() => Promise.resolve()),
          toggleMaximize: mock(() => Promise.resolve()),
          close: mock(() => Promise.resolve()),
          startDragging: mock(() => Promise.resolve()),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { isMaximized } = await import("./window");
      expect(await isMaximized()).toBe(true);
    });
  });

  describe("native window operations with mocked Tauri API", () => {
    it("calls minimize on the current window", async () => {
      const minimizeFn = mock(() => Promise.resolve());
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          minimize: minimizeFn,
          toggleMaximize: mock(() => Promise.resolve()),
          close: mock(() => Promise.resolve()),
          startDragging: mock(() => Promise.resolve()),
          isMaximized: mock(() => Promise.resolve(false)),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { minimizeWindow } = await import("./window");
      await minimizeWindow();
      expect(minimizeFn).toHaveBeenCalled();
    });

    it("calls toggleMaximize on the current window", async () => {
      const toggleFn = mock(() => Promise.resolve());
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          minimize: mock(() => Promise.resolve()),
          toggleMaximize: toggleFn,
          close: mock(() => Promise.resolve()),
          startDragging: mock(() => Promise.resolve()),
          isMaximized: mock(() => Promise.resolve(false)),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { toggleMaximize } = await import("./window");
      await toggleMaximize();
      expect(toggleFn).toHaveBeenCalled();
    });

    it("calls close on the current window", async () => {
      const closeFn = mock(() => Promise.resolve());
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          minimize: mock(() => Promise.resolve()),
          toggleMaximize: mock(() => Promise.resolve()),
          close: closeFn,
          startDragging: mock(() => Promise.resolve()),
          isMaximized: mock(() => Promise.resolve(false)),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { closeWindow } = await import("./window");
      await closeWindow();
      expect(closeFn).toHaveBeenCalled();
    });

    it("calls startDragging on the current window", async () => {
      const dragFn = mock(() => Promise.resolve());
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          minimize: mock(() => Promise.resolve()),
          toggleMaximize: mock(() => Promise.resolve()),
          close: mock(() => Promise.resolve()),
          startDragging: dragFn,
          isMaximized: mock(() => Promise.resolve(false)),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { startDragging } = await import("./window");
      await startDragging();
      expect(dragFn).toHaveBeenCalled();
    });

    it("swallows errors when window method rejects", async () => {
      mock.module("@tauri-apps/api/window", () => ({
        getCurrentWindow: () => ({
          minimize: mock(() => Promise.reject(new Error("minimize failed"))),
          toggleMaximize: mock(() => Promise.resolve()),
          close: mock(() => Promise.resolve()),
          startDragging: mock(() => Promise.resolve()),
          isMaximized: mock(() => Promise.resolve(false)),
        }),
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { minimizeWindow } = await import("./window");
      await expect(minimizeWindow()).resolves.toBeUndefined();
    });
  });
});
