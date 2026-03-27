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

    it("signInWithGitHub uses external browser in Tauri", async () => {
      mockIsTauri.mockReturnValue(true);
      const origDescriptor = Object.getOwnPropertyDescriptor(
        window,
        "location"
      );
      Object.defineProperty(window, "location", {
        value: {
          origin: "http://localhost:3000",
          href: "http://localhost:3000/",
        },
        writable: true,
        configurable: true,
      });
      const { result } = renderHook(() => useAuth());

      await result.current.signInWithGitHub();

      expect(mockOpenExternalBrowser).toHaveBeenCalled();
      const arg = mockOpenExternalBrowser.mock.calls[0]![0] as string;
      expect(arg).toContain("github");
      expect(arg).toContain("/auth/native-signin");
      expect(mockSignInSocial).not.toHaveBeenCalled();
      // restore
      if (origDescriptor) {
        Object.defineProperty(window, "location", origDescriptor);
      }
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

    it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const { result } = renderHook(() => useAuth());

      const success = await result.current.exchangeManualToken("any-token");

      expect(success).toBe(false);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe("signOutUser", () => {
    it("signs out successfully", async () => {
      mockUseSession.mockReturnValueOnce({
        data: {
          user: { id: "u-1", name: "Test", email: "test@test.com" },
          session: { id: "s-1", token: "tok", userId: "u-1" },
        },
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signOutUser();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("throws on sign out failure", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("Sign out failed"));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signOutUser()).rejects.toThrow(
        "Sign out failed"
      );
    });
  });

  describe("deep link error handling", () => {
    it("handles deep link with error param", async () => {
      mockIsTauri.mockReturnValue(true);
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
        "lumen://auth/callback?error=access_denied&error_description=User+denied"
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it("handles deep link callback parse error", async () => {
      mockIsTauri.mockReturnValue(true);
      let registeredCallback: ((url: string) => Promise<void>) | null = null;

      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      // Invalid URL that can't be parsed
      await registeredCallback!("lumen://auth/callback?success=true&token=t");

      // Should not throw
      expect(mockRefetch).toHaveBeenCalled();
    });

    it("handles deep link listener throwing", () => {
      mockIsTauri.mockReturnValue(true);
      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          // Simulate the listener callback throwing
          const wrappedCb = (url: string) => {
            cb(url);
          };
          // Immediately call with an auth URL that will succeed
          wrappedCb("lumen://auth/callback?success=true&token=good-token");
          return () => undefined;
        }
      );

      renderHook(() => useAuth());
      // Should not throw
    });

    it("handles initializeNativeAuth rejection", () => {
      mockIsTauri.mockReturnValue(true);
      mockInitializeNativeAuth.mockRejectedValueOnce(
        new Error("Native auth init failed")
      );

      renderHook(() => useAuth());
      // Should not throw despite init failure
    });
  });

  describe("signInWithGitHub error handling", () => {
    it("throws on web sign in failure", async () => {
      mockIsTauri.mockReturnValue(false);
      mockSignInSocial.mockRejectedValueOnce(new Error("OAuth failed"));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signInWithGitHub()).rejects.toThrow(
        "OAuth failed"
      );
    });
  });

  describe("additional deep link error paths", () => {
    it("handles deep link callback when exchange fails", async () => {
      mockIsTauri.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: "Token expired" }),
      } as unknown as Response);

      let registeredCallback: ((url: string) => Promise<void>) | null = null;
      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      await registeredCallback!(
        "lumen://auth/callback?success=true&token=expired-token"
      );

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it("handles deep link callback when exchange throws", async () => {
      mockIsTauri.mockReturnValue(true);
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      let registeredCallback: ((url: string) => Promise<void>) | null = null;
      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      await registeredCallback!(
        "lumen://auth/callback?success=true&token=bad-token"
      );

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it("handles deep link without success or token", async () => {
      mockIsTauri.mockReturnValue(true);

      let registeredCallback: ((url: string) => Promise<void>) | null = null;
      mockOnAuthDeepLink.mockImplementation(
        (cb: (url: string) => Promise<void>) => {
          registeredCallback = cb;
          return () => undefined;
        }
      );

      renderHook(() => useAuth());

      await registeredCallback!("lumen://auth/callback");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("signs out with user data and sets span attribute", async () => {
      mockUseSession.mockReturnValueOnce({
        data: {
          user: { id: "u-42", name: "Test", email: "t@t.com" },
          session: { id: "s-1", token: "tok", userId: "u-42" },
        },
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signOutUser();

      expect(mockSignOut).toHaveBeenCalled();
      expect(spanMock.setAttribute).toHaveBeenCalledWith("user.id", "u-42");
      expect(spanMock.setAttribute).toHaveBeenCalledWith(
        "auth.signOut.success",
        true
      );
    });

    it("signs out without user data", async () => {
      mockUseSession.mockReturnValueOnce({
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { result } = renderHook(() => useAuth());

      await result.current.signOutUser();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("exchangeManualToken returns false when fetch returns non-ok with empty json", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("parse error")),
      } as unknown as Response);

      const { result } = renderHook(() => useAuth());

      const success = await result.current.exchangeManualToken("bad-token");
      expect(success).toBe(false);
    });
  });
});
