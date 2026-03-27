import { describe, expect, it, mock } from "bun:test";

const originalWindow = globalThis.window;

function setMockWindow(win: object | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

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
      globalThis.window = originalWindow;
    });

    it("returns true in Tauri context", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { shouldUseNativeAuth } = await import("./auth");
      expect(shouldUseNativeAuth()).toBe(true);
      globalThis.window = originalWindow;
    });
  });

  describe("cancelOAuthFlow", () => {
    it("does nothing when no flow active", async () => {
      const { cancelOAuthFlow } = await import("./auth");
      expect(() => cancelOAuthFlow()).not.toThrow();
    });

    it("cancels active flow", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { initiateOAuthFlow, cancelOAuthFlow } = await import("./auth");
      const flow = initiateOAuthFlow("https://auth.example.com");
      cancelOAuthFlow();
      await expect(flow).rejects.toThrow("OAuth flow cancelled by user");
      globalThis.window = originalWindow;
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
  });

  describe("initiateOAuthFlow", () => {
    it("throws in web context", async () => {
      setMockWindow({});
      const { initiateOAuthFlow } = await import("./auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
      globalThis.window = originalWindow;
    });

    it("throws in SSR context", async () => {
      setMockWindow(undefined);
      const { initiateOAuthFlow } = await import("./auth");
      expect(() => initiateOAuthFlow("https://auth.example.com")).toThrow(
        "Native OAuth flow is only available in Tauri"
      );
      globalThis.window = originalWindow;
    });

    it("cancels first flow when second starts", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { initiateOAuthFlow } = await import("./auth");
      const flow1 = initiateOAuthFlow("https://auth1.example.com");
      const flow2 = initiateOAuthFlow("https://auth2.example.com");
      await expect(flow1).rejects.toThrow(
        "OAuth flow cancelled - new flow started"
      );
      await expect(flow2).rejects.toThrow();
      globalThis.window = originalWindow;
    });
  });

  describe("openExternalBrowser", () => {
    it("calls window.open in web context", async () => {
      const openMock = mock(() => undefined);
      setMockWindow({ open: openMock });
      const { openExternalBrowser } = await import("./auth");
      await openExternalBrowser("https://example.com");
      expect(openMock).toHaveBeenCalledWith("https://example.com", "_blank");
      globalThis.window = originalWindow;
    });
  });
});
