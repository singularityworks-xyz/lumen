import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

type SignInSocialOptions = Parameters<
  typeof import("@/src/lib/auth-client").signIn.social
>[0];

type UseSessionReturn = ReturnType<
  typeof import("@/src/lib/auth-client").useSession
>;

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

const loggerMock = {
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
  debug: mock(() => undefined),
};

const mockRefetch = mock((): Promise<void> => Promise.resolve());
const mockUseSession = mock(
  (): UseSessionReturn => ({
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  })
);
const mockSignInSocial = mock(
  (_options: SignInSocialOptions): Promise<void> => Promise.resolve()
);
const mockSignOut = mock((): Promise<void> => Promise.resolve());
const mockGetCurrentUser = mock((): Promise<null> => Promise.resolve(null));
const mockGetJwtToken = mock((): Promise<null> => Promise.resolve(null));

mock.module("@/src/lib/auth-client", () => ({
  getCurrentUser: mockGetCurrentUser,
  getJwtToken: mockGetJwtToken,
  signIn: { social: mockSignInSocial },
  signOut: mockSignOut,
  useSession: mockUseSession,
}));

mock.module("../env", () => ({
  env: { NEXT_PUBLIC_API_URL: "http://localhost:3002" },
}));

let registeredDeepLinkCallback: ((url: string) => Promise<void>) | null = null;

const mockIsTauri = mock(() => false);
const mockInitializeNativeAuth = mock((): Promise<void> => Promise.resolve());
const mockOnAuthDeepLink = mock((callback: (url: string) => Promise<void>) => {
  registeredDeepLinkCallback = callback;
  return () => undefined;
});
const mockOpenExternalBrowser = mock(
  (_url: string): Promise<void> => Promise.resolve()
);

mock.module("@lumen/native-bridge", () => ({
  isTauri: mockIsTauri,
  initializeNativeAuth: mockInitializeNativeAuth,
  onAuthDeepLink: mockOnAuthDeepLink,
  openExternalBrowser: mockOpenExternalBrowser,
}));

const mockRecordError = mock(() => undefined);
const mockWithSpanAsync = mock(
  <T>(_: string, fn: (span: SpanMock) => Promise<T>) => fn(spanMock)
);

