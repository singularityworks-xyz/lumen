import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { renderHook } from "@testing-library/react";

type SignInSocialOptions = Parameters<
  typeof import("@/src/lib/auth-client").signIn.social
>[0];

interface SpanMock {
  addEvent: (
    name: string,
    attrs?: Record<string, string | number | boolean>
  ) => void;
  end: () => void;
  recordException: (error: Error) => void;
  setAttribute: (key: string, value: string | number | boolean) => void;
  setAttributes: (attrs: Record<string, string | number | boolean>) => void;
  setStatus: (status: { code: number; message?: string }) => void;
}

const spanMock: SpanMock = {
  setAttribute: mock(),
  setAttributes: mock(),
  addEvent: mock(),
  recordException: mock(),
  setStatus: mock(),
  end: mock(),
};

const mockRefetch = mock((): Promise<void> => Promise.resolve());

type UseSessionReturn = ReturnType<
  typeof import("@/src/lib/auth-client").useSession
>;

const mockUseSession = mock(
  (): UseSessionReturn => ({
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  })
);

const mockSignInSocial = mock((_opts: SignInSocialOptions) =>
  Promise.resolve()
);
const mockSignOut = mock(() => Promise.resolve());

mock.module("@/src/lib/auth-client", () => ({
  signIn: { social: mockSignInSocial },
  signOut: mockSignOut,
  useSession: mockUseSession,
}));

const mockIsTauri = mock(() => false);
const mockInitializeNativeAuth = mock(() => Promise.resolve());
const mockOnAuthDeepLink = mock(
  (_cb: (url: string) => Promise<void>) => () => undefined
);
const mockOpenExternalBrowser = mock((_url: string) => Promise.resolve());

mock.module("@lumen/native-bridge", () => ({
  isTauri: mockIsTauri,
  initializeNativeAuth: mockInitializeNativeAuth,
  onAuthDeepLink: mockOnAuthDeepLink,
  openExternalBrowser: mockOpenExternalBrowser,
}));

const mockRecordError = mock(() => undefined);
const mockWithSpanAsync = mock(
  <T>(_name: string, fn: (span: SpanMock) => Promise<T>) => fn(spanMock)
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
const mockFetch = mock(
  (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: "u-1" } }),
    } as Response)
);

import { useAuth } from "./use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    mockRefetch.mockReset();
    mockSignInSocial.mockReset();
    mockSignOut.mockReset();
    mockIsTauri.mockReset();
    mockInitializeNativeAuth.mockReset();
    mockOnAuthDeepLink.mockReset();
    mockOpenExternalBrowser.mockReset();
    mockRecordError.mockReset();
    mockFetch.mockReset();
    for (const fn of Object.values(spanMock)) {
      (fn as ReturnType<typeof mock>).mockReset?.();
    }

    mockRefetch.mockImplementation(() => Promise.resolve());
    mockSignInSocial.mockImplementation((_opts: SignInSocialOptions) =>
      Promise.resolve()
    );
    mockSignOut.mockImplementation(() => Promise.resolve());
    mockIsTauri.mockReturnValue(false);
    mockInitializeNativeAuth.mockImplementation(() => Promise.resolve());
    mockOnAuthDeepLink.mockImplementation(
      (_cb: (url: string) => Promise<void>) => () => undefined
    );
    mockOpenExternalBrowser.mockImplementation((_url: string) =>
      Promise.resolve()
    );
    mockRecordError.mockImplementation(() => undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: "u-1" } }),
    } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
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

      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      expect(registeredCallback).not.toBeNull();

      await registeredCallback!(
        "lumen://auth/callback?success=true&token=valid-token"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/native/exchange-token"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "valid-token" }),
        })
      );

      expect(mockRefetch).toHaveBeenCalled();
    });

    it("ignores non-auth deep links without throwing", async () => {
      let registeredCallback: ((url: string) => Promise<void>) | null = null;

      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      expect(registeredCallback).not.toBeNull();

      await registeredCallback!("lumen://some/other/path");
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it.skip("signInWithGitHub uses external browser in Tauri", async () => {
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
      const arg = mockSignInSocial.mock.calls[0]![0] as SignInSocialOptions;
      expect(arg.provider).toBe("github");
      expect(arg.callbackURL).toBeTruthy();
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
      } as unknown as Response);

      const { result } = renderHook(() => useAuth());

      const success = await result.current.exchangeManualToken("bad-token");

      expect(success).toBe(false);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });
});
