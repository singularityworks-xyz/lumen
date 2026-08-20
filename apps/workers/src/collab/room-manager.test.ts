process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";
process.env.LOG_LEVEL = "error";

import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";
import { YJS_MAP_NAMES } from "@lumen/yjs-shared";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

const prismaMock = {
  workspace: {
    findUnique: mock(() => Promise.resolve({ id: "ws-1" } as any)),
    update: mock(() => Promise.resolve({} as any)),
  },
  workspaceState: {
    findUnique: mock(() => Promise.resolve(null as any)),
    upsert: mock(() => Promise.resolve({} as any)),
  },
};

mock.module("@lumen/db", () => ({
  prisma: prismaMock,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

mock.module("@lumen/logger/server", () => ({
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  withSpanAsync: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn(null),
  withSpan: (_name: string, fn: (span: unknown) => unknown) => fn(null),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

mock.module("./metrics", () => ({
  recordWsRoomJoinDuration: mock(),
}));

const mockEncodeAwarenessUpdate = mock(() => new Uint8Array(0));

// Faithful copy of y-protocols' modifyAwarenessUpdate (decode -> modify ->
// re-encode). Used by the sanitizer; providing a real implementation here
// keeps the sanitization tests exercising the real wire format.
const mockModifyAwarenessUpdate = mock(
  (update: Uint8Array, modify: (state: unknown) => unknown): Uint8Array => {
    const decoder = decoding.createDecoder(update);
    const encoder = encoding.createEncoder();
    const len = decoding.readVarUint(decoder);
    encoding.writeVarUint(encoder, len);
    for (let i = 0; i < len; i += 1) {
      const clientID = decoding.readVarUint(decoder);
      const clock = decoding.readVarUint(decoder);
      const state: unknown = JSON.parse(decoding.readVarString(decoder));
      const modifiedState = modify(state);
      encoding.writeVarUint(encoder, clientID);
      encoding.writeVarUint(encoder, clock);
      encoding.writeVarString(encoder, JSON.stringify(modifiedState));
    }
    return encoding.toUint8Array(encoder);
  }
);

mock.module("y-protocols/awareness", () => ({
  Awareness: class MockAwareness {
    clientID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    states = new Map();
    private listeners: Map<string, Set<(...args: unknown[]) => void>> =
      new Map();
    setLocalState() {
      /* no-op */
    }
    getStates() {
      return this.states;
    }
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)?.add(fn);
    }
    off(event: string, fn: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(fn);
    }
    destroy() {
      /* no-op */
    }
    _emit(event: string, ...args: unknown[]) {
      const handlers = this.listeners.get(event);
      if (handlers) {
        for (const fn of handlers) {
          fn(...args);
        }
      }
    }
  },
  applyAwarenessUpdate: mock(),
  encodeAwarenessUpdate: mockEncodeAwarenessUpdate,
  modifyAwarenessUpdate: mockModifyAwarenessUpdate,
  removeAwarenessStates: mock(),
}));

mock.module("y-protocols/sync", () => ({
  messageYjsSyncStep1: 0,
  messageYjsSyncStep2: 1,
  messageYjsUpdate: 2,
  readSyncMessage: mock(
    (_dec: unknown, _enc: unknown, _doc: unknown, _conn: unknown) => {
      // Return SyncStep1 type to indicate read operation
      return 0;
    }
  ),
  writeSyncStep1: mock((_enc: unknown, _doc: unknown) => {
    /* no-op */
  }),
  writeSyncStep2: mock((_enc: unknown, _doc: unknown, _sv: unknown) => {
    /* no-op */
  }),
}));

import { MESSAGE_WORKSPACE_DELETED, roomManager } from "./room-manager";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

function createMockWs() {
  const sent: Uint8Array[] = [];
  return {
    ws: {
      send: (data: Uint8Array) => {
        sent.push(data);
      },
      close: mock(),
    },
    sent,
  };
}

function makeUser(
  overrides: Partial<{
    id: string;
    role: Role;
    name: string;
    email: string;
    color: string;
  }> = {}
) {
  return {
    id: "user-1",
    role: "EDITOR" as Role,
    name: "Test User",
    email: "test@test.com",
    color: "#ef4444",
    ...overrides,
  };
}

function buildSyncMessage(syncType: number): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  encoding.writeVarUint(encoder, syncType);
  return encoding.toUint8Array(encoder);
}

function buildAwarenessMessage(payload?: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, payload ?? new Uint8Array([1, 2, 3]));
  return encoding.toUint8Array(encoder);
}

// Build a VALID awareness update (same var-encoded layout y-protocols uses:
// client count, then per-client clientID / clock / JSON state var-string).
function buildAwarenessUpdateState(
  state: Record<string, unknown>,
  clientId = 42,
  clock = 1
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1);
  encoding.writeVarUint(encoder, clientId);
  encoding.writeVarUint(encoder, clock);
  encoding.writeVarString(encoder, JSON.stringify(state));
  return encoding.toUint8Array(encoder);
}

// Same as buildAwarenessUpdateState but accepts a raw JSON string, so tests
// can place a JSON-escaped field name on the wire exactly as an attacker would.
function buildAwarenessUpdateJson(
  json: string,
  clientId = 42,
  clock = 1
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 1);
  encoding.writeVarUint(encoder, clientId);
  encoding.writeVarUint(encoder, clock);
  encoding.writeVarString(encoder, json);
  return encoding.toUint8Array(encoder);
}

