import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Integration test: auth + platform + window + websocket working together
// Tests cross-module interaction patterns

let deepLinkCallback: ((urls: string[]) => void) | null = null;

mock.module("@tauri-apps/plugin-deep-link", () => ({
  onOpenUrl: (cb: (urls: string[]) => void) => {
    deepLinkCallback = cb;
    return Promise.resolve();
  },
  getCurrent: () => Promise.resolve([]),
}));

mock.module("@tauri-apps/plugin-shell", () => ({
  open: (_url: string) => Promise.resolve(),
}));

const originalWindow = globalThis.window;

function setMockWindow(win: object | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

function setTauriContext() {
  setMockWindow({
    __TAURI_INTERNALS__: {
      invoke: () => Promise.resolve(),
      transformCallback: (cb: unknown) => cb,
    },
  });
}

beforeEach(() => {
  deepLinkCallback = null;
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("native-bridge integration", () => {
  describe("platform + auth interop", () => {
    it("shouldUseNativeAuth returns true in Tauri context", async () => {
      setTauriContext();
      const { getPlatform } = await import("../platform");
      const { shouldUseNativeAuth } = await import("../auth");

      expect(getPlatform()).toBe("tauri");
      expect(shouldUseNativeAuth()).toBe(true);
    });

    it("shouldUseNativeAuth returns false in web context", async () => {
      setMockWindow({});
      const { getPlatform } = await import("../platform");
      const { shouldUseNativeAuth } = await import("../auth");

      expect(getPlatform()).toBe("web");
      expect(shouldUseNativeAuth()).toBe(false);
    });

    it("initializeNativeAuth + onAuthDeepLink flow works end-to-end", async () => {
      setTauriContext();
      const { initializeNativeAuth, onAuthDeepLink, getOAuthCallbackUrl } =
        await import("../auth");

      await initializeNativeAuth();

      const receivedUrls: string[] = [];
      const unsub = onAuthDeepLink((url) => {
        receivedUrls.push(url);
      });

      const callbackUrl = getOAuthCallbackUrl();
      expect(callbackUrl).toBe("lumen://auth/callback");

      deepLinkCallback?.([`${callbackUrl}?token=abc&refresh=xyz`]);

      expect(receivedUrls).toHaveLength(1);
      expect(receivedUrls[0]).toContain("token=abc");

      unsub();
    });

    it("OAuth flow resolves with params via deep link callback", async () => {
      setTauriContext();
      const { initiateOAuthFlow, initializeNativeAuth } = await import(
        "../auth"
      );

      await initializeNativeAuth();

      const flow = initiateOAuthFlow("https://auth.example.com/authorize");
      deepLinkCallback?.(["lumen://auth/callback?code=auth123&state=xyz"]);

      const params = await flow;
      expect(params.get("code")).toBe("auth123");
      expect(params.get("state")).toBe("xyz");
    });

    it("platform detection is consistent across calls", async () => {
      setTauriContext();
      const platform1 = await import("../platform");
      const platform2 = await import("../platform");

      expect(platform1.isTauri()).toBe(platform2.isTauri());
      expect(platform1.getPlatform()).toBe(platform2.getPlatform());
    });
  });

  describe("window + platform interop", () => {
    it("window operations are no-ops in web context", async () => {
      setMockWindow({});
      const { isTauri } = await import("../platform");
      const {
        minimizeWindow,
        toggleMaximize,
        closeWindow,
        startDragging,
        isMaximized,
      } = await import("../window");

      expect(isTauri()).toBe(false);
      await expect(minimizeWindow()).resolves.toBeUndefined();
      await expect(toggleMaximize()).resolves.toBeUndefined();
      await expect(closeWindow()).resolves.toBeUndefined();
      await expect(startDragging()).resolves.toBeUndefined();
      expect(await isMaximized()).toBe(false);
    });

    it("window operations are no-ops in SSR context", async () => {
      setMockWindow(undefined);
      const {
        minimizeWindow,
        toggleMaximize,
        closeWindow,
        startDragging,
        isMaximized,
      } = await import("../window");

      await expect(minimizeWindow()).resolves.toBeUndefined();
      await expect(toggleMaximize()).resolves.toBeUndefined();
      await expect(closeWindow()).resolves.toBeUndefined();
      await expect(startDragging()).resolves.toBeUndefined();
      expect(await isMaximized()).toBe(false);
    });
  });

  describe("websocket + platform interop", () => {
    it("creates browser WebSocket in web context", async () => {
      setMockWindow({});
      const { isTauri } = await import("../platform");
      const { connectWebSocket } = await import("../websocket");

      expect(isTauri()).toBe(false);
      const ws = await connectWebSocket("ws://localhost:9999");
      expect(ws).toBeInstanceOf(WebSocket);
      ws.close();
    });

    it("falls back to browser WebSocket in Tauri context", async () => {
      setTauriContext();
      const { isTauri } = await import("../platform");
      const { connectWebSocket } = await import("../websocket");

      expect(isTauri()).toBe(true);
      // In Tauri context, native WebSocket plugin may be used (mocked from other tests)
      // or falls back to browser WebSocket
      const ws = await connectWebSocket("ws://localhost:9999");
      // Either a browser WebSocket or a mocked native WebSocket
      expect(ws).toBeDefined();
      expect(typeof ws.send).toBe("function");
      if (ws.close) {
        ws.close();
      }
      if (ws.disconnect) {
        ws.disconnect();
      }
    });
  });

  describe("auth + window combined", () => {
    it("auth deep link and window operations coexist in Tauri context", async () => {
      setTauriContext();
      const { initializeNativeAuth, onAuthDeepLink, cancelOAuthFlow } =
        await import("../auth");
      const { isMaximized } = await import("../window");

      await initializeNativeAuth();

      const cb = () => undefined;
      const unsub = onAuthDeepLink(cb);

      expect(await isMaximized()).toBe(false);
      cancelOAuthFlow();
      unsub();
    });
  });
});
