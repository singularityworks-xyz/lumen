process.env.DATABASE_URL = "postgres://dummy";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";

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

import { roomManager } from "./room-manager";

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

    // SyncStep2 message: [MESSAGE_SYNC(0), syncStep2(2)]
    const syncMessage = new Uint8Array([0, 2]);

    const result = roomManager.handleMessage("conn-viewer", syncMessage);
    expect(result).toBe(false);
  });

  it("editors can write Yjs updates", () => {
    const { ws } = createMockWs();
    roomManager.join({
      connectionId: "conn-editor",
      ws,
      user: makeUser({ role: "EDITOR" }),
      workspaceId: "ws-test",
    });

    // SyncStep1 message: [MESSAGE_SYNC(0), syncStep1(0)]
    const syncStep1 = new Uint8Array([0, 0]);
    const result = roomManager.handleMessage("conn-editor", syncStep1);
    expect(result).toBe(true);
  });
});

describe("RoomManager - awareness broadcast", () => {
  it("awareness updates broadcast to peers only", () => {
    const { ws: ws1, sent: sent1 } = createMockWs();
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

    sent1.length = 0;
    sent2.length = 0;
    sent3.length = 0;

    const awarenessMsg = new Uint8Array([1, 0, 0]);
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

    expect(sent1.length).toBe(1);
    expect(sent2.length).toBe(1);
    expect(ws1.close).toHaveBeenCalled();
    expect(ws2.close).toHaveBeenCalled();

    expect(roomManager.getRoom("ws-delete")).toBeUndefined();
  });
});