// Decode the relayed awareness message and return the parsed client state.
function decodeRelayedAwareness(message: Uint8Array): {
  clientId: number;
  clock: number;
  state: unknown;
} {
  const decoder = decoding.createDecoder(message);
  decoding.readVarUint(decoder); // MESSAGE_AWARENESS
  const payload = decoding.readVarUint8Array(decoder);
  const inner = decoding.createDecoder(payload);
  const len = decoding.readVarUint(inner);
  if (len < 1) {
    return { clientId: 0, clock: 0, state: null };
  }
  const clientId = decoding.readVarUint(inner);
  const clock = decoding.readVarUint(inner);
  const state: unknown = JSON.parse(decoding.readVarString(inner));
  return { clientId, clock, state };
}

afterEach(() => {
  roomManager.reset();
});

afterAll(() => {
  mock.restore();
});

describe("RoomManager - deleted workspaces", () => {
  it("cannot recreate room during delete window", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-del",
    });

    roomManager.deleteRoom("ws-del");

    expect(roomManager.isWorkspaceDeleted("ws-del")).toBe(true);

    expect(() => roomManager.getOrCreateRoom("ws-del")).toThrow(
      "Workspace has been deleted"
    );
  });

  it("blocks recreation even after attempting immediate re-delete", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-2",
      ws,
      user: makeUser(),
      workspaceId: "ws-del-expire",
    });

    roomManager.deleteRoom("ws-del-expire");
    expect(roomManager.isWorkspaceDeleted("ws-del-expire")).toBe(true);

    expect(() => roomManager.getOrCreateRoom("ws-del-expire")).toThrow(
      "Workspace has been deleted"
    );
  });

  it("isWorkspaceDeleted returns false for unknown workspace", () => {
    expect(roomManager.isWorkspaceDeleted("unknown-ws")).toBe(false);
  });
});

describe("RoomManager - getRoom", () => {
  it("returns undefined for non-existent room", () => {
    expect(roomManager.getRoom("nonexistent")).toBeUndefined();
  });

  it("returns room after join", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-gr-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const room = roomManager.getRoom("ws-test");
    expect(room).toBeDefined();
    expect(room?.workspaceId).toBe("ws-test");
  });
});

describe("RoomManager - connection reuse", () => {
  it("reconnecting with same connection ID reuses connection state", async () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();

    const conn1 = await roomManager.join({
      connectionId: "conn-reuse",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-conn-reuse",
    });

    const conn2 = await roomManager.join({
      connectionId: "conn-reuse",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-conn-reuse",
    });

    expect(conn1).toBe(conn2);
    expect(conn2.ws).toBe(ws2);
  });
});

