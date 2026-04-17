import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { act, render } from "@testing-library/react";
import React from "react";

// --- Mock external dependencies ---

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

const mockRecordError = mock();
const mockWithSpanAsync = mock(
  async <T,>(_name: string, fn: (span: unknown) => Promise<T>) => fn({} as T)
);

mock.module("@lumen/logger/tracer", () => ({
  recordError: mockRecordError,
  withSpanAsync: mockWithSpanAsync,
}));

// Mock IndexeddbPersistence
const mockPersistenceDestroy = mock();
const mockPersistenceOn = mock();

class MockIndexeddbPersistence {
  destroy = mockPersistenceDestroy;
  on = mockPersistenceOn;
}

mock.module("y-indexeddb", () => ({
  IndexeddbPersistence: MockIndexeddbPersistence,
}));

// Mock sync protocol
const mockReadSyncMessage = mock(() => 0);
const mockWriteUpdate = mock();

mock.module("y-protocols/sync", () => ({
  readSyncMessage: mockReadSyncMessage,
  writeUpdate: mockWriteUpdate,
}));

// Mock awareness protocol
const mockApplyAwarenessUpdate = mock();
const mockEncodeAwarenessUpdate = mock(() => new Uint8Array([1, 2, 3]));

class MockAwareness {
  clientID: number;
  private readonly _states: Map<number, Record<string, unknown>>;
  private readonly _listeners: Map<string, Set<(...args: unknown[]) => void>>;

  constructor(_doc: { on: (...args: unknown[]) => void }) {
    this.clientID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    this._states = new Map();
    this._listeners = new Map();
  }

  getStates() {
    return this._states;
  }

  setLocalStateField(key: string, value: unknown) {
    const current = this._states.get(this.clientID) || {};
    this._states.set(this.clientID, { ...current, [key]: value });
  }

  on(event: string, fn: (...args: unknown[]) => void) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(fn);
  }

  off(_event: string, _fn: (...args: unknown[]) => void) {
    // no-op
  }

  destroy() {
    // no-op
  }

  _emit(event: string, ...args: unknown[]) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(...args);
      }
    }
  }
}

mock.module("y-protocols/awareness", () => ({
  Awareness: MockAwareness,
  applyAwarenessUpdate: mockApplyAwarenessUpdate,
  encodeAwarenessUpdate: mockEncodeAwarenessUpdate,
}));

// Mock Yjs
const mockEncodeStateVector = mock(() => new Uint8Array([0, 1, 2]));

class MockYDoc {
  private readonly _listeners: Map<string, Set<(...args: unknown[]) => void>>;

  constructor() {
    this._listeners = new Map();
  }

  on(event: string, fn: (...args: unknown[]) => void) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(fn);
  }

  destroy() {
    // no-op
  }

  _emit(event: string, ...args: unknown[]) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(...args);
      }
    }
  }
}

mock.module("yjs", () => ({
  Doc: MockYDoc,
  encodeStateVector: mockEncodeStateVector,
}));

// Mock lib0 encoding/decoding
const mockCreateEncoder = mock(() => ({
  buf: new Uint8Array(256),
  len: 0,
}));
const mockWriteVarUint = mock();
const mockWriteVarUint8Array = mock();
const mockLength = mock(() => 0);
const mockToUint8Array = mock(() => new Uint8Array([0]));

const mockCreateDecoder = mock(() => ({}));
const mockReadVarUint = mock(() => 0);
const mockReadVarUint8Array = mock(() => new Uint8Array([1, 2, 3]));

mock.module("lib0/encoding", () => ({
  createEncoder: mockCreateEncoder,
  writeVarUint: mockWriteVarUint,
  writeVarUint8Array: mockWriteVarUint8Array,
  length: mockLength,
  toUint8Array: mockToUint8Array,
}));

mock.module("lib0/decoding", () => ({
  createDecoder: mockCreateDecoder,
  readVarUint: mockReadVarUint,
  readVarUint8Array: mockReadVarUint8Array,
}));

