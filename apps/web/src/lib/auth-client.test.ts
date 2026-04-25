import { afterEach, describe, expect, it, mock } from "bun:test";

const mockUseSession = mock(() => ({
  data: null,
  isPending: false,
  error: null,
  refetch: mock(() => Promise.resolve()),
}));
const mockGetSession = mock(() => Promise.resolve({ data: null, error: null }));
const mockToken = mock(() => Promise.resolve({ data: null, error: null }));
const mockCreateAuthClient = mock((options: unknown) => ({
  options,
  signIn: { social: mock(() => Promise.resolve()) },
  signOut: mock(() => Promise.resolve()),
  signUp: mock(() => Promise.resolve()),
  useSession: mockUseSession,
  getSession: mockGetSession,
  token: mockToken,
}));

mock.module("better-auth/react", () => ({
  createAuthClient: mockCreateAuthClient,
}));

mock.module("better-auth/client/plugins", () => ({
  jwtClient: mock(() => "jwt-plugin"),
}));

mock.module("../env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3002",
  },
}));

// Import the real url module so we can re-export everything from the mock.
// This prevents "export not found" errors in other test files that import
// from ./url after this mock is active.
import * as urlModule from "./url";

mock.module("./url", () => ({
  ...urlModule,
  normalizeApiUrlForCurrentHost: mock((url: string) => url),
}));

describe("auth-client", () => {
  afterEach(() => {
    mockCreateAuthClient.mockClear();
    mockUseSession.mockClear();
    mockGetSession.mockClear();
    mockToken.mockClear();
  });

  it("configures Better Auth session polling to stay disabled in the client", async () => {
    await import(`./auth-client?test=${Date.now()}`);

    expect(mockCreateAuthClient).toHaveBeenCalledTimes(1);
    const options = mockCreateAuthClient.mock.calls[0]?.[0] as {
      sessionOptions?: {
        refetchInterval?: number;
        refetchOnWindowFocus?: boolean;
        refetchWhenOffline?: boolean;
      };
    };

    expect(options.sessionOptions).toEqual({
      refetchInterval: 0,
      refetchOnWindowFocus: false,
      refetchWhenOffline: false,
    });
  });
});