describe("RoomManager - viewer sync operations", () => {
  it("viewers can participate in real-time sync updates", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-viewer",
      ws,
      user: makeUser({ role: "VIEWER" }),
      workspaceId: "ws-viewer",
    });

    // Sync type 2 = Update (write)
    const updateMsg = buildSyncMessage(2);
    const result = roomManager.handleMessage("conn-viewer", updateMsg);
    expect(result).toBe(true);
  });

  it("returns false for unknown connection", () => {
    const result = roomManager.handleMessage(
      "unknown-conn",
      new Uint8Array([0])
    );
    expect(result).toBe(false);
  });
});

describe("RoomManager - awareness broadcast", () => {
  it("awareness updates broadcast to peers only", async () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2, sent: sent2 } = createMockWs();
    const { ws: ws3, sent: sent3 } = createMockWs();

    await roomManager.join({
      connectionId: "conn-a1",
      ws: ws1,
      user: makeUser({ id: "user-a1" }),
      workspaceId: "ws-aware",
    });

    await roomManager.join({
      connectionId: "conn-a2",
      ws: ws2,
      user: makeUser({ id: "user-a2" }),
      workspaceId: "ws-aware",
    });

    await roomManager.join({
      connectionId: "conn-a3",
      ws: ws3,
      user: makeUser({ id: "user-a3" }),
      workspaceId: "ws-aware",
    });

    sent2.length = 0;
    sent3.length = 0;

    const awarenessMsg = buildAwarenessMessage();
    roomManager.handleMessage("conn-a1", awarenessMsg);

    expect(sent2.length).toBeGreaterThan(0);
    expect(sent3.length).toBeGreaterThan(0);
  });
});