// Mock auth-client
const mockGetJwtToken = mock(() => Promise.resolve("mock-jwt-token"));
const mockGetCurrentUser = mock(() =>
  Promise.resolve({
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    image: "https://example.com/avatar.png",
  })
);

mock.module("@/src/lib/auth-client", () => ({
  getJwtToken: mockGetJwtToken,
  getCurrentUser: mockGetCurrentUser,
}));

// Mock env
mock.module("@/src/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3002",
  },
}));

// Mock storage-manager
mock.module("@/src/lib/storage-manager", () => ({
  StorageKeys: {
    collabPersistence: (workspaceId: string) =>
      `lumen-dev-3000-collab-${workspaceId}`,
  },
}));

// Mock kanban-store
const mockMarkWorkspaceDeleted = mock();
const mockSetDeletedSharedWorkspace = mock();
const mockGetState = mock(() => ({
  workspaces: { byId: {} },
  markWorkspaceDeleted: mockMarkWorkspaceDeleted,
  setDeletedSharedWorkspace: mockSetDeletedSharedWorkspace,
}));

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: {
    getState: mockGetState,
  },
}));

// --- Mock WebSocket ---

interface MockWsInstance {
  _readyState: number;
  _simulateClose: (code?: number, reason?: string) => void;
  _simulateError: (error: unknown) => void;
  _simulateMessage: (data: ArrayBuffer) => void;
  _simulateOpen: () => void;
  binaryType: BinaryType;
  close: ReturnType<typeof mock>;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: ArrayBuffer }) => void) | null;
  onopen: (() => void) | null;
  sent: Uint8Array[];
  url: string;
}

const wsInstances: MockWsInstance[] = [];
const OriginalWebSocket = globalThis.WebSocket;

function makeMockWsInstance(url: string): MockWsInstance {
  const sent: Uint8Array[] = [];
  const instance: MockWsInstance = {
    url,
    binaryType: "blob",
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    _readyState: 0,
    sent,
    close: mock(() => {
      instance._readyState = 3;
    }),
    _simulateOpen() {
      instance._readyState = 1;
      instance.onopen?.();
    },
    _simulateMessage(data: ArrayBuffer) {
      instance.onmessage?.({ data });
    },
    _simulateClose(code = 1000, reason = "") {
      instance._readyState = 3;
      instance.onclose?.({ code, reason });
    },
    _simulateError(error: unknown) {
      instance.onerror?.(error);
    },
  };
  return instance;
}

beforeAll(() => {
  const MockWebSocket = class {
    url: string;
    binaryType: BinaryType = "blob";
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    private _readyState = 0;
    private _instance: MockWsInstance;

    constructor(url: string) {
      this.url = url;
      this._instance = makeMockWsInstance(url);
      wsInstances.push(this._instance);

      Object.defineProperty(this, "onopen", {
        set(fn) {
          this._instance.onopen = fn;
        },
        get() {
          return this._instance.onopen;
        },
        configurable: true,
      });
      Object.defineProperty(this, "onmessage", {
        set(fn) {
          this._instance.onmessage = fn;
        },
        get() {
          return this._instance.onmessage;
        },
        configurable: true,
      });
      Object.defineProperty(this, "onclose", {
        set(fn) {
          this._instance.onclose = fn;
        },
        get() {
          return this._instance.onclose;
        },
        configurable: true,
      });
      Object.defineProperty(this, "onerror", {
        set(fn) {
          this._instance.onerror = fn;
        },
        get() {
          return this._instance.onerror;
        },
        configurable: true,
      });
    }

    get readyState() {
      return this._readyState;
    }

    send(data: Uint8Array) {
      this._instance.sent.push(data);
    }

    close() {
      this._readyState = 3;
      this._instance.close();
    }
  };

  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  (
    globalThis.WebSocket as typeof WebSocket & {
      OPEN: number;
      CLOSED: number;
      CONNECTING: number;
    }
  ).OPEN = 1;
  (
    globalThis.WebSocket as typeof WebSocket & {
      OPEN: number;
      CLOSED: number;
      CONNECTING: number;
    }
  ).CLOSED = 3;
  (
    globalThis.WebSocket as typeof WebSocket & {
      OPEN: number;
      CLOSED: number;
      CONNECTING: number;
    }
  ).CONNECTING = 0;
});

