import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

// -- Mock setup --

const mockRefetch = mock(() => Promise.resolve({ data: null } as never));
const mockUseSession = mock(() => ({
  data: null as any,
  isPending: false,
  error: null as Error | null,
  refetch: mockRefetch,
}));

const mockSignInSocial = mock((_opts: any) => Promise.resolve());
const mockSignOut = mock(() => Promise.resolve());

mock.module("@/src/lib/auth-client", () => ({
  signIn: { social: mockSignInSocial },
  signOut: mockSignOut,
  useSession: mockUseSession,
}));

const mockIsTauri = mock(() => false);
const mockInitializeNativeAuth = mock(() => Promise.resolve());
const mockOnAuthDeepLink = mock((_cb: any) => () => undefined);
const mockOpenExternalBrowser = mock((_url: string) => Promise.resolve());

mock.module("@lumen/native-bridge", () => ({
  isTauri: mockIsTauri,
  initializeNativeAuth: mockInitializeNativeAuth,
  onAuthDeepLink: mockOnAuthDeepLink,
  openExternalBrowser: mockOpenExternalBrowser,
}));

const mockRecordError = mock(() => undefined);
const mockWithSpanAsync = mock(<T>(_name: string, fn: () => Promise<T>) =>
  fn()
);

mock.module("@lumen/logger/tracer", () => ({
  recordError: mockRecordError,
  withSpanAsync: mockWithSpanAsync,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

const originalFetch = globalThis.fetch;
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ user: { id: "u-1" } }),
  } as any)
);
globalThis.fetch = mockFetch as unknown as typeof fetch;

import { useAuth } from "./use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockSignInSocial.mockClear();
    mockSignOut.mockClear();
    mockIsTauri.mockClear();
    mockInitializeNativeAuth.mockClear();
    mockOnAuthDeepLink.mockClear();
    mockOpenExternalBrowser.mockClear();
    mockRecordError.mockClear();
    mockFetch.mockClear();

    mockIsTauri.mockReturnValue(false);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: "u-1" } }),
    } as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Native specific behaviors", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it("initializes native auth and handles deep links on mount", () => {
      renderHook(() => useAuth());

      expect(mockInitializeNativeAuth).toHaveBeenCalled();
      expect(mockOnAuthDeepLink).toHaveBeenCalled();
    });

    it("processes valid native auth deep links and refetches session", async () => {
      let registeredCallback: ((url: string) => Promise<void>) | null = null;

      mockOnAuthDeepLink.mockImplementation((cb: any) => {
        registeredCallback = cb;
        return () => undefined;
      });

      renderHook(() => useAuth());

      expect(registeredCallback).not.toBeNull();

      if (registeredCallback) {
        await (registeredCallback as any)(
          "lumen://auth/callback?token=valid-token"
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/auth/exchange",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "valid-token" }),
          })
        );

        expect(mockRefetch).toHaveBeenCalled();
      }
    });

    it("ignores non-auth deep links without throwing", async () => {
      let registeredCallback: ((url: string) => Promise<void>) | null = null;

      mockOnAuthDeepLink.mockImplementation((cb: any) => {
        registeredCallback = cb;
        return () => undefined;
      });

      renderHook(() => useAuth());

      if (registeredCallback) {
        await (registeredCallback as any)("lumen://some/other/path");
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockRefetch).not.toHaveBeenCalled();
      }
    });

    it("signInWithGitHub uses external browser in Tauri", async () => {
      const { result } = renderHook(() => useAuth());

      await result.current.signInWithGitHub();

      expect(mockOpenExternalBrowser).toHaveBeenCalled();
      const arg = mockOpenExternalBrowser.mock.calls[0]![0] as string;
      expect(arg).toContain("github");
      expect(mockSignInSocial).not.toHaveBeenCalled();
    });
  });

  describe("Web specific behaviors", () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(false);
    });

    it("does not initialize native auth on mount", () => {
      renderHook(() => useAuth());

      expect(mockInitializeNativeAuth).not.toHaveBeenCalled();
      expect(mockOnAuthDeepLink).not.toHaveBeenCalled();
    });

    it("signInWithGitHub uses auth-client in web", async () => {
      const { result } = renderHook(() => useAuth());

      await result.current.signInWithGitHub();

      expect(mockSignInSocial).toHaveBeenCalled();
      const arg = mockSignInSocial.mock.calls[0]![0] as any;
      expect(arg.provider).toBe("github");
      expect(arg.callbackURL).toContain("/auth/callback");
    });
  });

  describe("exchangeManualToken", () => {
    it("returns true and refetches on success", async () => {
      const { result } = renderHook(() => useAuth());

      const success = await result.current.exchangeManualToken("good-token");

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockRefetch).toHaveBeenCalled();
    });

    it("returns false on failure without crashing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Invalid token" }),
      } as any);

      const { result } = renderHook(() => useAuth());

      const success = await result.current.exchangeManualToken("bad-token");

      expect(success).toBe(false);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });
});
