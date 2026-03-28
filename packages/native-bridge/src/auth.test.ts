import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Coverage note: auth.ts maxes at ~85% line coverage. The uncovered lines
// (35-38, 58, 84-85, 96-97, 113, 120-123, 127-128) are deep Tauri error
// branches that require overriding @tauri-apps/plugin-deep-link or
// @tauri-apps/plugin-shell mocks mid-file. bun:test's mock.module operates
// on a global module cache — overriding these mocks in a test block pollutes
// subsequent tests in the same process, causing failures in other test files
// (window.test.ts, websocket.test.ts). Reaching 100% would require
// refactoring auth.ts to accept dependency injection for its dynamic imports.

let deepLinkCallback: ((urls: string[]) => void) | null = null;
let initialUrls: string[] = [];
let forceDeepLinkError = false;
let forceShellOpenError = false;
let forceGetCurrentError = false;

mock.module("@tauri-apps/plugin-deep-link", () => ({
  onOpenUrl: (cb: (urls: string[]) => void) => {
    if (forceDeepLinkError) {
      return Promise.reject(new Error("deep link init failed"));
    }
    deepLinkCallback = cb;
    return Promise.resolve();
  },
  getCurrent: () => {
    if (forceGetCurrentError) {
      return Promise.reject(new Error("get current failed"));
    }
    return Promise.resolve(initialUrls);
  },
}));

mock.module("@tauri-apps/plugin-shell", () => ({
  open: (_url: string) => {
    if (forceShellOpenError) {
      return Promise.reject(new Error("shell open failed"));
    }
    return Promise.resolve();
  },
}));

const mockTauriInternals = {
  invoke: () => Promise.resolve(),
  transformCallback: (cb: unknown) => cb,
};

const originalWindow = globalThis.window;

