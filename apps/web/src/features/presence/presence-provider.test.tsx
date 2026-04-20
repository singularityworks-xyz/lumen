import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore - already registered */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { PresenceProvider, usePresenceContext } from "./presence-provider";
import type { PresenceUser } from "./types";

// ── Mock PresenceManager ────────────────────────────────────────────────────

interface MockPresenceManagerInstance {
  disconnect: ReturnType<typeof mock>;
  opts: unknown;
}

const instances: MockPresenceManagerInstance[] = [];
const disconnectCalls: MockPresenceManagerInstance[] = [];

const MockPresenceManagerCtor = mock((opts: unknown) => {
  const instance: MockPresenceManagerInstance = {
    disconnect: mock(() => {
      disconnectCalls.push(instance);
    }),
    opts,
  };
  instances.push(instance);
  return instance;
});

mock.module("./presence-manager", () => ({
  PresenceManager: MockPresenceManagerCtor,
}));

// ── Mock getJwtToken ────────────────────────────────────────────────────────

let jwtTokenResolver: ((token: string | null) => void) | null = null;

const mockGetJwtToken = mock(
  () =>
    new Promise<string | null>((resolve) => {
      jwtTokenResolver = resolve;
    })
);

mock.module("@/src/lib/auth-client", () => ({
  getJwtToken: mockGetJwtToken,
}));

// ── Mock logger ─────────────────────────────────────────────────────────────

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    debug: mock(),
    error: mock(),
  }),
}));

// ── Test helpers ────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  userId: "user-1",
  userName: "Test User",
  userAvatar: "https://example.com/avatar.png",
  workspaceId: "ws-1",
  enabled: true,
};

function TestConsumer() {
  const ctx = usePresenceContext();
  return createElement(
    "div",
    {
      "data-testid": "users-container",
      "data-users": JSON.stringify(ctx.users.map((u: PresenceUser) => u.id)),
    },
    createElement(
      "span",
      { "data-testid": "is-connected" },
      String(ctx.isConnected)
    ),
    createElement(
      "span",
      { "data-testid": "current-user" },
      ctx.currentUser?.id ?? "null"
    ),
    createElement(
      "span",
      { "data-testid": "user-count" },
      String(ctx.users.length)
    )
  );
}

function renderProvider(
  props: Partial<typeof DEFAULT_PROPS> & { children?: ReactNode } = {}
) {
  const allProps = { ...DEFAULT_PROPS, children: undefined, ...props };
  return render(
    createElement(
      PresenceProvider,
      allProps,
      allProps.children ?? createElement(TestConsumer)
    )
  );
}