describe("RoomManager - viewer awareness sanitization", () => {
  // Joins an editor and a viewer in the same room, clears sent buffers, and
  // returns { editorSent, viewerSent } plus connection ids.
  async function joinEditorAndViewer(workspaceId: string) {
    const editorWs = createMockWs();
    const viewerWs = createMockWs();
    await roomManager.join({
      connectionId: `conn-${workspaceId}-edit`,
      ws: editorWs.ws,
      user: makeUser({ id: `user-${workspaceId}-edit`, role: "EDITOR" }),
      workspaceId,
    });
    await roomManager.join({
      connectionId: `conn-${workspaceId}-viewer`,
      ws: viewerWs.ws,
      user: makeUser({ id: `user-${workspaceId}-viewer`, role: "VIEWER" }),
      workspaceId,
    });
    editorWs.sent.length = 0;
    viewerWs.sent.length = 0;
    return {
      editorConnectionId: `conn-${workspaceId}-edit`,
      editorSent: editorWs.sent,
      viewerConnectionId: `conn-${workspaceId}-viewer`,
      viewerSent: viewerWs.sent,
    };
  }

  it("relays draggingBoard awareness from editors verbatim", async () => {
    const { editorConnectionId, viewerSent } =
      await joinEditorAndViewer("ws-secure");

    const payload = buildAwarenessUpdateState({
      user: { id: "user-edit", name: "Editor", role: "editor" },
      draggingBoard: { id: "board-1", kind: "board", x: 100, y: 200 },
    });
    const handled = roomManager.handleMessage(
      editorConnectionId,
      buildAwarenessMessage(payload)
    );

    expect(handled).toBe(true);
    const relayed = decodeRelayedAwareness(viewerSent[0]!);
    const state = relayed.state as Record<string, unknown>;
    expect(state.draggingBoard).toEqual({
      id: "board-1",
      kind: "board",
      x: 100,
      y: 200,
    });
  });

  it("strips draggingBoard awareness from read-only viewers before relay", async () => {
    const { editorSent, viewerConnectionId } =
      await joinEditorAndViewer("ws-secure2");

    const payload = buildAwarenessUpdateState({
      user: { id: "user-viewer", name: "Guest", role: "viewer" },
      cursor: { x: 10, y: 20 },
      draggingBoard: { id: "board-1", kind: "board", x: 999, y: 999 },
    });
    const handled = roomManager.handleMessage(
      viewerConnectionId,
      buildAwarenessMessage(payload)
    );

    expect(handled).toBe(true);
    const relayed = decodeRelayedAwareness(editorSent[0]!);
    const state = relayed.state as Record<string, unknown>;
    expect(state.draggingBoard).toBeUndefined();
    // Non-blocked fields (user, cursor) survive sanitization.
    expect(state.cursor).toEqual({ x: 10, y: 20 });
    expect((state.user as Record<string, unknown>).id).toBe("user-viewer");
  });

  it("strips JSON-escaped draggingBoard and ignores forged roles from viewers", async () => {
    const { editorSent, viewerConnectionId } =
      await joinEditorAndViewer("ws-secure4");

    // "dragging\u0042oard" is valid JSON that decodes to "draggingBoard".
    // The payload also forges role: "editor"; the server must still gate on
    // the connection's VIEWER role, not the payload.
    const escapedJson =
      '{"user":{"id":"user-viewer","role":"editor"},"cursor":{"x":1,"y":2},"dragging\\u0042oard":{"id":"board-1","kind":"board","x":500,"y":500}}';
    const handled = roomManager.handleMessage(
      viewerConnectionId,
      buildAwarenessMessage(buildAwarenessUpdateJson(escapedJson))
    );

    expect(handled).toBe(true);
    const relayed = decodeRelayedAwareness(editorSent[0]!);
    const state = relayed.state as Record<string, unknown>;
    expect(state.draggingBoard).toBeUndefined();
    // Cursor still relayed, forged role still present (role is not a blocked
    // field), but the drag override is gone.
    expect(state.cursor).toEqual({ x: 1, y: 2 });
  });

  it("relays viewer cursor awareness unchanged when it has no blocked fields", async () => {
    const { editorSent, viewerConnectionId } =
      await joinEditorAndViewer("ws-secure3");

    const payload = buildAwarenessUpdateState({
      user: { id: "user-viewer", name: "Guest", role: "viewer" },
      cursor: { x: 42, y: 43 },
    });
    const handled = roomManager.handleMessage(
      viewerConnectionId,
      buildAwarenessMessage(payload)
    );

    expect(handled).toBe(true);
    const relayed = decodeRelayedAwareness(editorSent[0]!);
    const state = relayed.state as Record<string, unknown>;
    expect(state.cursor).toEqual({ x: 42, y: 43 });
    expect(state.draggingBoard).toBeUndefined();
    expect(state.draggingTask).toBeUndefined();
    expect(state.draggingColumn).toBeUndefined();
  });
});

describe("RoomManager - persistence", () => {
  it("skips DB writes when workspace does not exist", async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);

    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-persist",
      ws,
      user: makeUser(),
      workspaceId: "ws-persist",
    });

    await roomManager.persistRoom("ws-persist");

    expect(prismaMock.workspaceState.upsert).not.toHaveBeenCalled();
  });

  it("persists when workspace exists", async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      id: "ws-persist2",
    } as any);
    prismaMock.workspaceState.upsert.mockResolvedValueOnce({} as any);

    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-persist2",
      ws,
      user: makeUser(),
      workspaceId: "ws-persist2",
    });

    await roomManager.persistRoom("ws-persist2");

    expect(prismaMock.workspaceState.upsert).toHaveBeenCalled();
  });

  it("no-ops persist for non-existent room", async () => {
    prismaMock.workspace.findUnique.mockClear();
    await roomManager.persistRoom("nonexistent-ws");
    expect(prismaMock.workspace.findUnique).not.toHaveBeenCalled();
  });
});

describe("RoomManager - load deduplication", () => {
  it("deduplicates concurrent state fetches", async () => {
    prismaMock.workspaceState.findUnique.mockResolvedValue(null as any);

    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-load",
      ws,
      user: makeUser(),
      workspaceId: "ws-load",
    });

    // join() already called loadRoomState, so clear the mock count
    prismaMock.workspaceState.findUnique.mockClear();

    const [r1, r2] = await Promise.all([
      roomManager.loadRoomState("ws-load"),
      roomManager.loadRoomState("ws-load"),
    ]);

    // Deduplication: only one findUnique call for concurrent loadRoomState requests
    expect(prismaMock.workspaceState.findUnique).toHaveBeenCalledTimes(1);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
  });

  it("returns false for non-existent room", async () => {
    const result = await roomManager.loadRoomState("nonexistent-ws");
    expect(result).toBe(false);
  });
});

