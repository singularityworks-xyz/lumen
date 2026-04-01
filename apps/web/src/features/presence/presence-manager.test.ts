import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// ─── Mock helpers ────────────────────────────────────────────────
interface MockChannel {
  join: ReturnType<typeof mock>;
  joinReceiveHandlers: Record<string, (...args: unknown[]) => void>;
  leave: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  onHandlers: Record<string, (...args: unknown[]) => void>;
  push: ReturnType<typeof mock>;
}

function createMockChannel(): MockChannel {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const joinReceives: Record<string, (...args: unknown[]) => void> = {};

  const receiveObj = {
    receive: mock((status: string, cb: (...args: unknown[]) => void) => {
      joinReceives[status] = cb;
      return receiveObj;
    }),
  };

  const chan = {
    join: mock(() => receiveObj),
    on: mock((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    push: mock(() => chan),
    leave: mock(() => ({
      receive: mock(() => chan.leave),
    })),
    onHandlers: handlers,
    joinReceiveHandlers: joinReceives,
  };

  return chan;
}

interface MockSocket {
  channel: ReturnType<typeof mock>;
  closeHandler: (() => void) | null;
  connect: ReturnType<typeof mock>;
  disconnect: ReturnType<typeof mock>;
  errorHandler: ((err: unknown) => void) | null;
  onClose: ReturnType<typeof mock>;
  onError: ReturnType<typeof mock>;
  onOpen: ReturnType<typeof mock>;
  openHandler: (() => void) | null;
}

function createMockSocket(): MockSocket {
  const sock = {
    connect: mock(),
    disconnect: mock(),
    channel: mock(),
    onOpen: mock((cb: () => void) => {
      sock.openHandler = cb;
    }),
    onClose: mock((cb: () => void) => {
      sock.closeHandler = cb;
    }),
    onError: mock((cb: (err: unknown) => void) => {
      sock.errorHandler = cb;
    }),
    openHandler: null,
    closeHandler: null,
    errorHandler: null,
  };

  sock.channel.mockImplementation(() => createMockChannel());
  return sock;
}

// ─── Module mocks ────────────────────────────────────────────────
const mockSocketInstances: MockSocket[] = [];

mock.module("phoenix", () => ({
  Socket: mock(function SocketMock() {
    const s = createMockSocket();
    mockSocketInstances.push(s);
    return s as unknown as import("phoenix").Socket;
  }),
  Channel: mock(),
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

// ─── document event listener mocks ───────────────────────────────
const addEventListenerMock = mock();
const removeEventListenerMock = mock();

function setDocumentHidden(value: boolean) {
  Object.defineProperty(globalThis, "document", {
    value: {
      ...((globalThis as Record<string, unknown>).document as object),
      hidden: value,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    },
    configurable: true,
    writable: true,
  });
}

function restoreDocumentHidden() {
  const doc = (globalThis as Record<string, unknown>).document as
    | { hidden?: boolean }
    | undefined;
  if (doc && "hidden" in doc) {
    Object.defineProperty(globalThis, "document", {
      value: { ...doc, hidden: false },
      configurable: true,
      writable: true,
    });
  }
}

// ─── Timer mocks ─────────────────────────────────────────────────
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const originalDateNow = Date.now;

let fakeNow = 1_000_000;
const intervalCallbacks: Array<{
  id: number;
  fn: (...args: unknown[]) => void;
  delay: number;
}> = [];
let intervalIdCounter = 1;

function mockSetInterval(fn: (...args: unknown[]) => void, delay: number) {
  const id = intervalIdCounter++;
  intervalCallbacks.push({ id, fn, delay });
  return id as unknown as NodeJS.Timeout;
}

function mockClearInterval(id: unknown) {
  const idx = intervalCallbacks.findIndex((c) => c.id === id);
  if (idx !== -1) {
    intervalCallbacks.splice(idx, 1);
  }
}

function fireIntervals() {
  for (const cb of [...intervalCallbacks]) {
    cb.fn();
  }
}

function advanceTime(ms: number) {
  fakeNow += ms;
}

function resetTimerMocks() {
  intervalCallbacks.length = 0;
  intervalIdCounter = 1;
  fakeNow = 1_000_000;
}

// ─── Default test options ────────────────────────────────────────
function defaultOptions(
  overrides?: Partial<
    Parameters<
      typeof import("@/src/features/presence/presence-manager")["PresenceManager"]
    >[0]
  >
) {
  return {
    token: "test-token",
    userId: "user-1",
    userName: "Test User",
    workspaceId: "ws-1",
    onPresenceUpdate: mock(),
    onConnectionChange: mock(),
    userAvatar: "https://example.com/avatar.png",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────
describe("PresenceManager", () => {
  beforeEach(() => {
    mockSocketInstances.length = 0;
    resetTimerMocks();

    addEventListenerMock.mockReset();
    removeEventListenerMock.mockReset();

    // Set up document mock on globalThis
    setDocumentHidden(false);

    // Mock Date.now
    Date.now = mock(() => fakeNow);

    // Mock setInterval/clearInterval
    (globalThis as Record<string, unknown>).setInterval =
      mockSetInterval as unknown as typeof setInterval;
    (globalThis as Record<string, unknown>).clearInterval =
      mockClearInterval as unknown as typeof clearInterval;

    // Reset env
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "wss://presence.example.com";
  });

  afterEach(() => {
    restoreDocumentHidden();
    Date.now = originalDateNow;
    (globalThis as Record<string, unknown>).setInterval = originalSetInterval;
    (globalThis as Record<string, unknown>).clearInterval =
      originalClearInterval;
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "wss://presence.example.com";
  });

  // ── 1. Constructor ────────────────────────────────────────────
  describe("constructor", () => {
    it("should setup activity tracking, visibility tracking, and connect immediately", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const opts = defaultOptions();
      new PresenceManager(opts);

      // Activity tracking: 4 events registered
      const activityEvents = addEventListenerMock.mock.calls.filter((c) =>
        ["mousemove", "keydown", "click", "scroll"].includes(c[0])
      );
      expect(activityEvents).toHaveLength(4);

      // Visibility tracking
      const visibilityCalls = addEventListenerMock.mock.calls.filter(
        (c) => c[0] === "visibilitychange"
      );
      expect(visibilityCalls).toHaveLength(1);

      // Socket created and connected
      expect(mockSocketInstances).toHaveLength(1);
      const socket = mockSocketInstances[0];
      expect(socket.connect).toHaveBeenCalled();

      // Channel created with correct topic
      expect(socket.channel).toHaveBeenCalledWith("workspace:ws-1", {});

      // Channel joined
      const chan = socket.channel.mock.results[0].value as MockChannel;
      expect(chan.join).toHaveBeenCalled();
    });
  });

  // ── 2. presence_state hydration ───────────────────────────────
  describe("presence_state hydration", () => {
    it("should replace all users in presenceState when channel receives presence_state", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;

      // Trigger join ok to setup heartbeat
      chan.joinReceiveHandlers.ok?.();

      // Send presence_state
      const payload = {
        "user-1": {
          metas: [
            {
              name: "Alice",
              avatar: "a.png",
              status: "online",
              joined_at: 100,
            },
          ],
        },
        "user-2": {
          metas: [
            { name: "Bob", avatar: "b.png", status: "idle", joined_at: 200 },
          ],
        },
      };
      chan.onHandlers.presence_state?.(payload);

      expect(onPresenceUpdate).toHaveBeenCalledTimes(1);
      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users).toHaveLength(2);
      expect(
        users.find((u: { id: string }) => u.id === "user-1")
      ).toBeDefined();
      expect(
        users.find((u: { id: string }) => u.id === "user-2")
      ).toBeDefined();

      // Send another presence_state — should replace, not merge
      const payload2 = {
        "user-3": {
          metas: [{ name: "Charlie", status: "online", joined_at: 300 }],
        },
      };
      chan.onHandlers.presence_state?.(payload2);

      expect(onPresenceUpdate).toHaveBeenCalledTimes(2);
      const users2 = onPresenceUpdate.mock.calls[1][0];
      expect(users2).toHaveLength(1);
      expect(users2[0].id).toBe("user-3");
    });
  });

  // ── 3. presence_diff joins ────────────────────────────────────
  describe("presence_diff joins", () => {
    it("should add/update users when channel receives presence_diff with joins", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Initial state
      const initPayload = {
        "user-1": {
          metas: [{ name: "Alice", status: "online", joined_at: 100 }],
        },
      };
      chan.onHandlers.presence_state?.(initPayload);
      onPresenceUpdate.mockReset();

      // Diff with joins
      const diffPayload = {
        joins: {
          "user-2": {
            metas: [{ name: "Bob", status: "online", joined_at: 200 }],
          },
        },
      };
      chan.onHandlers.presence_diff?.(diffPayload);

      expect(onPresenceUpdate).toHaveBeenCalledTimes(1);
      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users).toHaveLength(2);
      expect(
        users.find((u: { id: string }) => u.id === "user-1")
      ).toBeDefined();
      expect(
        users.find((u: { id: string }) => u.id === "user-2")
      ).toBeDefined();

      // Update existing user via joins
      onPresenceUpdate.mockReset();
      const updatePayload = {
        joins: {
          "user-1": {
            metas: [{ name: "Alice Updated", status: "idle", joined_at: 100 }],
          },
        },
      };
      chan.onHandlers.presence_diff?.(updatePayload);

      const updatedUsers = onPresenceUpdate.mock.calls[0][0];
      const alice = updatedUsers.find((u: { id: string }) => u.id === "user-1");
      expect(alice.name).toBe("Alice Updated");
      expect(alice.status).toBe("idle");
    });
  });

  // ── 4. presence_diff leaves ───────────────────────────────────
  describe("presence_diff leaves", () => {
    it("should remove users when channel receives presence_diff with leaves", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Initial state with 3 users
      const initPayload = {
        "user-1": {
          metas: [{ name: "Alice", status: "online", joined_at: 100 }],
        },
        "user-2": {
          metas: [{ name: "Bob", status: "online", joined_at: 200 }],
        },
        "user-3": {
          metas: [{ name: "Charlie", status: "online", joined_at: 300 }],
        },
      };
      chan.onHandlers.presence_state?.(initPayload);
      onPresenceUpdate.mockReset();

      // Diff with leaves
      const diffPayload = {
        leaves: {
          "user-2": {
            metas: [{ name: "Bob", status: "online", joined_at: 200 }],
          },
        },
      };
      chan.onHandlers.presence_diff?.(diffPayload);

      expect(onPresenceUpdate).toHaveBeenCalledTimes(1);
      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users).toHaveLength(2);
      expect(
        users.find((u: { id: string }) => u.id === "user-1")
      ).toBeDefined();
      expect(
        users.find((u: { id: string }) => u.id === "user-2")
      ).toBeUndefined();
      expect(
        users.find((u: { id: string }) => u.id === "user-3")
      ).toBeDefined();
    });
  });

  // ── 5. Heartbeat scheduling ───────────────────────────────────
  describe("Heartbeat scheduling", () => {
    it("should start heartbeat after channel join ok", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;

      // Before join ok, no intervals should be registered
      expect(intervalCallbacks.length).toBe(0);

      // Trigger join ok
      chan.joinReceiveHandlers.ok?.();

      // Should have 2 intervals: heartbeat (30s) and idle check (10s)
      expect(intervalCallbacks).toHaveLength(2);

      const heartbeatCb = intervalCallbacks.find((c) => c.delay === 30_000);
      expect(heartbeatCb).toBeDefined();

      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      expect(idleCheckCb).toBeDefined();
    });

    it("should push activity_ping on heartbeat interval", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      const before = chan.push.mock.calls.length;
      fireIntervals();
      const after = chan.push.mock.calls.length;

      expect(after - before).toBeGreaterThanOrEqual(1);
      const pushCall = chan.push.mock.calls.find(
        (c) => c[0] === "activity_ping"
      );
      expect(pushCall).toBeDefined();
      expect(pushCall[1]).toHaveProperty("timestamp");
    });
  });

  // ── 6. Idle transition ────────────────────────────────────────
  describe("Idle transition", () => {
    it("should transition to idle after 5 minutes of no activity", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Initial state
      const initPayload = {
        "user-1": {
          metas: [{ name: "Alice", status: "online", joined_at: 100 }],
        },
      };
      chan.onHandlers.presence_state?.(initPayload);
      chan.push.mockReset();

      // Advance time past idle threshold (5 minutes = 300_000ms)
      advanceTime(301_000);

      // Fire idle check interval
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      expect(idleCheckCb).toBeDefined();
      idleCheckCb!.fn();

      // Should have pushed status_update with idle
      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "idle" });
    });

    it("should NOT transition to idle if less than 5 minutes have passed", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();
      chan.push.mockReset();

      // Advance time but not past threshold
      advanceTime(200_000);

      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeUndefined();
    });

    it("should NOT transition to idle if already idle", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // First, transition to idle
      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      // Trigger idle check again — should not push another status_update
      idleCheckCb!.fn();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeUndefined();
    });
  });

  // ── 7. Away/online visibility handling ────────────────────────
  describe("Away/online visibility handling", () => {
    it("should transition to away when document becomes hidden", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();
      chan.push.mockReset();

      // Simulate visibility change to hidden
      setDocumentHidden(true);
      const visibilityHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "visibilitychange"
      )![1];
      visibilityHandler();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "away" });
    });

    it("should transition to online when document becomes visible", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();
      chan.push.mockReset();

      // First go away by hiding document
      setDocumentHidden(true);
      const visibilityHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "visibilitychange"
      )![1];
      visibilityHandler();

      // Verify we went away
      const awayCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(awayCall).toBeDefined();
      expect(awayCall[1]).toEqual({ status: "away" });
      chan.push.mockReset();

      // Now make document visible — should transition to online
      setDocumentHidden(false);
      visibilityHandler();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "online" });
    });

    it("should reset lastActivity when document becomes visible", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // First transition to idle
      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      // Make document visible — should reset lastActivity and go online
      setDocumentHidden(false);
      const visibilityHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "visibilitychange"
      )![1];
      visibilityHandler();

      // Now fire idle check — should NOT transition to idle because lastActivity was reset
      idleCheckCb!.fn();

      const statusCalls = chan.push.mock.calls.filter(
        (c) => c[0] === "status_update"
      );
      // Only the "online" transition from visibility change
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0][1]).toEqual({ status: "online" });
    });
  });

  // ── 8. Activity tracking ──────────────────────────────────────
  describe("Activity tracking", () => {
    it("should reset idle timer and transition back to online on mousemove", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // First transition to idle
      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      // Simulate mousemove activity
      const mousemoveHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "mousemove"
      )![1];
      mousemoveHandler();

      // Should have pushed status_update with online
      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "online" });

      // Fire idle check again — should not go idle because activity reset the timer
      idleCheckCb!.fn();
      const statusCallsAfter = chan.push.mock.calls.filter(
        (c) => c[0] === "status_update"
      );
      expect(statusCallsAfter).toHaveLength(1); // only the earlier online transition
    });

    it("should reset idle timer on keydown", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      const keydownHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "keydown"
      )![1];
      keydownHandler();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "online" });
    });

    it("should reset idle timer on click", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      const clickHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "click"
      )![1];
      clickHandler();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "online" });
    });

    it("should reset idle timer on scroll", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      const scrollHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "scroll"
      )![1];
      scrollHandler();

      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual({ status: "online" });
    });

    it("should throttle activity events to once per second", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // First transition to idle
      advanceTime(301_000);
      const idleCheckCb = intervalCallbacks.find((c) => c.delay === 10_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      const mousemoveHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "mousemove"
      )![1];

      // First call — should trigger (idle -> online)
      mousemoveHandler();
      expect(
        chan.push.mock.calls.filter((c) => c[0] === "status_update")
      ).toHaveLength(1);

      // Immediate second call — should be throttled, no additional push
      mousemoveHandler();
      expect(
        chan.push.mock.calls.filter((c) => c[0] === "status_update")
      ).toHaveLength(1);

      // Advance time past throttle delay, then go idle again
      advanceTime(1001);
      advanceTime(301_000);
      idleCheckCb!.fn();
      chan.push.mockReset();

      // Now activity should trigger again (idle -> online)
      mousemoveHandler();
      expect(
        chan.push.mock.calls.filter((c) => c[0] === "status_update")
      ).toHaveLength(1);
    });

    it("should NOT transition to online if already online", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();
      chan.push.mockReset();

      // Trigger activity while already online
      const mousemoveHandler = addEventListenerMock.mock.calls.find(
        (c) => c[0] === "mousemove"
      )![1];
      mousemoveHandler();

      // Should NOT push status_update because already online
      const statusCall = chan.push.mock.calls.find(
        (c) => c[0] === "status_update"
      );
      expect(statusCall).toBeUndefined();
    });
  });

  // ── 9. Event listener cleanup ─────────────────────────────────
  describe("Event listener cleanup", () => {
    it("disconnect should remove all event listeners and clear intervals", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const manager = new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Verify intervals exist
      expect(intervalCallbacks).toHaveLength(2);

      manager.disconnect();

      // Should have removed 4 activity events + 1 visibility event = 5 removeEventListener calls
      const removeCalls = removeEventListenerMock.mock.calls;
      const removedActivityEvents = removeCalls.filter((c) =>
        ["mousemove", "keydown", "click", "scroll"].includes(c[0])
      );
      expect(removedActivityEvents).toHaveLength(4);

      const removedVisibility = removeCalls.filter(
        (c) => c[0] === "visibilitychange"
      );
      expect(removedVisibility).toHaveLength(1);

      // Intervals should be cleared
      expect(intervalCallbacks).toHaveLength(0);

      // Channel leave and socket disconnect
      expect(chan.leave).toHaveBeenCalled();
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it("should clear presenceState on disconnect", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      const manager = new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Add some users
      const payload = {
        "user-1": {
          metas: [{ name: "Alice", status: "online", joined_at: 100 }],
        },
      };
      chan.onHandlers.presence_state?.(payload);
      onPresenceUpdate.mockReset();

      manager.disconnect();

      // After disconnect, presenceState should be empty — we can verify by
      // checking that onPresenceUpdate is NOT called (since state is cleared before any notification)
      expect(onPresenceUpdate).not.toHaveBeenCalled();
    });
  });

  // ── 10. Duplicate metas for same user ─────────────────────────
  describe("Duplicate metas for same user", () => {
    it("parsePresencePayload should use first meta from metas array", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // User with multiple metas (multiple connections)
      const payload = {
        "user-1": {
          metas: [
            {
              name: "Alice Primary",
              avatar: "a1.png",
              status: "online",
              joined_at: 100,
            },
            {
              name: "Alice Secondary",
              avatar: "a2.png",
              status: "idle",
              joined_at: 200,
            },
          ],
        },
      };
      chan.onHandlers.presence_state?.(payload);

      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe("user-1");
      expect(users[0].name).toBe("Alice Primary");
      expect(users[0].avatar).toBe("a1.png");
      expect(users[0].status).toBe("online");
      expect(users[0].joinedAt).toBe(100);
    });
  });

  // ── 11. Reconnect/disconnect edge cases ───────────────────────
  describe("Reconnect/disconnect edge cases", () => {
    it("socket.onClose should clear presenceState and call onConnectionChange(false)", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      const onConnectionChange = mock();
      new PresenceManager(
        defaultOptions({ onPresenceUpdate, onConnectionChange })
      );

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Add users
      const payload = {
        "user-1": {
          metas: [{ name: "Alice", status: "online", joined_at: 100 }],
        },
      };
      chan.onHandlers.presence_state?.(payload);
      onPresenceUpdate.mockReset();
      onConnectionChange.mockReset();

      // Simulate socket close
      socket.closeHandler?.();

      expect(onConnectionChange).toHaveBeenCalledWith(false);
      expect(onPresenceUpdate).not.toHaveBeenCalled();

      // Intervals should be cleared
      expect(intervalCallbacks).toHaveLength(0);
    });

    it("socket.onOpen should call onConnectionChange(true)", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onConnectionChange = mock();
      new PresenceManager(defaultOptions({ onConnectionChange }));

      const socket = mockSocketInstances[0];
      socket.openHandler?.();

      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it("socket.onError should log error without crashing", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      const socket = mockSocketInstances[0];
      // Should not throw
      expect(() => {
        socket.errorHandler?.(new Error("network error"));
      }).not.toThrow();
    });
  });

  // ── 12. WSS enforcement in production ─────────────────────────
  describe("WSS enforcement in production", () => {
    it("should refuse non-wss URLs in production", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "ws://insecure.example.com";

      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      // Socket should NOT be created
      expect(mockSocketInstances).toHaveLength(0);
    });

    it("should allow wss URLs in production", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "wss://secure.example.com";

      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      expect(mockSocketInstances).toHaveLength(1);
      const socket = mockSocketInstances[0];
      expect(socket.connect).toHaveBeenCalled();
    });

    it("should allow ws URLs in non-production", () => {
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "ws://localhost:4000";

      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      expect(mockSocketInstances).toHaveLength(1);
      const socket = mockSocketInstances[0];
      expect(socket.connect).toHaveBeenCalled();
    });

    it("should handle empty NEXT_PUBLIC_PRESENCE_WS_URL in production", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_PRESENCE_WS_URL = "";

      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions());

      // Empty string doesn't start with "wss://" so should be refused
      expect(mockSocketInstances).toHaveLength(0);
    });
  });

  // ── Additional edge cases ─────────────────────────────────────
  describe("Edge cases", () => {
    it("should handle presence_diff with no joins or leaves", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // Send empty diff
      chan.onHandlers.presence_diff?.({});

      // Should still notify (with empty state)
      expect(onPresenceUpdate).toHaveBeenCalled();
    });

    it("should handle presence_diff with undefined joins/leaves", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      chan.onHandlers.presence_diff?.({
        joins: undefined,
        leaves: undefined,
      });

      expect(onPresenceUpdate).toHaveBeenCalled();
    });

    it("should handle parsePresencePayload with invalid payload", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      // null payload
      chan.onHandlers.presence_state?.(null);
      expect(onPresenceUpdate).toHaveBeenCalledWith([]);

      // non-object payload
      onPresenceUpdate.mockReset();
      chan.onHandlers.presence_state?.("string");
      expect(onPresenceUpdate).toHaveBeenCalledWith([]);
    });

    it("should handle parsePresencePayload with missing metas", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      const payload = {
        "user-1": { metas: [] },
        "user-2": {
          metas: [{ name: "Bob", status: "online", joined_at: 200 }],
        },
      };
      chan.onHandlers.presence_state?.(payload);

      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe("user-2");
    });

    it("should handle parsePresencePayload with missing avatar", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      const onPresenceUpdate = mock();
      new PresenceManager(defaultOptions({ onPresenceUpdate }));

      const socket = mockSocketInstances[0];
      const chan = socket.channel.mock.results[0].value as MockChannel;
      chan.joinReceiveHandlers.ok?.();

      const payload = {
        "user-1": {
          metas: [{ name: "NoAvatar", status: "online", joined_at: 100 }],
        },
      };
      chan.onHandlers.presence_state?.(payload);

      const users = onPresenceUpdate.mock.calls[0][0];
      expect(users[0].avatar).toBeUndefined();
    });

    it("should use correct workspace topic", () => {
      const {
        PresenceManager,
      } = require("@/src/features/presence/presence-manager");
      new PresenceManager(defaultOptions({ workspaceId: "ws-abc-123" }));

      const socket = mockSocketInstances[0];
      expect(socket.channel).toHaveBeenCalledWith("workspace:ws-abc-123", {});
    });
  });
});
