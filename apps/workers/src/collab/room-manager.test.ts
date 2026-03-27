process.env.DATABASE_URL = "postgres://dummy";

import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";
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
      this.listeners.get(event)!.add(fn);
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

const testWorkspaces = [
  "ws-test",
  "ws-del",
  "ws-del-expire",
  "ws-persist",
  "ws-persist2",
  "ws-load",
  "ws-cleanup",
  "ws-delete",
  "ws-viewer",
  "ws-aware",
  "ws-conn-reuse",
];

afterEach(() => {
  for (const wsId of testWorkspaces) {
    try {
      roomManager.deleteRoom(wsId);
    } catch {
      /* ignore */
    }
  }
  roomManager.clearDeletedWorkspaces();
});

describe("RoomManager - deleted workspaces", () => {
  it("cannot recreate room during delete window", () => {
    const { ws } = createMockWs();
    roomManager.join({
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

  it("blocks recreation even after attempting immediate re-delete", () => {
    const { ws } = createMockWs();
    roomManager.join({
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

  it("returns room after join", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-gr-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const room = roomManager.getRoom("ws-test");
    expect(room).toBeDefined();
    expect(room!.workspaceId).toBe("ws-test");
  });
});

describe("RoomManager - connection reuse", () => {
  it("reconnecting with same connection ID reuses connection state", () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();

    const conn1 = roomManager.join({
      connectionId: "conn-reuse",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-conn-reuse",
    });

    const conn2 = roomManager.join({
      connectionId: "conn-reuse",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-conn-reuse",
    });

    expect(conn1).toBe(conn2);
    expect(conn2.ws).toBe(ws2);
  });
});

describe("RoomManager - viewer write restrictions", () => {
  it("viewers cannot write Yjs updates", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-viewer",
      ws,
      user: makeUser({ role: "VIEWER" }),
      workspaceId: "ws-viewer",
    });

    // Sync type 1 = SyncStep2 (write)
    const syncStep2Msg = buildSyncMessage(1);
    const result = roomManager.handleMessage("conn-viewer", syncStep2Msg);
    expect(result).toBe(false);
  });

  it("viewers cannot send Yjs Update messages", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-viewer2",
      ws,
      user: makeUser({ role: "VIEWER" }),
      workspaceId: "ws-viewer",
    });

    // Sync type 2 = Update (write)
    const updateMsg = buildSyncMessage(2);
    const result = roomManager.handleMessage("conn-viewer2", updateMsg);
    expect(result).toBe(false);
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
  it("awareness updates broadcast to peers only", () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2, sent: sent2 } = createMockWs();
    const { ws: ws3, sent: sent3 } = createMockWs();

    roomManager.join({
      connectionId: "conn-a1",
      ws: ws1,
      user: makeUser({ id: "user-a1" }),
      workspaceId: "ws-aware",
    });

    roomManager.join({
      connectionId: "conn-a2",
      ws: ws2,
      user: makeUser({ id: "user-a2" }),
      workspaceId: "ws-aware",
    });

    roomManager.join({
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

describe("RoomManager - persistence", () => {
  it("skips DB writes when workspace does not exist", async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);

    const { ws } = createMockWs();
    roomManager.join({
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
    roomManager.join({
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
    roomManager.join({
      connectionId: "conn-load",
      ws,
      user: makeUser(),
      workspaceId: "ws-load",
    });

    const [r1, r2] = await Promise.all([
      roomManager.loadRoomState("ws-load"),
      roomManager.loadRoomState("ws-load"),
    ]);

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
  it("schedules cleanup for empty rooms", () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      id: "ws-cleanup",
    } as any);

    const { ws } = createMockWs();
    roomManager.join({
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
  it("broadcasts workspace-deleted message and closes sockets", () => {
    const { ws: ws1, sent: sent1 } = createMockWs();
    const { ws: ws2, sent: sent2 } = createMockWs();

    roomManager.join({
      connectionId: "conn-d1",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-delete",
    });

    roomManager.join({
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

  it("sends workspace-deleted message type", () => {
    const { ws, sent } = createMockWs();

    roomManager.join({
      connectionId: "conn-dtype",
      ws,
      user: makeUser(),
      workspaceId: "ws-delete",
    });

    sent.length = 0;
    roomManager.deleteRoom("ws-delete");

    expect(sent.length).toBeGreaterThanOrEqual(1);
    // First byte should be MESSAGE_WORKSPACE_DELETED (3)
    expect(sent[0]![0]).toBe(MESSAGE_WORKSPACE_DELETED);
  });

  it("no-ops delete for non-existent room", () => {
    // Should not throw
    roomManager.deleteRoom("nonexistent-ws");
  });
});

describe("RoomManager - getCollaborators", () => {
  it("returns empty array for non-existent room", () => {
    const collaborators = roomManager.getCollaborators("nonexistent-ws");
    expect(collaborators).toEqual([]);
  });

  it("returns collaborators for existing room", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-gc-1",
      ws,
      user: makeUser({ id: "user-gc-1" }),
      workspaceId: "ws-test",
    });

    const collaborators = roomManager.getCollaborators("ws-test");
    expect(collaborators.length).toBe(1);
    expect(collaborators[0]!.id).toBe("user-gc-1");
  });
});

describe("RoomManager - getRoomStats", () => {
  it("returns null for non-existent room", () => {
    const stats = roomManager.getRoomStats("nonexistent-ws");
    expect(stats).toBeNull();
  });

  it("returns stats for existing room", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-stats-1",
      ws,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const stats = roomManager.getRoomStats("ws-test");
    expect(stats).toBeDefined();
    expect(stats!.connections).toBe(1);
    expect(typeof stats!.lastModified).toBe("number");
  });

  it("returns correct connection count with multiple connections", () => {
    const { ws: ws1 } = createMockWs();
    const { ws: ws2 } = createMockWs();
    roomManager.join({
      connectionId: "conn-stats-2",
      ws: ws1,
      user: makeUser(),
      workspaceId: "ws-test",
    });
    roomManager.join({
      connectionId: "conn-stats-3",
      ws: ws2,
      user: makeUser(),
      workspaceId: "ws-test",
    });

    const stats = roomManager.getRoomStats("ws-test");
    expect(stats!.connections).toBe(2);
  });
});

describe("RoomManager - event callbacks", () => {
  it("broadcasts awareness when non-client awareness change occurs", () => {
    const { ws } = createMockWs();
    roomManager.join({
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
    room!.awareness._emit("change", [], "server-update");

    // encodeAwarenessUpdate should be called for non-client-origin changes
    expect(mockEncodeAwarenessUpdate).toHaveBeenCalled();
  });

  it("does not broadcast awareness when change origin is client-update", () => {
    const { ws } = createMockWs();
    roomManager.join({
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
    room!.awareness._emit("change", [], "client-update");

    // encodeAwarenessUpdate should NOT be called for client-origin changes
    expect(mockEncodeAwarenessUpdate).not.toHaveBeenCalled();
  });
});
