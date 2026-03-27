import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  cancelOAuthFlow,
  getOAuthCallbackUrl,
  initiateOAuthFlow,
  onAuthDeepLink,
  openExternalBrowser,
  shouldUseNativeAuth,
} from "./auth";

interface MockWindow {
  __TAURI_INTERNALS__?: object | undefined;
  open?: (...args: unknown[]) => void;
}

const originalWindow = globalThis.window;

function setMockWindow(win: MockWindow | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

function setWebContext() {
  setMockWindow({});
}

function setTauriContext() {
  setMockWindow({ __TAURI_INTERNALS__: {} });
}

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("auth", () => {
  describe("initiateOAuthFlow", () => {
    it("throws synchronously in web context", () => {
      setWebContext();
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });

    it("throws synchronously in SSR context", () => {
      setMockWindow(undefined);
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
    });
  });

  describe("cancelOAuthFlow", () => {
    it("does nothing when no flow is active", () => {
      setWebContext();
      expect(() => cancelOAuthFlow()).not.toThrow();
    });
  });

  describe("getOAuthCallbackUrl", () => {
    it("returns correct deep-link scheme URL", () => {
      expect(getOAuthCallbackUrl()).toBe("lumen://auth/callback");
    });
  });

  describe("shouldUseNativeAuth", () => {
    it("returns false in web context", () => {
      setWebContext();
      expect(shouldUseNativeAuth()).toBe(false);
    });

    it("returns true in Tauri context", () => {
      setTauriContext();
      expect(shouldUseNativeAuth()).toBe(true);
    });

    it("returns false in SSR context", () => {
      setMockWindow(undefined);
      expect(shouldUseNativeAuth()).toBe(false);
    });
  });

  describe("onAuthDeepLink", () => {
    it("subscribe returns an unsubscribe function", () => {
      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);
      expect(typeof unsub).toBe("function");
      unsub();
    });

    it("unsubscribe removes the callback", () => {
      const cb = mock(() => undefined);
      const unsub = onAuthDeepLink(cb);
      unsub();
      unsub();
      expect(cb).not.toHaveBeenCalled();
    });

    it("multiple subscribers can register and unregister independently", () => {
      const cb1 = mock(() => undefined);
      const cb2 = mock(() => undefined);
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
      const openMock = mock(() => undefined);
      setMockWindow({ open: openMock });
      await openExternalBrowser("https://example.com");
      expect(openMock).toHaveBeenCalledWith("https://example.com", "_blank");
    });

    it("calls window.open in SSR context", async () => {
      setMockWindow(undefined);
      // In SSR, window is undefined so isTauri() returns false
      // The function should still attempt window.open which will throw
      await expect(
        openExternalBrowser("https://example.com")
      ).rejects.toThrow();
    });
  });

  describe("second flow cancels first", () => {
    it("first flow promise rejects when second flow starts", async () => {
      setTauriContext();
      const flow1 = initiateOAuthFlow("https://auth1.example.com");
      const flow2 = initiateOAuthFlow("https://auth2.example.com");
      await expect(flow1).rejects.toThrow(
        "OAuth flow cancelled - new flow started"
      );
      await expect(flow2).rejects.toThrow();
    });
  });
});
