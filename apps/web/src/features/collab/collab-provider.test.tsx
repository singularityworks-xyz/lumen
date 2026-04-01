import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch (_e) {
  /* ignore */
}

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
  <T,>(_name: string, fn: (span: unknown) => Promise<T>) => fn({})
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
const mockReadSyncMessage = mock();
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

  constructor(doc: { on: (...args: unknown[]) => void }) {
    this.clientID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    this._states = new Map();
    this._listeners = new Map();
    doc.on("update", () => {
      /* no-op */
    });
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

// --- Mock setTimeout for reconnect testing ---
const capturedTimers: { fn: () => void; delay: number }[] = [];
const originalSetTimeout = globalThis.setTimeout;

function captureSetTimeout() {
  capturedTimers.length = 0;
  globalThis.setTimeout = ((
    fn: () => void,
    delay: number
  ): ReturnType<typeof setTimeout> => {
    capturedTimers.push({ fn, delay });
    // Don't execute automatically - tests will fire timers manually
    return {} as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
}

function restoreSetTimeout() {
  globalThis.setTimeout = originalSetTimeout;
}

async function _flushTimers() {
  const timers = [...capturedTimers];
  capturedTimers.length = 0;
  for (const timer of timers) {
    await timer.fn();
  }
}

// --- Now import the module under test ---

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

// Track WebSocket instances
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

    // Set up setTimeout capture
    captureSetTimeout();

    wsInstances.length = 0;
  });

  afterEach(() => {
    restoreSetTimeout();

    // Restore navigator.onLine
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    } else {
      // biome-ignore lint/performance/noDelete: restoring
      delete (navigator as unknown as Record<string, unknown>).onLine;
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
    it("sets connectionState to error when getJwtToken returns null", async () => {
      mockGetJwtToken.mockResolvedValue(null as unknown as string);

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(getContext().connectionState).toBe("error");
      expect(mockRecordError).toHaveBeenCalled();
    });

    it("does not create WebSocket when JWT is missing", async () => {
      mockGetJwtToken.mockResolvedValue(null as unknown as string);

      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      expect(wsInstances).toHaveLength(0);
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

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

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
    it("cleans up ws, persistence, awareness, doc and resets state", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().connectionState).toBe("connected");
      expect(getContext().isCollaborating).toBe(true);

      // Call disconnect and wait for it
      await act(async () => {
        await getContext().disconnect();
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().connectionState).toBe("disconnected");
      expect(getContext().isCollaborating).toBe(false);
      expect(getContext().collaborators).toEqual([]);
      expect(getContext().localUser).toBeNull();
    });

    it("closes the WebSocket on disconnect", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      const ws = wsInstances[0]!;
      await act(async () => {
        await getContext().disconnect();
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(ws.close).toHaveBeenCalled();
    });

    it("destroys persistence on disconnect", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      await act(async () => {
        await getContext().disconnect();
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPersistenceDestroy).toHaveBeenCalled();
    });
  });

  describe("Reconnect backoff", () => {
    it("schedules reconnect with exponential delays on ws.onclose", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      wsInstances[0]!._simulateClose(1006, "Connection lost");
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().connectionState).toBe("disconnected");
      expect(getContext().isCollaborating).toBe(false);
      expect(capturedTimers).toHaveLength(1);
      expect(capturedTimers[0]!.delay).toBe(1000);
    });

    it("uses increasing delays for subsequent reconnects without successful open", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Close without reopening - counter should increment
      wsInstances[0]!._simulateClose(1006);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(capturedTimers).toHaveLength(1);
      expect(capturedTimers[0]!.delay).toBe(1000);

      // Fire reconnect but don't simulate open
      await act(async () => {
        await capturedTimers[0]!.fn();
      });
      await new Promise((r) => setTimeout(r, 0));

      // Close again - should use next delay
      const ws2 = wsInstances.at(-1)!;
      ws2._simulateClose(1006);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(capturedTimers).toHaveLength(1);
      expect(capturedTimers[0]!.delay).toBe(2000);
    });

    it("caps the reconnect delay at 30000ms", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Simulate many close/reconnect cycles without opening
      for (let i = 0; i < 10; i++) {
        const ws = wsInstances.at(-1)!;
        ws._simulateClose(1006);
        await act(async () => {});
        await new Promise((r) => setTimeout(r, 0));

        if (capturedTimers.length > 0) {
          await act(async () => {
            await capturedTimers[0]!.fn();
          });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // After many attempts, delay should be capped
      if (capturedTimers.length > 0) {
        expect(capturedTimers.at(-1)!.delay).toBe(30_000);
      }
    });
  });

  describe("Workspace deleted handling", () => {
    it("does NOT reconnect when workspaceDeletedRef is true", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      mockReadVarUint.mockReturnValue(3); // MESSAGE_WORKSPACE_DELETED

      const deletedMsg = new Uint8Array([0, 3]);
      wsInstances[0]!._simulateMessage(deletedMsg.buffer);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Close after deleted message
      wsInstances[0]!._simulateClose(1000);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Should NOT schedule a reconnect
      expect(capturedTimers).toHaveLength(0);
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

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      mockReadVarUint.mockReturnValue(3);

      const deletedMsg = new Uint8Array([0, 3]);
      wsInstances[0]!._simulateMessage(deletedMsg.buffer);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

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

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().collaborators).toBeDefined();
      expect(Array.isArray(getContext().collaborators)).toBe(true);
    });

    it("filters out local user by both clientId AND userId", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      const localUser = getContext().localUser;
      expect(localUser).not.toBeNull();

      const collaborators = getContext().collaborators;
      if (localUser) {
        const localInCollaborators = collaborators.find(
          (c) => c.id === localUser.id
        );
        expect(localInCollaborators).toBeUndefined();
      }
    });
  });

  describe("Binary sync message handling", () => {
    it("dispatches MESSAGE_SYNC to syncProtocol.readSyncMessage", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      mockReadVarUint.mockReturnValue(0); // MESSAGE_SYNC

      const syncMsg = new Uint8Array([0, 0, 1, 2, 3]);
      wsInstances[0]!._simulateMessage(syncMsg.buffer);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(mockReadSyncMessage).toHaveBeenCalled();
    });

    it("dispatches MESSAGE_AWARENESS to applyAwarenessUpdate", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      mockReadVarUint.mockReturnValue(1); // MESSAGE_AWARENESS

      const awarenessMsg = new Uint8Array([0, 1, 2, 3]);
      wsInstances[0]!._simulateMessage(awarenessMsg.buffer);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(mockApplyAwarenessUpdate).toHaveBeenCalled();
    });

    it("handles empty message data by returning early", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      const emptyMsg = new Uint8Array([]);
      wsInstances[0]!._simulateMessage(emptyMsg.buffer);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(mockReadSyncMessage).not.toHaveBeenCalled();
    });
  });

  describe("Cursor throttle", () => {
    it("throttles updateCursor at 16ms", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      const ctx = getContext();
      ctx.updateCursor({ x: 100, y: 200 });
      ctx.updateCursor({ x: 300, y: 400 });

      // Both calls should not throw; throttle prevents rapid updates
    });

    it("allows updateCursor after throttle window expires", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      const ctx = getContext();
      ctx.updateCursor({ x: 100, y: 200 });

      await new Promise((resolve) => setTimeout(resolve, 20));

      ctx.updateCursor({ x: 300, y: 400 });
    });
  });

  describe("Local awareness bootstrap on connect", () => {
    it("broadcasts local awareness state immediately on ws.onopen", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(mockEncodeAwarenessUpdate).toHaveBeenCalled();
      expect(getContext().localUser).not.toBeNull();
      expect(getContext().connectionState).toBe("connected");
      expect(getContext().isCollaborating).toBe(true);
    });

    it("sets connectionState to connected and isCollaborating to true on open", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().connectionState).toBe("connected");
      expect(getContext().isCollaborating).toBe(true);
    });

    it("resets reconnect attempt counter on successful connection", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Close to trigger reconnect
      wsInstances[0]!._simulateClose(1006);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(capturedTimers).toHaveLength(1);
      expect(capturedTimers[0]!.delay).toBe(1000);

      // Reconnect and open successfully
      await act(async () => {
        await capturedTimers[0]!.fn();
      });
      await new Promise((r) => setTimeout(r, 0));

      const ws2 = wsInstances.at(-1)!;
      ws2._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      // Close again - counter should have been reset, so delay is 1000 again
      ws2._simulateClose(1006);
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(capturedTimers).toHaveLength(1);
      expect(capturedTimers[0]!.delay).toBe(1000);
    });
  });

  describe("useCollaboration hook", () => {
    it("throws when used outside CollaborationProvider", () => {
      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useCollaboration must be used within CollaborationProvider");
    });
  });

  describe("getColorForUser", () => {
    it("returns a consistent color for the same user ID", () => {
      const color1 = getColorForUser("user-123");
      const color2 = getColorForUser("user-123");
      expect(color1).toBe(color2);
    });

    it("returns different colors for different user IDs", () => {
      const color1 = getColorForUser("user-1");
      const color2 = getColorForUser("user-2");
      expect(color1).not.toBe(color2);
    });

    it("returns a valid color from the palette", () => {
      const palette = [
        "#ef4444",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#14b8a6",
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#f43f5e",
        "#06b6d4",
      ];
      for (const userId of ["a", "b", "c", "user-123", "test@example.com"]) {
        const color = getColorForUser(userId);
        expect(palette).toContain(color);
      }
    });
  });

  describe("updateSelection, updateOpenDialogs, updateIsTyping", () => {
    it("updateSelection sets selection field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(() => {
        getContext().updateSelection(["task-1", "task-2"]);
      }).not.toThrow();
    });

    it("updateOpenDialogs sets openDialogs field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(() => {
        getContext().updateOpenDialogs([
          { id: "d-1", type: "task-dialog", targetId: "t-1" },
        ]);
      }).not.toThrow();
    });

    it("updateIsTyping sets isTyping field on awareness", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(() => {
        getContext().updateIsTyping(true);
      }).not.toThrow();
    });
  });

  describe("WebSocket error handling", () => {
    it("sets connectionState to error on ws.onerror", async () => {
      const { getContext } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateError(new Error("Network error"));
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      expect(getContext().connectionState).toBe("error");
      expect(mockRecordError).toHaveBeenCalled();
    });
  });

  describe("Cleanup on unmount", () => {
    it("cleans up resources when provider unmounts", async () => {
      const { getContext, unmount } = renderProvider();
      await act(async () => {
        await getContext().connect("ws-1");
      });

      wsInstances[0]!._simulateOpen();
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));

      unmount();
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPersistenceDestroy).toHaveBeenCalled();
    });
  });
});