describe("RoomManager - cleanup", () => {
  it("schedules cleanup for empty rooms", async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      id: "ws-cleanup",
    } as any);

    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-cleanup",
      ws,
      user: makeUser(),
      workspaceId: "ws-cleanup",
    });

    roomManager.leave("conn-cleanup");

    expect(roomManager.getRoom("ws-cleanup")).toBeDefined();
  });

  it("no-ops leave for unknown connection", () => {
    // Should not throw
    roomManager.leave("unknown-conn");
  });
});

describe("RoomManager - delete", () => {
  it("broadcasts workspace-deleted message and closes sockets", async () => {
    const { ws: ws1, sent: sent1 } = createMockWs();
    const { ws: ws2, sent: sent2 } = createMockWs();

    await roomManager.join({
      connectionId: "conn-d1",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-delete",
    });

    await roomManager.join({
      connectionId: "conn-d2",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-delete",
    });

    sent1.length = 0;
    sent2.length = 0;

    roomManager.deleteRoom("ws-delete");

    expect(sent1.length).toBeGreaterThanOrEqual(1);
    expect(sent2.length).toBeGreaterThanOrEqual(1);
    expect(ws1.close).toHaveBeenCalled();
    expect(ws2.close).toHaveBeenCalled();

    expect(roomManager.getRoom("ws-delete")).toBeUndefined();
  });

  it("sends workspace-deleted message type", async () => {
    const { ws, sent } = createMockWs();

    await roomManager.join({
      connectionId: "conn-dtype",
      ws,
      user: makeUser(),
      workspaceId: "ws-delete",
    });

    sent.length = 0;
    roomManager.deleteRoom("ws-delete");

    expect(sent.length).toBeGreaterThanOrEqual(1);
    // First byte should be MESSAGE_WORKSPACE_DELETED (3)
    expect(sent[0]?.[0]).toBe(MESSAGE_WORKSPACE_DELETED);
  });

  it("no-ops delete for non-existent room", () => {
    // Should not throw
    roomManager.deleteRoom("nonexistent-ws");
  });
});

describe("RoomManager - getRoomStats", () => {
  it("returns null for non-existent room", () => {
    const stats = roomManager.getRoomStats("nonexistent-ws");
    expect(stats).toBeNull();
  });

  it("returns stats for existing room", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-stats-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const stats = roomManager.getRoomStats("ws-test");
    expect(stats).toBeDefined();
    expect(stats?.connections).toBe(1);
    expect(typeof stats?.lastModified).toBe("number");
  });

  it("returns correct connection count with multiple connections", async () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();
    await roomManager.join({
      connectionId: "conn-stats-2",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-test",
    });
    await roomManager.join({
      connectionId: "conn-stats-3",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const stats = roomManager.getRoomStats("ws-test");
    expect(stats?.connections).toBe(2);
  });
});

describe("RoomManager - event callbacks", () => {
  it("broadcasts awareness when non-client awareness change occurs", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-evt-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-evt",
    });

    // Clear AFTER join (which calls encodeAwarenessUpdate internally)
    mockEncodeAwarenessUpdate.mockClear();

    const room = (
      roomManager as unknown as {
        rooms: Map<
          string,
          { awareness: { _emit: (e: string, ...a: unknown[]) => void } }
        >;
      }
    ).rooms.get("ws-evt");
    expect(room).toBeDefined();

    // Trigger a non-client-awareness change (origin is not "client-update")
    room?.awareness._emit("change", [], "server-update");

    // encodeAwarenessUpdate should be called for non-client-origin changes
    expect(mockEncodeAwarenessUpdate).toHaveBeenCalled();
  });

  it("does not broadcast awareness when change origin is client-update", async () => {
    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-evt-2",
      ws,
      user: makeUser(),
      workspaceId: "ws-evt2",
    });

    // Clear AFTER join (which calls encodeAwarenessUpdate internally)
    mockEncodeAwarenessUpdate.mockClear();

    const room = (
      roomManager as unknown as {
        rooms: Map<
          string,
          { awareness: { _emit: (e: string, ...a: unknown[]) => void } }
        >;
      }
    ).rooms.get("ws-evt2");
    expect(room).toBeDefined();

    // Trigger a client-awareness change (origin is "client-update") - should not broadcast
    room?.awareness._emit("change", [], "client-update");

    // encodeAwarenessUpdate should NOT be called for client-origin changes
    expect(mockEncodeAwarenessUpdate).not.toHaveBeenCalled();
  });
});

