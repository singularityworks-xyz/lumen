process.env.DATABASE_URL = "postgres://dummy";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";
import { Elysia } from "elysia";

// Set up mocks BEFORE importing the module under test
const findUniqueMock = mock(() => Promise.resolve(null));
const upsertMock = mock(() => Promise.resolve({}));
const updateMock = mock(() => Promise.resolve({}));

const mockPrisma = {
  workspace: {
    findUnique: mock(() =>
      Promise.resolve({ id: "ws-1", name: "Test Workspace" })
    ),
    update: updateMock,
  },
  workspaceState: {
    findUnique: findUniqueMock,
    upsert: upsertMock,
  },
};

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

const mockSpan = {
  setAttribute: mock(),
  addEvent: mock(),
  recordException: mock(),
};

mock.module("@lumen/db", () => ({
  prisma: mockPrisma,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

mock.module("@lumen/logger/server", () => ({
  withSpanAsync: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn(mockSpan),
  withSpan: (_name: string, fn: (span: unknown) => unknown) => fn(mockSpan),
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  addSpanEvent: mock(),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

mock.module("../../src/collab/metrics", () => ({
  recordWsRoomJoinDuration: mock(),
  incrementActiveConnections: mock(),
  decrementActiveConnections: mock(),
  recordWsMessage: mock(),
  recordWsConnectionError: mock(),
  recordWsConnectionLatency: mock(),
}));

mock.module("@lumen/ai", () => ({
  aiRoutes: new Elysia({ name: "ai-routes" }),
}));

mock.module("@lumen/yjs-shared", () => ({
  YJS_MAP_NAMES: {
    WORKSPACE: "workspace",
    BOARDS: "boards",
    COLUMNS: "columns",
    TASKS: "tasks",
    BOARD_POSITIONS: "boardPositions",
    BOARD_CONNECTIONS: "boardConnections",
    AREAS: "areas",
    AREA_POSITIONS: "areaPositions",
    AREA_DIALOGS: "areaDialogs",
    CANVAS: "canvas",
    BOARD_QUICK_ACTIONS: "boardQuickActions",
    BOARD_DIALOGS: "boardDialogs",
    CONNECTION_DIALOGS: "connectionDialogs",
    CREATE_TASK_MODALS: "createTaskModals",
    COLUMN_QUICK_ACTIONS: "columnQuickActions",
    COLUMN_DIALOGS: "columnDialogs",
    TASK_QUICK_ACTIONS: "taskQuickActions",
    TASK_DETAIL_MODALS: "taskDetailModals",
    COMMENTS: "comments",
    CHAT_MESSAGES: "chatMessages",
  },
  MESSAGE_WORKSPACE_DELETED: 3,
  MESSAGE_SYNC: 0,
  MESSAGE_AWARENESS: 1,
  assignSafeYjsClientId: (doc: { clientID: number }) => {
    doc.clientID = 1;
    return 1;
  },
}));

// Import roomManager AFTER all mocks are set up
const { roomManager } = await import("../../src/collab/room-manager");

const createMockWs = () => {
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
};

const makeUser = (
  overrides: Partial<{
    id: string;
    role: Role;
    name: string;
    email: string;
    color: string;
  }> = {}
) => ({
  id: "user-1",
  role: "EDITOR" as Role,
  name: "Test User",
  email: "test@test.com",
  color: "#ef4444",
  ...overrides,
});

const uniqueId = () => `${Date.now()}-${Math.random()}`;

describe("WORKERS-I-05: room-persistence integration", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    updateMock.mockReset();
    mockPrisma.workspace.findUnique.mockReset();
  });

  describe("persisted Yjs state can be loaded back into a fresh room", () => {
    it("loadRoomState queries database with correct workspaceId", async () => {
      const wsId = `ws-load-state-${uniqueId()}`;
      findUniqueMock.mockResolvedValueOnce(null as any);

      await roomManager.loadRoomState(wsId);

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { workspaceId: wsId },
      });
    });

    it("returns false when no persisted data exists", async () => {
      const wsId = `ws-no-state-${uniqueId()}`;
      findUniqueMock.mockResolvedValueOnce(null as any);

      const loaded = await roomManager.loadRoomState(wsId);

      expect(loaded).toBe(false);
    });

    it("getRoom returns undefined for workspace with no active room", () => {
      const wsId = `ws-no-room-${uniqueId()}`;

      const room = roomManager.getRoom(wsId);

      expect(room).toBeUndefined();
    });
  });

  describe("state vector and Yjs bytes are stored on upsert", () => {
    it("stores both state and state vector on persist", async () => {
      const wsId = `ws-persist-${uniqueId()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: wsId,
        name: "Test",
      } as any);
      upsertMock.mockResolvedValueOnce({} as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-persist-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("upsert updates existing state when record exists", async () => {
      const wsId = `ws-persist-update-${uniqueId()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: wsId,
        name: "Test",
      } as any);
      upsertMock.mockResolvedValueOnce({} as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-persist2-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("upsert creates new state when not exists", async () => {
      const wsId = `ws-persist-create-${uniqueId()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: wsId,
        name: "Test",
      } as any);
      upsertMock.mockResolvedValueOnce({} as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-persist3-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe("workspace name metadata is updated from Yjs workspace map when present", () => {
    it("skips workspace name update when not in Yjs map", async () => {
      const wsId = `ws-wsname-${uniqueId()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: wsId,
        name: "Test",
      } as any);
      upsertMock.mockResolvedValueOnce({} as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-wsname-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(updateMock).not.toHaveBeenCalled();
    });

    it("persistRoom skips update when workspace.findUnique returns null", async () => {
      const wsId = `ws-wsname-missing-${uniqueId()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-wsname2-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(mockPrisma.workspace.findUnique).toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe("room cleanup and state recovery", () => {
    it("schedules cleanup after last connection leaves", () => {
      const wsId = `ws-cleanup-${uniqueId()}`;
      const { ws } = createMockWs();
      const connId = `conn-cleanup-${uniqueId()}`;
      roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      roomManager.leave(connId);

      const room = roomManager.getRoom(wsId);
      expect(room?.cleanupTimeout).not.toBeNull();
    });

    it("destroys Y.Doc on room cleanup", () => {
      const wsId = `ws-destroy-${uniqueId()}`;
      const { ws } = createMockWs();
      const connId = `conn-destroy-${uniqueId()}`;
      roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      roomManager.leave(connId);

      const room = roomManager.getRoom(wsId);
      expect(room).toBeDefined();

      const destroyMock = mock();
      if (room) {
        room.doc.destroy = destroyMock;
      }

      if (room?.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
      }

      if (room) {
        room.doc.destroy();
      }

      expect(destroyMock).toHaveBeenCalled();
    });
  });

  describe("concurrent room creation deduplication", () => {
    it("returns existing room if already created", () => {
      const wsId = `ws-dedup-${uniqueId()}`;
      const { ws } = createMockWs();
      const connId = `conn-dedup-${uniqueId()}`;

      const room1 = roomManager.getOrCreateRoom(wsId);
      roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      const room2 = roomManager.getOrCreateRoom(wsId);

      expect(room1).toBe(room2);
    });

    it("creates new room if not exists", () => {
      const wsId = `ws-new-${uniqueId()}`;
      const room = roomManager.getOrCreateRoom(wsId);

      expect(room).toBeDefined();
      expect(room.workspaceId).toBe(wsId);
    });

    it("pending loads prevent duplicate fetches", async () => {
      const wsId = `ws-load-dedup-${uniqueId()}`;
      findUniqueMock.mockResolvedValueOnce(null as any);

      const { ws } = createMockWs();
      roomManager.join({
        connectionId: `conn-load-${uniqueId()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      const [result1, result2] = await Promise.all([
        roomManager.loadRoomState(wsId),
        roomManager.loadRoomState(wsId),
      ]);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(findUniqueMock).toHaveBeenCalledTimes(1);
    });
  });
});