mock.module("@lumen/logger/tracer", () => ({
  recordError: mockRecordError,
  withSpanAsync: mockWithSpanAsync,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => loggerMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const originalFetch = globalThis.fetch;
const mockFetch = mock(
  (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
    Promise.resolve(jsonResponse({ user: { id: "u-1" } }))
);

const originalLocationDescriptor =
  typeof window === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(window, "location");

function setWindowLocation(url: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url) as unknown as Location,
  });
}

async function getUseAuth() {
  const mod = await import("./use-auth");
  return mod.useAuth;
}

describe("useAuth", () => {
  beforeEach(() => {
    registeredDeepLinkCallback = null;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    mockRefetch.mockReset();
    mockUseSession.mockReset();
    mockSignInSocial.mockReset();
    mockSignOut.mockReset();
    mockGetCurrentUser.mockReset();
    mockGetJwtToken.mockReset();
    mockIsTauri.mockReset();
    mockInitializeNativeAuth.mockReset();
    mockOnAuthDeepLink.mockReset();
    mockOpenExternalBrowser.mockReset();
    mockRecordError.mockReset();
    mockWithSpanAsync.mockReset();
    mockFetch.mockReset();

    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();

    for (const fn of Object.values(spanMock)) {
      (fn as ReturnType<typeof mock>).mockReset?.();
    }

    mockRefetch.mockImplementation(() => Promise.resolve());
    mockUseSession.mockImplementation(
      (): UseSessionReturn => ({
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      })
    );
    mockSignInSocial.mockImplementation(
      (_options: SignInSocialOptions): Promise<void> => Promise.resolve()
    );
    mockSignOut.mockImplementation((): Promise<void> => Promise.resolve());
    mockGetCurrentUser.mockImplementation(() => Promise.resolve(null));
    mockGetJwtToken.mockImplementation(() => Promise.resolve(null));
    mockIsTauri.mockReturnValue(false);
    mockInitializeNativeAuth.mockImplementation(() => Promise.resolve());
    mockOnAuthDeepLink.mockImplementation(
      (callback: (url: string) => Promise<void>) => {
        registeredDeepLinkCallback = callback;
        return () => undefined;
      }
    );
    mockOpenExternalBrowser.mockImplementation(
      (_url: string): Promise<void> => Promise.resolve()
    );
    mockRecordError.mockImplementation(() => undefined);
    mockWithSpanAsync.mockImplementation(
      <T>(_: string, fn: (span: SpanMock) => Promise<T>) => fn(spanMock)
    );
    mockFetch.mockImplementation(
      (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(jsonResponse({ user: { id: "u-1" } }))
    );

    setWindowLocation("http://localhost:3000/");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;

    if (originalLocationDescriptor && typeof window !== "undefined") {
      Object.defineProperty(window, "location", originalLocationDescriptor);
    }
  });

  it("initializes native auth and registers the deep-link listener in Tauri", async () => {
    mockIsTauri.mockReturnValue(true);

    const useAuth = await getUseAuth();
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(mockInitializeNativeAuth).toHaveBeenCalledTimes(1);
      expect(mockOnAuthDeepLink).toHaveBeenCalledTimes(1);
    });
    expect(registeredDeepLinkCallback).not.toBeNull();
  });

  it("exchanges a successful native deep link token and refetches the session", async () => {
    mockIsTauri.mockReturnValue(true);

    const useAuth = await getUseAuth();
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(registeredDeepLinkCallback).not.toBeNull();
    });

    await act(async () => {
      await registeredDeepLinkCallback?.(
        "lumen://auth/callback?success=true&token=valid-token"
      );
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3002/api/auth/native/exchange-token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "valid-token" }),
        })
      );
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it("records deep-link auth errors without trying a token exchange", async () => {
    mockIsTauri.mockReturnValue(true);

    const useAuth = await getUseAuth();
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(registeredDeepLinkCallback).not.toBeNull();
    });

    await act(async () => {
      await registeredDeepLinkCallback?.(
        "lumen://auth/callback?error=access_denied&error_description=cancelled"
      );
    });

    expect(mockRecordError).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("uses the external browser for native GitHub sign-in", async () => {
    mockIsTauri.mockReturnValue(true);

    const useAuth = await getUseAuth();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGitHub();
    });

    expect(mockOpenExternalBrowser).toHaveBeenCalledTimes(1);
    expect(mockOpenExternalBrowser.mock.calls[0]?.[0]).toContain(
      "/auth/native-signin"
    );
    expect(mockOpenExternalBrowser.mock.calls[0]?.[0]).toContain(
      "provider=github"
    );
    expect(mockOpenExternalBrowser.mock.calls[0]?.[0]).toContain(
      "callbackURL=%2Fauth%2Fnative-callback"
    );
    expect(mockSignInSocial).not.toHaveBeenCalled();
  });

  it("uses the web auth client with an absolute callback URL in the browser", async () => {
    const useAuth = await getUseAuth();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGitHub("/boards");
    });

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "http://localhost:3000/boards",
    });
    expect(mockOpenExternalBrowser).not.toHaveBeenCalled();
  });

  it("exchangeManualToken returns true and refetches on success", async () => {
    const useAuth = await getUseAuth();
    const { result } = renderHook(() => useAuth());

    let success = false;
    await act(async () => {
      success = await result.current.exchangeManualToken("manual-token");
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/auth/native/exchange-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "manual-token" }),
      })
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("exchangeManualToken returns false and does not refetch on failure", async () => {
    mockFetch.mockImplementationOnce(
      (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(jsonResponse({ message: "Invalid token" }, 401))
    );

    const useAuth = await getUseAuth();
    const { result } = renderHook(() => useAuth());

    let success = true;
    await act(async () => {
      success = await result.current.exchangeManualToken("expired-token");
    });

    expect(success).toBe(false);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("signOutUser delegates to the auth client signOut call", async () => {
    const useAuth = await getUseAuth();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOutUser();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