function setMockWindow(win: object | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

function setTauriContext() {
  setMockWindow({ __TAURI_INTERNALS__: mockTauriInternals });
}

beforeEach(() => {
  deepLinkCallback = null;
  initialUrls = [];
  forceDeepLinkError = false;
  forceShellOpenError = false;
  forceGetCurrentError = false;
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

describe("auth", () => {
  describe("getOAuthCallbackUrl", () => {
    it("returns correct URL", async () => {
      const { getOAuthCallbackUrl } = await import("./auth");
      expect(getOAuthCallbackUrl()).toBe("lumen://auth/callback");
    });
  });

  describe("shouldUseNativeAuth", () => {
    it("returns false in web context", async () => {
      setMockWindow({});
      const { shouldUseNativeAuth } = await import("./auth");
      expect(shouldUseNativeAuth()).toBe(false);
    });

    it("returns true in Tauri context", async () => {
      setTauriContext();
      const { shouldUseNativeAuth } = await import("./auth");
      expect(shouldUseNativeAuth()).toBe(true);
    });

    it("returns false in SSR", async () => {
      setMockWindow(undefined);
      const { shouldUseNativeAuth } = await import("./auth");
      expect(shouldUseNativeAuth()).toBe(false);
    });
  });

  describe("cancelOAuthFlow", () => {
    it("does nothing when no flow active", async () => {
      const { cancelOAuthFlow } = await import("./auth");
      expect(() => cancelOAuthFlow()).not.toThrow();
    });

    it("cancels active flow", async () => {
      setTauriContext();
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      const flow = initiateOAuthFlow("https://auth.example.com");
      cancelOAuthFlow();
      await expect(flow).rejects.toThrow("OAuth flow cancelled by user");
    });
  });

  describe("onAuthDeepLink", () => {
    it("returns unsubscribe function", async () => {
      const { onAuthDeepLink } = await import("./auth");
      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);
      expect(typeof unsub).toBe("function");
      unsub();
    });

    it("unsubscribe is idempotent", async () => {
      const { onAuthDeepLink } = await import("./auth");
      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);
      unsub();
      unsub();
      expect(cb).not.toHaveBeenCalled();
    });

    it("notifies subscribers on deep link", async () => {
      setTauriContext();
      const { initializeNativeAuth, onAuthDeepLink } = await import("./auth");
      await initializeNativeAuth();

      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);

      deepLinkCallback!(["lumen://auth/callback?token=abc"]);
      expect(cb).toHaveBeenCalledWith("lumen://auth/callback?token=abc");
      unsub();
    });

    it("ignores non-auth deep links", async () => {
      setTauriContext();
      const { initializeNativeAuth, onAuthDeepLink } = await import("./auth");
      await initializeNativeAuth();

      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);

      deepLinkCallback!(["lumen://other/path"]);
      expect(cb).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe("initiateOAuthFlow", () => {
    it("throws in web context", async () => {
      setMockWindow({});
      const { initiateOAuthFlow } = await import("./auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });

    it("throws in SSR context", async () => {
      setMockWindow(undefined);
      const { initiateOAuthFlow } = await import("./auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });

    it("starts flow in Tauri context", async () => {
      setTauriContext();
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      const flow = initiateOAuthFlow("https://auth.example.com");
      expect(flow).toBeInstanceOf(Promise);
      cancelOAuthFlow();
      await expect(flow).rejects.toThrow();
    });

    it("resolves with URL params on callback", async () => {
      setTauriContext();
      const { initiateOAuthFlow, initializeNativeAuth } = await import(
        "./auth"
      );
      await initializeNativeAuth();

      const flow = initiateOAuthFlow("https://auth.example.com");
      deepLinkCallback!(["lumen://auth/callback?token=abc123&state=xyz"]);

      const params = await flow;
      expect(params.get("token")).toBe("abc123");
      expect(params.get("state")).toBe("xyz");
    });

    it("rejects on OAuth error callback", async () => {
      setTauriContext();
      const { initiateOAuthFlow, initializeNativeAuth } = await import(
        "./auth"
      );
      await initializeNativeAuth();

      const flow = initiateOAuthFlow("https://auth.example.com");
      deepLinkCallback!(["lumen://auth/callback?error=access_denied"]);

      await expect(flow).rejects.toThrow("OAuth error: access_denied");
    });
  });

  describe("initializeNativeAuth", () => {
    it("does nothing in web context", async () => {
      setMockWindow({});
      const { initializeNativeAuth } = await import("./auth");
      await initializeNativeAuth();
      expect(deepLinkCallback).toBeNull();
    });

    it("does nothing in SSR context", async () => {
      setMockWindow(undefined);
      const { initializeNativeAuth } = await import("./auth");
      await initializeNativeAuth();
      expect(deepLinkCallback).toBeNull();
    });

    it("registers deep link callback in Tauri context", async () => {
      setTauriContext();
      const { initializeNativeAuth } = await import("./auth");
      await initializeNativeAuth();
      expect(deepLinkCallback).not.toBeNull();
    });

    it("handles initial deep links", async () => {
      setTauriContext();
      initialUrls = ["lumen://auth/callback?initial=true"];
      const { initializeNativeAuth, onAuthDeepLink } = await import("./auth");

      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);

      await initializeNativeAuth();
      expect(cb).toHaveBeenCalledWith("lumen://auth/callback?initial=true");
      unsub();
    });
  });

  describe("openExternalBrowser", () => {
    it("calls window.open in web context", async () => {
      const openMock = mock(() => undefined);
      setMockWindow({ open: openMock });
      const { openExternalBrowser } = await import("./auth");
      await openExternalBrowser("https://example.com");
      expect(openMock).toHaveBeenCalledWith("https://example.com", "_blank");
    });

    it("uses Tauri shell in Tauri context", async () => {
      setTauriContext();
      const { openExternalBrowser } = await import("./auth");
      await openExternalBrowser("https://example.com");
    });

    it("throws and logs on Tauri shell error", async () => {
      setTauriContext();
      forceShellOpenError = true;
      const { openExternalBrowser } = await import("./auth");

      const consoleSpy = mock(() => undefined);
      const originalError = console.error;
      console.error = consoleSpy;

      await expect(openExternalBrowser("https://example.com")).rejects.toThrow(
        "shell open failed"
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NativeAuth] Failed to open external browser:",
        expect.any(Error)
      );

      console.error = originalError;
    });

    it("throws in SSR", async () => {
      setMockWindow(undefined);
      const { openExternalBrowser } = await import("./auth");
      await expect(
        openExternalBrowser("https://example.com")
      ).rejects.toThrow();
    });
  });

  describe("error handling and edge cases", () => {
    it("initializeNativeAuth logs error when deep link init fails", async () => {
      setTauriContext();
      forceDeepLinkError = true;
      const { initializeNativeAuth } = await import("./auth");

      const consoleSpy = mock(() => undefined);
      const originalError = console.error;
      console.error = consoleSpy;

      await initializeNativeAuth();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[NativeAuth] Failed to initialize deep link listener:",
        expect.any(Error)
      );

      console.error = originalError;
    });

    it("initializeNativeAuth survives when getCurrent fails", async () => {
      setTauriContext();
      forceGetCurrentError = true;
      const { initializeNativeAuth } = await import("./auth");

      // Should not throw, should silently ignore the getCurrent error
      await expect(initializeNativeAuth()).resolves.toBeUndefined();
    });

    it("deep link callback swallows subscriber errors", async () => {
      setTauriContext();
      const { initializeNativeAuth, onAuthDeepLink } = await import("./auth");
      await initializeNativeAuth();

      const consoleSpy = mock(() => undefined);
      const originalError = console.error;
      console.error = consoleSpy;

      const failingCb = () => {
        throw new Error("subscriber error");
      };
      const unsub = onAuthDeepLink(failingCb);

      deepLinkCallback!(["lumen://auth/callback?token=123"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[NativeAuth] Error in deep link callback:",
        expect.any(Error)
      );

      console.error = originalError;
      unsub();
    });

    it("initiateOAuthFlow rejects on malformed callback URL", async () => {
      setTauriContext();
      const { initiateOAuthFlow, initializeNativeAuth, cancelOAuthFlow } =
        await import("./auth");
      await initializeNativeAuth();
      cancelOAuthFlow(); // ensure clean state

      const flow = initiateOAuthFlow("https://auth.example.com");

      const originalURL = globalThis.URL;
      try {
        globalThis.URL = class {
          constructor() {
            throw new Error("mock URL error");
          }
        } as any;

        deepLinkCallback!(["lumen://auth/callback"]);

        await expect(flow).rejects.toThrow("mock URL error");
      } finally {
        globalThis.URL = originalURL;
      }
    });

    it("initiateOAuthFlow times out", async () => {
      setTauriContext();
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      cancelOAuthFlow(); // ensure clean state

      const originalSetTimeout = globalThis.setTimeout;
      let capturedCb: (() => void) | null = null;
      try {
        globalThis.setTimeout = ((cb: () => void) => {
          capturedCb = cb;
          return 123;
        }) as any;

        const flow = initiateOAuthFlow("https://auth.example.com");
        if (capturedCb) {
          (capturedCb as () => void)();
          // trigger synchronously
        }
        await expect(flow).rejects.toThrow("OAuth flow timed out");
      } finally {
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it("initiateOAuthFlow rejects when openExternalBrowser fails", async () => {
      setTauriContext();
      forceShellOpenError = true;
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      cancelOAuthFlow(); // ensure clean state

      const consoleSpy = mock(() => undefined);
      const originalError = console.error;
      console.error = consoleSpy;

      const flow = initiateOAuthFlow("https://auth.example.com");
      await expect(flow).rejects.toThrow("shell open failed");

      console.error = originalError;
    });

    it("cancelling an already active flow correctly rejects it before starting new one", async () => {
      setTauriContext();
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      cancelOAuthFlow(); // ensure clean state

      // First flow
      const flow1 = initiateOAuthFlow("https://auth.example.com/1");

      // We must attach catch to flow1 BEFORE starting flow2 to prevent unhandled rejection
      let flow1Error: Error | undefined;
      const catchPromise = flow1.catch((e) => {
        flow1Error = e;
      });

      // Second flow immediately cancels first
      const flow2 = initiateOAuthFlow("https://auth.example.com/2");

      await catchPromise;
      expect(flow1Error?.message).toBe(
        "OAuth flow cancelled - new flow started"
      );

      cancelOAuthFlow();
      await expect(flow2).rejects.toThrow("OAuth flow cancelled by user");
    });
  });
});