describe("RoomManager - join loads persisted state", () => {
  it("loads persisted state when room is freshly created with empty doc", async () => {
    const mockYjsState = new Uint8Array([1, 2, 3]);
    prismaMock.workspaceState.findUnique.mockResolvedValueOnce({
      workspaceId: "ws-load-join",
      yjsState: mockYjsState,
    });

    const { ws } = createMockWs();
    await roomManager.join({
      connectionId: "conn-load-join-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-load-join",
    });

    expect(prismaMock.workspaceState.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-load-join" },
      })
    );
  });

  it("does NOT reload state when room already has connections", async () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();

    // First join creates room, may load state
    await roomManager.join({
      connectionId: "conn-no-load-1",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-no-load",
    });

    prismaMock.workspaceState.findUnique.mockClear();

    // Second join should NOT load state because room already has a connection
    await roomManager.join({
      connectionId: "conn-no-load-2",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-no-load",
    });

    expect(prismaMock.workspaceState.findUnique).not.toHaveBeenCalled();
  });

  it("concurrent joins to fresh room only trigger one loadRoomState call", async () => {
    const mockYjsState = new Uint8Array([1, 2, 3]);
    prismaMock.workspaceState.findUnique.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                workspaceId: "ws-concurrent",
                yjsState: mockYjsState,
              }),
            50
          )
        )
    );

    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();

    const [conn1, conn2] = await Promise.all([
      roomManager.join({
        connectionId: "conn-concurrent-1",
        ws: ws1,
        user: makeUser(),
        workspaceId: "ws-concurrent",
      }),
      roomManager.join({
        connectionId: "conn-concurrent-2",
        ws: ws2,
        user: makeUser(),
        workspaceId: "ws-concurrent",
      }),
    ]);

    expect(conn1).toBeDefined();
    expect(conn2).toBeDefined();
    // loadRoomState should be called only once due to pendingLoads deduplication
    expect(prismaMock.workspaceState.findUnique).toHaveBeenCalledTimes(1);
  });

  it("does NOT attempt load when room already has board data", async () => {
    // Pre-create a room with board data
    const { ws: ws1 } = createMockWs();
    const preloadedWs = "ws-preloaded-boards";
    await roomManager.join({
      connectionId: "conn-preload-1",
      ws: ws1,
      user: makeUser(),
      workspaceId: preloadedWs,
    });

    // Simulate board data being added to the room's doc
    const room = roomManager.getRoom(preloadedWs);
    expect(room).toBeDefined();
    room?.doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", { id: "board-1" });

    prismaMock.workspaceState.findUnique.mockClear();

    // Remove connection so room has 0 connections but has board data
    roomManager.leave("conn-preload-1");

    // Keep this deterministic: cancellation avoids cleanup timeout racing this join.
    const idleRoom = roomManager.getRoom(preloadedWs);
    expect(idleRoom).toBeDefined();
    if (idleRoom?.cleanupTimeout) {
      clearTimeout(idleRoom.cleanupTimeout);
      idleRoom.cleanupTimeout = null;
    }

    // New join should NOT load because boardsMap.size > 0
    const { ws: ws2 } = createMockWs();
    await roomManager.join({
      connectionId: "conn-preload-2",
      ws: ws2,
      user: makeUser(),
      workspaceId: preloadedWs,
    });

    expect(prismaMock.workspaceState.findUnique).not.toHaveBeenCalled();
  });
});
