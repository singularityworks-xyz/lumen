// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { usePresence } from "./use-presence";

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

mock.module("../presence-manager", () => ({
  PresenceManager: MockPresenceManagerCtor,
}));

let jwtTokenResolver: ((token: string | null) => void) | null = null;

const mockGetJwtToken = mock(() => {
  return new Promise<string | null>((resolve) => {
    jwtTokenResolver = resolve;
  });
});

mock.module("@/src/lib/auth-client", () => ({
  getJwtToken: mockGetJwtToken,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    debug: mock(),
    error: mock(),
  }),
}));

const DEFAULT_PROPS = {
  userId: "user-1",
  userName: "Test User",
  userAvatar: "https://example.com/avatar.png",
  workspaceId: "ws-1",
  enabled: true,
};

function TestComponent({
  workspaceId = DEFAULT_PROPS.workspaceId,
  userId = DEFAULT_PROPS.userId,
  userName = DEFAULT_PROPS.userName,
  userAvatar = DEFAULT_PROPS.userAvatar,
  enabled = DEFAULT_PROPS.enabled,
}: Partial<typeof DEFAULT_PROPS> = {}) {
  const { users, isConnected, currentUser } = usePresence({
    workspaceId,
    userId,
    userName,
    userAvatar,
    enabled,
  });

  return createElement(
    "div",
    null,
    createElement(
      "span",
      { "data-testid": "is-connected" },
      String(isConnected)
    ),
    createElement(
      "span",
      { "data-testid": "current-user" },
      currentUser?.id ?? "null"
    ),
    createElement(
      "span",
      { "data-testid": "user-count" },
      String(users.length)
    ),
    createElement(
      "span",
      { "data-testid": "users" },
      JSON.stringify(users.map((u) => u.id))
    )
  );
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

describe("usePresence", () => {
  beforeEach(() => {
    mockGetJwtToken.mockReset();
    mockGetJwtToken.mockImplementation(() => {
      return new Promise<string | null>((resolve) => {
        jwtTokenResolver = resolve;
      });
    });
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

  describe("enabled=false", () => {
    it("short-circuits and does not create a PresenceManager", async () => {
      render(createElement(TestComponent, { enabled: false }));

      await act(async () => {
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("returns constructed currentUser even when disabled", async () => {
      render(createElement(TestComponent, { enabled: false }));

      await act(async () => {
        await flushMicrotasks();
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });
  });

  describe("missing required props", () => {
    it("short-circuits when workspaceId is missing", async () => {
      render(createElement(TestComponent, { workspaceId: "" }));

      await act(async () => {
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });

    it("short-circuits when userId is missing", async () => {
      render(createElement(TestComponent, { userId: "" }));

      await act(async () => {
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
    });
  });

  describe("JWT token flow", () => {
    it("creates PresenceManager after JWT token is resolved", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();

      await act(async () => {
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).toHaveBeenCalled();
      expect(instances.length).toBe(1);
      expect(instances[0].opts).toMatchObject({
        workspaceId: "ws-1",
        userId: "user-1",
        userName: "Test User",
        userAvatar: "https://example.com/avatar.png",
      });
    });

    it("does not create PresenceManager if JWT returns null", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!(null);
        await flushMicrotasks();
      });

      expect(MockPresenceManagerCtor).not.toHaveBeenCalled();
      expect(instances.length).toBe(0);
    });

    it("passes token to PresenceManager", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      expect(instances[0].opts).toMatchObject({
        token: "test-jwt-token",
      });
    });
  });

  describe("callback wiring", () => {
    it("passes onPresenceUpdate and onConnectionChange to PresenceManager", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const manager = instances[0].opts as {
        onPresenceUpdate?: (...args: unknown[]) => void;
        onConnectionChange?: (...args: unknown[]) => void;
      };

      expect(manager.onPresenceUpdate).toBeDefined();
      expect(typeof manager.onPresenceUpdate).toBe("function");
      expect(manager.onConnectionChange).toBeDefined();
      expect(typeof manager.onConnectionChange).toBe("function");
    });

    it("updates users state when onPresenceUpdate is called", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const manager = instances[0].opts as {
        onPresenceUpdate?: (users: unknown[]) => void;
      };

      await act(async () => {
        manager.onPresenceUpdate!([
          { id: "user-1", name: "Test User", status: "online" },
          { id: "user-2", name: "Other User", status: "away" },
        ]);
        await flushMicrotasks();
      });

      expect(screen.getByTestId("user-count").textContent).toBe("2");
      expect(screen.getByTestId("users").textContent).toBe(
        JSON.stringify(["user-1", "user-2"])
      );
    });

    it("updates isConnected state when onConnectionChange is called", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const manager = instances[0].opts as {
        onConnectionChange?: (connected: boolean) => void;
      };

      await act(async () => {
        manager.onConnectionChange!(true);
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("true");

      await act(async () => {
        manager.onConnectionChange!(false);
        await flushMicrotasks();
      });

      expect(screen.getByTestId("is-connected").textContent).toBe("false");
    });
  });

  describe("currentUser derivation", () => {
    it("returns current user from users list if present", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const manager = instances[0].opts as {
        onPresenceUpdate?: (users: unknown[]) => void;
      };

      await act(async () => {
        manager.onPresenceUpdate!([
          { id: "user-1", name: "Updated Name", status: "online" },
        ]);
        await flushMicrotasks();
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });

    it("falls back to constructed user when not in users list", async () => {
      render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      expect(screen.getByTestId("current-user").textContent).toBe("user-1");
    });
  });

  describe("cleanup", () => {
    it("disconnects PresenceManager on unmount", async () => {
      const { unmount } = render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      expect(instances.length).toBe(1);

      unmount();

      expect(disconnectCalls.length).toBe(1);
      expect(disconnectCalls[0]).toBe(instances[0]);
    });
  });

  describe("re-creation on prop changes", () => {
    it("disconnects old manager when workspaceId changes", async () => {
      const { rerender } = render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const firstInstance = instances[0];
      expect(instances.length).toBe(1);

      await act(async () => {
        rerender(createElement(TestComponent, { workspaceId: "ws-2" }));
        await flushMicrotasks();
      });

      expect(disconnectCalls.length).toBe(1);
      expect(disconnectCalls[0]).toBe(firstInstance);
    });

    it("disconnects old manager when userId changes", async () => {
      const { rerender } = render(createElement(TestComponent));

      await act(async () => {
        await flushMicrotasks();
        jwtTokenResolver!("test-jwt-token");
        await flushMicrotasks();
      });

      const firstInstance = instances[0];
      expect(instances.length).toBe(1);

      await act(async () => {
        rerender(createElement(TestComponent, { userId: "user-2" }));
        await flushMicrotasks();
      });

      expect(disconnectCalls.length).toBe(1);
      expect(disconnectCalls[0]).toBe(firstInstance);
    });
  });
});
