import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { PresenceUser } from "../types";

const mockGetCurrentUser = mock((): Promise<null> => Promise.resolve(null));
const mockSignInSocial = mock((): Promise<void> => Promise.resolve());
const mockSignOut = mock((): Promise<void> => Promise.resolve());
const mockUseSession = mock(() => ({
  data: null,
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: mock((): Promise<void> => Promise.resolve()),
}));

interface PresenceManagerOptions {
  onConnectionChange?: (isConnected: boolean) => void;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  token: string;
  userAvatar?: string;
  userId: string;
  userName: string;
  workspaceId: string;
}

interface MockPresenceManagerInstance {
  disconnect: ReturnType<typeof mock>;
  opts: PresenceManagerOptions;
}

const instances: MockPresenceManagerInstance[] = [];

const MockPresenceManagerCtor = mock((opts: PresenceManagerOptions) => {
  const instance: MockPresenceManagerInstance = {
    disconnect: mock(() => undefined),
    opts,
  };
  instances.push(instance);
  return instance;
});

mock.module("../presence-manager", () => ({
  PresenceManager: MockPresenceManagerCtor,
}));

const tokenResolvers: Array<(token: string | null) => void> = [];
const mockGetJwtToken = mock(
  () =>
    new Promise<string | null>((resolve) => {
      tokenResolvers.push(resolve);
    })
);

mock.module("@/src/lib/auth-client", () => ({
  getCurrentUser: mockGetCurrentUser,
  getJwtToken: mockGetJwtToken,
  signIn: { social: mockSignInSocial },
  signOut: mockSignOut,
  useSession: mockUseSession,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
    error: mock(() => undefined),
  }),
}));

const DEFAULT_PROPS = {
  userId: "user-1",
  userName: "Test User",
  userAvatar: "https://example.com/avatar.png",
  workspaceId: "ws-1",
  enabled: true,
};

function resolveNextToken(token: string | null) {
  const resolve = tokenResolvers.shift();
  if (!resolve) {
    throw new Error("No pending token resolver available");
  }
  resolve(token);
}

async function getUsePresence() {
  const mod = await import("./use-presence");
  return mod.usePresence;
}

describe("usePresence", () => {
  beforeEach(() => {
    tokenResolvers.length = 0;
    instances.length = 0;

    mockGetJwtToken.mockReset();
    mockGetCurrentUser.mockReset();
    mockSignInSocial.mockReset();
    mockSignOut.mockReset();
    mockUseSession.mockReset();
    mockGetJwtToken.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          tokenResolvers.push(resolve);
        })
    );
    mockGetCurrentUser.mockImplementation(() => Promise.resolve(null));
    mockSignInSocial.mockImplementation(() => Promise.resolve());
    mockSignOut.mockImplementation(() => Promise.resolve());
    mockUseSession.mockImplementation(() => ({
      data: null,
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: mock((): Promise<void> => Promise.resolve()),
    }));
    MockPresenceManagerCtor.mockClear();
  });

  afterEach(() => {
    tokenResolvers.length = 0;
    instances.length = 0;
  });

  it("returns a fallback currentUser and skips connection when disabled", async () => {
    const usePresence = await getUsePresence();
    const { result } = renderHook(() =>
      usePresence({
        ...DEFAULT_PROPS,
        enabled: false,
      })
    );

    expect(result.current.currentUser).toEqual({
      id: "user-1",
      name: "Test User",
      avatar: "https://example.com/avatar.png",
      status: "online",
      joinedAt: expect.any(Number),
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.users).toEqual([]);
    expect(mockGetJwtToken).not.toHaveBeenCalled();
    expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
  });

  it("skips connection when the workspaceId is missing", async () => {
    const usePresence = await getUsePresence();
    renderHook(() =>
      usePresence({
        ...DEFAULT_PROPS,
        workspaceId: "",
      })
    );

    expect(mockGetJwtToken).not.toHaveBeenCalled();
    expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
  });

  it("creates a PresenceManager after the JWT token resolves", async () => {
    const usePresence = await getUsePresence();
    renderHook(() => usePresence(DEFAULT_PROPS));

    expect(mockGetJwtToken).toHaveBeenCalledTimes(1);
    expect(MockPresenceManagerCtor).not.toHaveBeenCalled();

    act(() => {
      resolveNextToken("jwt-1");
    });

    await waitFor(() => {
      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
    });

    expect(instances[0]?.opts).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        userId: "user-1",
        userName: "Test User",
        userAvatar: "https://example.com/avatar.png",
        token: "jwt-1",
      })
    );
  });

  it("does not create a PresenceManager when the JWT token is null", async () => {
    const usePresence = await getUsePresence();
    renderHook(() => usePresence(DEFAULT_PROPS));

    await act(async () => {
      resolveNextToken(null);
      await Promise.resolve();
    });

    expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
  });

  it("updates users and connection state from PresenceManager callbacks", async () => {
    const usePresence = await getUsePresence();
    const { result } = renderHook(() => usePresence(DEFAULT_PROPS));

    act(() => {
      resolveNextToken("jwt-2");
    });

    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });

    const collaborator: PresenceUser = {
      id: "user-2",
      name: "Pair User",
      avatar: undefined,
      status: "online",
      joinedAt: 123,
    };

    act(() => {
      instances[0]?.opts.onPresenceUpdate([collaborator]);
      instances[0]?.opts.onConnectionChange?.(true);
    });

    expect(result.current.users).toEqual([collaborator]);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.currentUser).toEqual({
      id: "user-1",
      name: "Test User",
      avatar: "https://example.com/avatar.png",
      status: "online",
      joinedAt: expect.any(Number),
    });
  });

  it("disconnects the manager on unmount", async () => {
    const usePresence = await getUsePresence();
    const { unmount } = renderHook(() => usePresence(DEFAULT_PROPS));

    act(() => {
      resolveNextToken("jwt-3");
    });

    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });

    unmount();

    expect(instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects the previous manager and reconnects when the workspace changes", async () => {
    const usePresence = await getUsePresence();
    const { rerender } = renderHook(
      (props: typeof DEFAULT_PROPS) => usePresence(props),
      {
        initialProps: DEFAULT_PROPS,
      }
    );

    act(() => {
      resolveNextToken("jwt-4");
    });

    await waitFor(() => {
      expect(instances).toHaveLength(1);
    });

    const firstInstance = instances[0];

    rerender({
      ...DEFAULT_PROPS,
      workspaceId: "ws-2",
    });

    expect(firstInstance?.disconnect).toHaveBeenCalledTimes(1);

    act(() => {
      resolveNextToken("jwt-5");
    });

    await waitFor(() => {
      expect(instances).toHaveLength(2);
    });

    expect(instances[1]?.opts.workspaceId).toBe("ws-2");
  });
});
