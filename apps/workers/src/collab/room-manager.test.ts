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

function buildAwarenessMessage(): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, new Uint8Array([1, 2, 3]));
  return encoding.toUint8Array(encoder);
}

function buildAwarenessMessageWithPayload(payload: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, payload);
  return encoding.toUint8Array(encoder);
}

function containsText(haystack: Uint8Array, needle: string): boolean {
  const encoded = new TextEncoder().encode(needle);
  if (encoded.length === 0 || encoded.length > haystack.length) {
    return false;
  }
  outer: for (let i = 0; i <= haystack.length - encoded.length; i += 1) {
    for (let j = 0; j < encoded.length; j += 1) {
      if (haystack[i + j] !== encoded[j]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
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
  const dragPayload = (): Uint8Array =>
    new Uint8Array([...new TextEncoder().encode("draggingBoard"), 0, 1, 2]);

  it("relays draggingBoard awareness from editors verbatim", async () => {
    const { ws: wsViewer, sent: sentViewer } = createMockWs();
    const { ws: wsEditor } = createMockWs();

    await roomManager.join({
      connectionId: "conn-se-edit",
      ws: wsEditor,
      user: makeUser({ id: "user-edit", role: "EDITOR" }),
      workspaceId: "ws-secure",
    });
    await roomManager.join({
      connectionId: "conn-se-viewer",
      ws: wsViewer,
      user: makeUser({ id: "user-viewer", role: "VIEWER" }),
      workspaceId: "ws-secure",
    });

    sentViewer.length = 0;

    const msg = buildAwarenessMessageWithPayload(dragPayload());
    const handled = roomManager.handleMessage("conn-se-edit", msg);

    expect(handled).toBe(true);
    // The peer (viewer) receives the raw awareness including the drag field
    expect(sentViewer.some((m) => containsText(m, "draggingBoard"))).toBe(true);
  });

  it("strips draggingBoard awareness from read-only viewers before relay", async () => {
    const { ws: wsEditor, sent: sentEditor } = createMockWs();
    const { ws: wsViewer } = createMockWs();

    await roomManager.join({
      connectionId: "conn-sv-edit",
      ws: wsEditor,
      user: makeUser({ id: "user-edit2", role: "EDITOR" }),
      workspaceId: "ws-secure2",
    });
    await roomManager.join({
      connectionId: "conn-sv-viewer",
      ws: wsViewer,
      user: makeUser({ id: "user-viewer2", role: "VIEWER" }),
      workspaceId: "ws-secure2",
    });

    sentEditor.length = 0;

    const msg = buildAwarenessMessageWithPayload(dragPayload());
    const handled = roomManager.handleMessage("conn-sv-viewer", msg);

    expect(handled).toBe(true);
    // The peer must NOT receive the blocked drag field from a viewer
    expect(sentEditor.some((m) => containsText(m, "draggingBoard"))).toBe(
      false
    );
  });

  it("relays viewer cursor awareness unchanged when it has no blocked fields", async () => {
    const { ws: wsEditor, sent: sentEditor } = createMockWs();
    const { ws: wsViewer } = createMockWs();

    await roomManager.join({
      connectionId: "conn-sc-edit",
      ws: wsEditor,
      user: makeUser({ id: "user-edit3", role: "EDITOR" }),
      workspaceId: "ws-secure3",
    });
    await roomManager.join({
      connectionId: "conn-sc-viewer",
      ws: wsViewer,
      user: makeUser({ id: "user-viewer3", role: "VIEWER" }),
      workspaceId: "ws-secure3",
    });

    sentEditor.length = 0;

    const plainCursor = new Uint8Array([9, 8, 7]);
    const handled = roomManager.handleMessage(
      "conn-sc-viewer",
      buildAwarenessMessageWithPayload(plainCursor)
    );

    expect(handled).toBe(true);
    // Plain cursor awareness is relayed unchanged on the zero-copy fast path
    expect(
      sentEditor.some((m) =>
        containsText(m, String.fromCharCode(...plainCursor))
      )
    ).toBe(true);
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