function getManagerOpts(instance: MockPresenceManagerInstance) {
  return instance.opts as Record<string, unknown>;
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

describe("PresenceProvider", () => {
  beforeEach(() => {
    mockGetJwtToken.mockReset();
    mockGetJwtToken.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          jwtTokenResolver = resolve;
        })
    );
    MockPresenceManagerCtor.mockClear();
    instances.length = 0;
    disconnectCalls.length = 0;
    jwtTokenResolver = null;
  });

  afterEach(() => {
    jwtTokenResolver = null;
    instances.length = 0;
    disconnectCalls.length = 0;
  });

  // ── 1. Provider enable/disable: enabled=false ────────────────────────────

  describe("when enabled=false", () => {
    it("should NOT create PresenceManager", async () => {
      renderProvider({ enabled: false });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("should NOT call getJwtToken", async () => {
      renderProvider({ enabled: false });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(mockGetJwtToken).not.toHaveBeenCalled();
    });

    it("should still render children with default context values", () => {
      renderProvider({ enabled: false });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });
  });

  // ── 2. Provider enable/disable: missing workspaceId ──────────────────────

  describe("when workspaceId is missing", () => {
    it("should NOT create PresenceManager", async () => {
      renderProvider({ workspaceId: "" });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("should NOT call getJwtToken", async () => {
      renderProvider({ workspaceId: "" });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(mockGetJwtToken).not.toHaveBeenCalled();
    });
  });

  // ── 3. Provider enable/disable: missing userId ───────────────────────────

  describe("when userId is missing", () => {
    it("should NOT create PresenceManager", async () => {
      renderProvider({ userId: "" });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("should NOT call getJwtToken", async () => {
      renderProvider({ userId: "" });

      await act(async () => {
        await flushMicrotasks();
      });

      expect(mockGetJwtToken).not.toHaveBeenCalled();
    });
  });

  // ── 4. Delayed JWT acquisition ───────────────────────────────────────────

  describe("delayed JWT acquisition", () => {
    it("should wait for getJwtToken before creating PresenceManager", async () => {
      renderProvider();

      expect(mockGetJwtToken).toHaveBeenCalledTimes(1);
      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
      expect(instances.length).toBe(1);
      const opts = getManagerOpts(instances[0]!);
      expect(opts.workspaceId).toBe("ws-1");
      expect(opts.userId).toBe("user-1");
      expect(opts.token).toBe("jwt-token-123");
      expect(opts.userName).toBe("Test User");
      expect(opts.userAvatar).toBe("https://example.com/avatar.png");
    });

    it("should skip creating PresenceManager if cancelled before JWT resolves", async () => {
      const { unmount } = renderProvider();

      expect(mockGetJwtToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        unmount();
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("should skip creating PresenceManager if getJwtToken returns null", async () => {
      renderProvider();

      expect(mockGetJwtToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        jwtTokenResolver?.(null);
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("should pass onPresenceUpdate and onConnectionChange callbacks", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      expect(typeof opts.onPresenceUpdate).toBe("function");
      expect(typeof opts.onConnectionChange).toBe("function");
    });
  });

  // ── 5. Disconnect on unmount ─────────────────────────────────────────────

  describe("disconnect on unmount", () => {
    it("should call manager.disconnect() on unmount", async () => {
      const { unmount } = renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
      expect(instances.length).toBe(1);
      const managerInstance = instances[0]!;

      act(() => {
        unmount();
      });

      expect(disconnectCalls).toContain(managerInstance);
    });

    it("should not crash when unmounting before manager is created", () => {
      const { unmount } = renderProvider();

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  // ── 6. Current-user derivation ───────────────────────────────────────────

  describe("current-user derivation", () => {
    it("should find user from users list matching userId", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;

      const otherUser: PresenceUser = {
        id: "user-2",
        name: "Other User",
        avatar: "https://example.com/other.png",
        status: "online",
        joinedAt: 1000,
      };

      const currentUserData: PresenceUser = {
        id: "user-1",
        name: "Test User",
        avatar: "https://example.com/avatar.png",
        status: "online",
        joinedAt: 2000,
      };

      act(() => {
        onPresenceUpdate([otherUser, currentUserData]);
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
      const container = screen.getByTestId("users-container");
      const usersAttr = container.getAttribute("data-users");
      expect(usersAttr).toContain("user-1");
      expect(usersAttr).toContain("user-2");
    });

    it("should create fallback user when userId not in users list", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;

      const otherUser: PresenceUser = {
        id: "user-2",
        name: "Other User",
        avatar: "https://example.com/other.png",
        status: "idle",
        joinedAt: 1000,
      };

      act(() => {
        onPresenceUpdate([otherUser]);
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });

    it("should show fallback currentUser when users list is empty", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });
  });

  // ── 7. Context value ─────────────────────────────────────────────────────

  describe("context value", () => {
    it("should provide users, isConnected, currentUser through context", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(screen.getByTestId("current-user").textContent).toBe("user-1");

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;
      const onConnectionChange = opts.onConnectionChange as (
        connected: boolean
      ) => void;

      const user: PresenceUser = {
        id: "user-1",
        name: "Test User",
        status: "online",
        joinedAt: 1000,
      };

      act(() => {
        onConnectionChange(true);
        onPresenceUpdate([user]);
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("true");
      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });

    it("should update isConnected when connection changes", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onConnectionChange = opts.onConnectionChange as (
        connected: boolean
      ) => void;

      expect(screen.getByTestId("is-connected").textContent).toBe("false");

      act(() => {
        onConnectionChange(true);
      });
      expect(screen.getByTestId("is-connected").textContent).toBe("true");

      act(() => {
        onConnectionChange(false);
      });
      expect(screen.getByTestId("is-connected").textContent).toBe("false");
    });

    it("should update users when presence updates", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;

      const user1: PresenceUser = {
        id: "user-1",
        name: "Test User",
        status: "online",
        joinedAt: 1000,
      };
      const user2: PresenceUser = {
        id: "user-2",
        name: "Other User",
        status: "idle",
        joinedAt: 2000,
      };

      act(() => {
        onPresenceUpdate([user1]);
      });

      const container1 = screen.getByTestId("users-container");
      expect(container1.getAttribute("data-users")).toContain("user-1");
      expect(container1.getAttribute("data-users")).not.toContain("user-2");

      act(() => {
        onPresenceUpdate([user1, user2]);
      });

      const container2 = screen.getByTestId("users-container");
      expect(container2.getAttribute("data-users")).toContain("user-1");
      expect(container2.getAttribute("data-users")).toContain("user-2");
    });
  });

  // ── 8. Memoization ───────────────────────────────────────────────────────

  describe("memoization", () => {
    it("should re-render children when users change", async () => {
      let lastUsers: PresenceUser[] | null = null;

      function UserTrackingConsumer() {
        const ctx = usePresenceContext();
        lastUsers = ctx.users;
        return createElement(
          "div",
          { "data-testid": "user-count" },
          ctx.users.length
        );
      }

      renderProvider({ children: createElement(UserTrackingConsumer) });

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(screen.getByTestId("user-count").textContent).toBe("0");

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;

      const user: PresenceUser = {
        id: "user-1",
        name: "Test User",
        status: "online",
        joinedAt: 1000,
      };

      act(() => {
        onPresenceUpdate([user]);
      });

      expect(screen.getByTestId("user-count").textContent).toBe("1");
      expect(lastUsers).toHaveLength(1);
    });

    it("should re-render children when isConnected changes", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onConnectionChange = opts.onConnectionChange as (
        connected: boolean
      ) => void;

      expect(screen.getByTestId("is-connected").textContent).toBe("false");

      act(() => {
        onConnectionChange(true);
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("true");
    });
  });

  // ── 9. Reconnection on prop changes ──────────────────────────────────────

  describe("reconnection on prop changes", () => {
    it("should create new PresenceManager when workspaceId changes", async () => {
      const { rerender } = renderProvider({ workspaceId: "ws-1" });

      await act(async () => {
        jwtTokenResolver?.("jwt-token-1");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
      const firstOpts = getManagerOpts(instances[0]!);
      expect(firstOpts.workspaceId).toBe("ws-1");

      mockGetJwtToken.mockReset();
      mockGetJwtToken.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            jwtTokenResolver = resolve;
          })
      );

      act(() => {
        rerender(
          createElement(
            PresenceProvider,
            { ...DEFAULT_PROPS, workspaceId: "ws-2" },
            createElement(TestConsumer)
          )
        );
      });

      expect(mockGetJwtToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        jwtTokenResolver?.("jwt-token-2");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(2);
      expect(instances.length).toBe(2);
      const secondOpts = getManagerOpts(instances[1]!);
      expect(secondOpts.workspaceId).toBe("ws-2");
    });

    it("should disconnect old manager when props change", async () => {
      const { rerender } = renderProvider({ workspaceId: "ws-1" });

      await act(async () => {
        jwtTokenResolver?.("jwt-token-1");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
      const firstInstance = instances[0]!;

      mockGetJwtToken.mockReset();
      mockGetJwtToken.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            jwtTokenResolver = resolve;
          })
      );

      await act(async () => {
        rerender(
          createElement(
            PresenceProvider,
            { ...DEFAULT_PROPS, workspaceId: "ws-2" },
            createElement(TestConsumer)
          )
        );
        await flushMicrotasks();
      });

      expect(disconnectCalls).toContain(firstInstance);
    });
  });

  // ── 10. Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle enabled transitioning from false to true", async () => {
      const { rerender } = renderProvider({ enabled: false });

      expect(mockGetJwtToken).not.toHaveBeenCalled();
      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();

      mockGetJwtToken.mockReset();
      mockGetJwtToken.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            jwtTokenResolver = resolve;
          })
      );

      await act(async () => {
        rerender(
          createElement(
            PresenceProvider,
            { ...DEFAULT_PROPS, enabled: true },
            createElement(TestConsumer)
          )
        );
        await flushMicrotasks();
      });

      expect(mockGetJwtToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
    });

    it("should handle enabled transitioning from true to false", async () => {
      const { rerender } = renderProvider({ enabled: true });

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalledTimes(1);
      const managerInstance = instances[0]!;

      await act(async () => {
        rerender(
          createElement(
            PresenceProvider,
            { ...DEFAULT_PROPS, enabled: false },
            createElement(TestConsumer)
          )
        );
        await flushMicrotasks();
      });

      expect(disconnectCalls).toContain(managerInstance);
    });

    it("should handle multiple rapid presence updates", async () => {
      renderProvider();

      await act(async () => {
        jwtTokenResolver?.("jwt-token-123");
        await flushMicrotasks();
      });

      const opts = getManagerOpts(instances[0]!);
      const onPresenceUpdate = opts.onPresenceUpdate as (
        users: PresenceUser[]
      ) => void;

      const users: PresenceUser[] = [
        {
          id: "user-1",
          name: "Test User",
          status: "online",
          joinedAt: 1000,
        },
        {
          id: "user-2",
          name: "User 2",
          status: "idle",
          joinedAt: 2000,
        },
        {
          id: "user-3",
          name: "User 3",
          status: "away",
          joinedAt: 3000,
        },
      ];

      act(() => {
        onPresenceUpdate([users[0]!]);
        onPresenceUpdate([users[0]!, users[1]!]);
        onPresenceUpdate(users);
      });

      expect(screen.getByTestId("user-count").textContent).toBe("3");
    });
  });
});