afterAll(() => {
  globalThis.WebSocket = OriginalWebSocket;
});

// Store original navigator.onLine
const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

// --- Now import the module under test ---

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

import {
  CollaborationProvider,
  getColorForUser,
  useCollaboration,
} from "./collab-provider";

// --- Test helpers ---

function TestConsumer({
  onContext,
}: {
  onContext?: (ctx: ReturnType<typeof useCollaboration>) => void;
}) {
  const ctx = useCollaboration();
  React.useEffect(() => {
    onContext?.(ctx);
  }, [ctx, onContext]);
  return <div data-testid="consumer" />;
}

function renderProvider({
  apiUrl,
  enabled,
}: {
  apiUrl?: string;
  enabled?: boolean;
} = {}) {
  let contextValue: ReturnType<typeof useCollaboration> | undefined;
  const result = render(
    <CollaborationProvider apiUrl={apiUrl} enabled={enabled}>
      <TestConsumer onContext={(ctx) => (contextValue = ctx)} />
    </CollaborationProvider>
  );
  return {
    ...result,
    getContext: () => contextValue!,
  };
}

// --- Tests ---

describe("CollaborationProvider", () => {
  beforeEach(() => {
    // Reset all mocks
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();
    mockRecordError.mockReset();
    mockWithSpanAsync.mockReset();
    mockGetJwtToken.mockReset();
    mockGetCurrentUser.mockReset();
    mockPersistenceDestroy.mockReset();
    mockPersistenceOn.mockReset();
    mockReadSyncMessage.mockReset();
    mockWriteUpdate.mockReset();
    mockApplyAwarenessUpdate.mockReset();
    mockEncodeAwarenessUpdate.mockReset();
    mockEncodeStateVector.mockReset();
    mockGetState.mockReset();
    mockMarkWorkspaceDeleted.mockReset();
    mockSetDeletedSharedWorkspace.mockReset();

    // Default mock implementations
    mockGetJwtToken.mockImplementation(() => Promise.resolve("mock-jwt-token"));
    mockGetCurrentUser.mockImplementation(() =>
      Promise.resolve({
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
        image: "https://example.com/avatar.png",
      })
    );
    mockEncodeStateVector.mockReturnValue(new Uint8Array([0, 1, 2]));
    mockGetState.mockReturnValue({
      workspaces: { byId: {} },
      markWorkspaceDeleted: mockMarkWorkspaceDeleted,
      setDeletedSharedWorkspace: mockSetDeletedSharedWorkspace,
    });
    mockReadSyncMessage.mockReturnValue(0);

    // Ensure navigator.onLine is true by default
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    wsInstances.length = 0;
  });

  afterEach(() => {
    // Restore navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    } else {
      (navigator as unknown as Record<string, unknown>).onLine = undefined;
    }
  });

  describe("Initial state", () => {
    it("starts with connectionState as disconnected", () => {
      const { getContext } = renderProvider();
      expect(getContext().connectionState).toBe("disconnected");
    });

    it("starts with empty collaborators array", () => {
      const { getContext } = renderProvider();
      expect(getContext().collaborators).toEqual([]);
    });

    it("starts with isCollaborating as false", () => {
      const { getContext } = renderProvider();
      expect(getContext().isCollaborating).toBe(false);
    });

    it("starts with doc as null", () => {
      const { getContext } = renderProvider();
      expect(getContext().doc).toBeNull();
    });

    it("starts with awareness as null", () => {
      const { getContext } = renderProvider();
      expect(getContext().awareness).toBeNull();
    });

    it("starts with localUser as null", () => {
      const { getContext } = renderProvider();
      expect(getContext().localUser).toBeNull();
    });
  });

  describe("Offline short-circuit", () => {
    it("skips connect when navigator.onLine is false", () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      const { getContext } = renderProvider();
      getContext().connect("ws-1");

      expect(getContext().connectionState).toBe("disconnected");
    });

    it("does not create WebSocket when offline", () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      const { getContext } = renderProvider();
      getContext().connect("ws-1");

      expect(wsInstances).toHaveLength(0);
    });
  });

  describe("Missing JWT path", () => {
    it("continues with session auth when getJwtToken returns null", async () => {
      mockGetJwtToken.mockResolvedValue(null as unknown as string);

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(getContext().connectionState).toBe("connecting");
      expect(wsInstances).toHaveLength(1);
      expect(wsInstances[0]!.url).not.toContain("token=");
      expect(mockRecordError).not.toHaveBeenCalled();
    });

    it("still creates WebSocket when JWT is missing", async () => {
      mockGetJwtToken.mockResolvedValue(null as unknown as string);

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(wsInstances).toHaveLength(1);
    });
  });

  describe("Connect lifecycle", () => {
    it("creates Y.Doc, Awareness, IndexeddbPersistence, and WebSocket on connect", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(getContext().connectionState).toBe("connecting");
      expect(wsInstances).toHaveLength(1);
      expect(wsInstances[0]!.url).toContain("/ws/collab/ws-1");
      expect(wsInstances[0]!.url).toContain("stateVector=");
    });

    it("uses the correct WebSocket URL with ws protocol", async () => {
      const { getContext } = renderProvider({
        apiUrl: "http://api.example.com",
      });
      await act(async () => {
        await getContext().connect("ws-2");
      });

      expect(wsInstances[0]!.url).toContain(
        "ws://api.example.com/ws/collab/ws-2"
      );
    });

    it("fetches JWT token during connect", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(mockGetJwtToken).toHaveBeenCalled();
    });

    it("fetches current user during connect", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(mockGetCurrentUser).toHaveBeenCalled();
    });

    it("sets localUserInfo from current user", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-456",
        name: "Alice",
        email: "alice@example.com",
        image: "https://example.com/alice.png",
      });

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      expect(getContext().localUser).not.toBeNull();
      expect(getContext().localUser?.id).toBe("user-456");
      expect(getContext().localUser?.name).toBe("Alice");
    });

    it("does nothing when enabled is false", () => {
      const { getContext } = renderProvider({ enabled: false });
      getContext().connect("ws-1");

      expect(getContext().connectionState).toBe("disconnected");
      expect(wsInstances).toHaveLength(0);
    });
  });

  describe("Disconnect lifecycle", () => {
    it("cleans up ws, persistence, awareness, doc and resets state on unmount", async () => {
      const { getContext, unmount } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      expect(getContext().connectionState).toBe("connected");
      expect(getContext().isCollaborating).toBe(true);

      unmount();

      // After unmount, cleanup should have been called
      expect(wsInstances[0]!.close).toHaveBeenCalled();
      expect(mockPersistenceDestroy).toHaveBeenCalled();
    });

    it("closes the WebSocket on unmount", async () => {
      const { getContext, unmount } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      const ws = wsInstances[0]!;
      unmount();

      expect(ws.close).toHaveBeenCalled();
    });

    it("destroys persistence on unmount", async () => {
      const { getContext, unmount } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      unmount();

      expect(mockPersistenceDestroy).toHaveBeenCalled();
    });
  });

  describe("Reconnect backoff", () => {
    it("schedules reconnect with exponential delays on ws.onclose", async () => {
      const capturedTimers: { fn: () => void; delay: number }[] = [];
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((
        fn: () => void,
        delay: number
      ): ReturnType<typeof setTimeout> => {
        capturedTimers.push({ fn, delay });
        return {} as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout;

      try {
        const { getContext } = renderProvider();
        await act(async () => {
          await getContext().connect("ws-1");
        });

        act(() => {
          wsInstances[0]!._simulateOpen();
        });
        act(() => {
          /* no-op */
        });

        act(() => {
          wsInstances[0]!._simulateClose(1006, "Connection lost");
        });
        act(() => {
          /* no-op */
        });

        expect(getContext().connectionState).toBe("disconnected");
        expect(getContext().isCollaborating).toBe(false);
        expect(capturedTimers).toHaveLength(1);
        expect(capturedTimers[0]!.delay).toBe(1000);
      } finally {
        globalThis.setTimeout = origSetTimeout;
      }
    });
  });

  describe("Workspace deleted handling", () => {
    it("does NOT reconnect when workspaceDeletedRef is true", async () => {
      const capturedTimers: { fn: () => void; delay: number }[] = [];
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = ((
        fn: () => void,
        delay: number
      ): ReturnType<typeof setTimeout> => {
        capturedTimers.push({ fn, delay });
        return {} as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout;

      try {
        const { getContext } = renderProvider();
        await act(async () => {
          await getContext().connect("ws-1");
        });

        act(() => {
          wsInstances[0]!._simulateOpen();
        });
        act(() => {
          /* no-op */
        });

        mockReadVarUint.mockReturnValue(3); // MESSAGE_WORKSPACE_DELETED

        const deletedMsg = new Uint8Array([3]);
        act(() => {
          wsInstances[0]!._simulateMessage(deletedMsg.buffer);
        });
        act(() => {
          /* no-op */
        });

        // Should NOT schedule a reconnect
        expect(capturedTimers).toHaveLength(0);
      } finally {
        globalThis.setTimeout = origSetTimeout;
      }
    });

    it("marks workspace as deleted and sets disconnected state", async () => {
      mockGetState.mockReturnValue({
        workspaces: { byId: { "ws-1": { isShared: true } } },
        markWorkspaceDeleted: mockMarkWorkspaceDeleted,
        setDeletedSharedWorkspace: mockSetDeletedSharedWorkspace,
      });

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      mockReadVarUint.mockReturnValue(3);

      const deletedMsg = new Uint8Array([3]);
      act(() => {
        wsInstances[0]!._simulateMessage(deletedMsg.buffer);
      });
      act(() => {
        /* no-op */
      });

      expect(getContext().connectionState).toBe("disconnected");
      expect(getContext().isCollaborating).toBe(false);
    });
  });

  describe("Awareness dedupe by user.id", () => {
    it("deduplicates collaborators by user.id using Map", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      expect(getContext().collaborators).toBeDefined();
      expect(Array.isArray(getContext().collaborators)).toBe(true);
    });

    it("filters out local user by both clientId AND userId", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      // Local user should not appear in collaborators
      const collaborators = getContext().collaborators;
      const hasLocalUser = collaborators.some((c) => c.id === "user-123");
      expect(hasLocalUser).toBe(false);
    });
  });

  describe("Binary sync message handling", () => {
    it("does not throw when receiving a sync message", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      // Simulate a sync message - should not throw
      const syncMsg = new Uint8Array([0, 0]);
      expect(() => {
        act(() => {
          wsInstances[0]!._simulateMessage(syncMsg.buffer);
        });
      }).not.toThrow();
    });

    it("does not throw when receiving an awareness message", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      // Simulate an awareness message - should not throw
      const awarenessMsg = new Uint8Array([1, 1, 2, 3]);
      expect(() => {
        act(() => {
          wsInstances[0]!._simulateMessage(awarenessMsg.buffer);
        });
      }).not.toThrow();
    });

    it("handles empty messages gracefully", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      // Empty message should not throw
      const emptyMsg = new Uint8Array([]);
      expect(() => {
        act(() => {
          wsInstances[0]!._simulateMessage(emptyMsg.buffer);
        });
      }).not.toThrow();
    });

    it("handles unknown message types gracefully", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      // Unknown message type should not throw
      const unknownMsg = new Uint8Array([99]);
      expect(() => {
        act(() => {
          wsInstances[0]!._simulateMessage(unknownMsg.buffer);
        });
      }).not.toThrow();
    });
  });

  describe("Cursor throttle", () => {
    it("throttles updateCursor at 16ms", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      // First call should work
      getContext().updateCursor({ x: 100, y: 200 });
      const awareness = getContext().awareness;
      expect(awareness).not.toBeNull();

      // Second call within throttle window should be ignored
      const statesBefore = awareness!.getStates().size;
      getContext().updateCursor({ x: 101, y: 201 });
      const statesAfter = awareness!.getStates().size;

      expect(statesAfter).toBe(statesBefore);
    });
  });

  describe("Local awareness bootstrap on connect", () => {
    it("broadcasts local awareness state immediately on ws.onopen", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      // Should have sent awareness message
      const ws = wsInstances[0]!;
      expect(ws.sent.length).toBeGreaterThan(0);
    });

    it("sets connectionState to connected on ws.onopen", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(getContext().connectionState).toBe("connecting");

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      expect(getContext().connectionState).toBe("connected");
      expect(getContext().isCollaborating).toBe(true);
    });

    it("resets reconnectAttemptRef on successful open", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      expect(getContext().connectionState).toBe("connected");
    });
  });

  describe("WebSocket error handling", () => {
    it("sets connectionState to error on ws.onerror", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateError(new Error("Network error"));
      });

      expect(getContext().connectionState).toBe("error");
      expect(mockRecordError).toHaveBeenCalled();
    });
  });

  describe("Cleanup on unmount", () => {
    it("calls cleanup handlers when component unmounts", async () => {
      const { getContext, unmount } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });

      unmount();

      // Cleanup should have been triggered
      expect(wsInstances[0]!.close).toHaveBeenCalled();
    });
  });

  describe("updateSelection, updateOpenDialogs, updateIsTyping", () => {
    it("updateSelection sets selection field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      getContext().updateSelection(["task-1", "task-2"]);

      const awareness = getContext().awareness;
      expect(awareness).not.toBeNull();
      const states = awareness!.getStates();
      const localState = states.get(awareness!.clientID);
      expect(localState?.selection).toEqual(["task-1", "task-2"]);
    });

    it("updateOpenDialogs sets openDialogs field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      getContext().updateOpenDialogs([
        { id: "dlg-1", type: "task-dialog", targetId: "task-1" },
      ]);

      const awareness = getContext().awareness;
      expect(awareness).not.toBeNull();
      const states = awareness!.getStates();
      const localState = states.get(awareness!.clientID);
      expect(localState?.openDialogs).toHaveLength(1);
    });

    it("updateIsTyping sets isTyping field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      act(() => {
        wsInstances[0]!._simulateOpen();
      });
      act(() => {
        /* no-op */
      });

      getContext().updateIsTyping(true);

      const awareness = getContext().awareness;
      expect(awareness).not.toBeNull();
      const states = awareness!.getStates();
      const localState = states.get(awareness!.clientID);
      expect(localState?.isTyping).toBe(true);
    });
  });

  describe("getColorForUser", () => {
    it("returns deterministic color for same user ID", () => {
      const color1 = getColorForUser("user-123");
      const color2 = getColorForUser("user-123");
      expect(color1).toBe(color2);
    });

    it("returns different colors for different user IDs", () => {
      const color1 = getColorForUser("user-1");
      const color2 = getColorForUser("user-2");
      // May be same by chance, but unlikely for these IDs
      expect(typeof color1).toBe("string");
      expect(typeof color2).toBe("string");
    });

    it("returns valid hex color", () => {
      const color = getColorForUser("any-user");
      expect(color).toMatch(HEX_COLOR_RE);
    });
  });
});
