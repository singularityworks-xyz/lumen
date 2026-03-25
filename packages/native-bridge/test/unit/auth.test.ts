import { afterEach, describe, expect, it, mock } from "bun:test";

const originalWindow = globalThis.window;

function setWebContext() {
  (globalThis as any).window = {};
  (globalThis.window as any).__TAURI_INTERNALS__ = undefined;
}

function setTauriContext() {
  (globalThis as any).window = { __TAURI_INTERNALS__: {} };
}

function callbackFn() {
  return undefined;
}

afterEach(() => {
  if (originalWindow === undefined) {
    (globalThis as any).window = undefined;
  } else {
    globalThis.window = originalWindow;
  }
});

describe("auth", () => {
  describe("initiateOAuthFlow", () => {
    it("throws synchronously in web context", async () => {
      setWebContext();
      const { initiateOAuthFlow } = await import("../../auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });

    it("throws synchronously in SSR context", async () => {
      (globalThis as any).window = undefined;
      const { initiateOAuthFlow } = await import("../../auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });
  });

  describe("cancelOAuthFlow", () => {
    it("does nothing when no flow is active", async () => {
      setWebContext();
      const { cancelOAuthFlow } = await import("../../auth");
      expect(() => cancelOAuthFlow()).not.toThrow();
    });
  });

  describe("getOAuthCallbackUrl", () => {
    it("returns correct deep-link scheme URL", async () => {
      setWebContext();
      const { getOAuthCallbackUrl } = await import("../../auth");
      expect(getOAuthCallbackUrl()).toBe("lumen://auth/callback");
    });
  });

  describe("shouldUseNativeAuth", () => {
    it("returns false in web context", async () => {
      setWebContext();
      const { shouldUseNativeAuth } = await import("../../auth");
      expect(shouldUseNativeAuth()).toBe(false);
    });

    it("returns true in Tauri context", async () => {
      setTauriContext();
      const { shouldUseNativeAuth } = await import("../../auth");
      expect(shouldUseNativeAuth()).toBe(true);
    });
  });

  describe("onAuthDeepLink", () => {
    it("subscribe returns an unsubscribe function", async () => {
      setWebContext();
      const { onAuthDeepLink } = await import("../../auth");
      const cb = mock(callbackFn);
      const unsub = onAuthDeepLink(cb);
      expect(typeof unsub).toBe("function");
      unsub();
    });

    it("unsubscribe removes the callback", async () => {
      setWebContext();
      const { onAuthDeepLink } = await import("../../auth");
      const cb = mock(callbackFn);
      const unsub = onAuthDeepLink(cb);
      unsub();
      unsub();
      expect(cb).not.toHaveBeenCalled();
    });

    it("multiple subscribers can register and unregister independently", async () => {
      setWebContext();
      const { onAuthDeepLink } = await import("../../auth");
      const cb1 = mock(callbackFn);
      const cb2 = mock(callbackFn);
      const unsub1 = onAuthDeepLink(cb1);
      const unsub2 = onAuthDeepLink(cb2);
      unsub1();
      unsub2();
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe("openExternalBrowser", () => {
    it("calls window.open in web context", async () => {
      const openMock = mock(callbackFn);
      (globalThis as any).window = { open: openMock };
      const { openExternalBrowser } = await import("../../auth");
      await openExternalBrowser("https://example.com");
      expect(openMock).toHaveBeenCalledWith("https://example.com", "_blank");
    });
  });

  describe("second flow cancels first", () => {
    it("first flow promise rejects when second flow starts", async () => {
      setTauriContext();
      const { initiateOAuthFlow } = await import("../../auth");
      const flow1 = initiateOAuthFlow("https://auth1.example.com");
      const flow2 = initiateOAuthFlow("https://auth2.example.com");
      await expect(flow1).rejects.toThrow(
        "OAuth flow cancelled - new flow started"
      );
      flow2.catch(callbackFn);
    });
  });
});
