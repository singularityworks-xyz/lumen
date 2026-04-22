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

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { Role } from "@lumen/db";
import { Elysia } from "elysia";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";

// Room manager imports - loaded dynamically after mock setup
let MESSAGE_WORKSPACE_DELETED: number;
let roomManager: typeof import("../collab/room-manager").roomManager;

const _MESSAGE_SYNC = 0;
const LOCAL_MESSAGE_AWARENESS = 1;

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

const uid = () => `${Date.now()}-${Math.random()}`;

const mockPrisma = {
  workspace: {
    findUnique: (() => {
      const m = mock<() => Promise<null | { id: string; name: string }>>();
      return m;
    })(),
    update: mock(() => Promise.resolve({})),
  },
  workspaceState: {
    findUnique: mock(() => Promise.resolve(null)),
    upsert: mock(() => Promise.resolve({})),
  },
  workspaceCollaborator: {
    findUnique: (() => {
      const m =
        mock<
          () => Promise<null | {
            id: string;
            role: Role;
            workspaceId: string;
            userId: string;
            joinedAt: Date;
          }>
        >();
      return m;
    })(),
    findFirst: mock(() => Promise.resolve(null)),
    count: mock(() => Promise.resolve(0)),
    upsert: mock(() => Promise.resolve({})),
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

mock.module("../collab/metrics", () => ({
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

// Load room manager dynamically after mocks are set up
beforeAll(async () => {
  const roomManagerModule = await import("../collab/room-manager");
  MESSAGE_WORKSPACE_DELETED = roomManagerModule.MESSAGE_WORKSPACE_DELETED;
  roomManager = roomManagerModule.roomManager;
});

describe("WORKERS-I-04: collab-websocket integration", () => {
  afterEach(() => {
    mockPrisma.workspace.findUnique.mockReset();
    mockPrisma.workspaceCollaborator.findUnique.mockReset();
    mockPrisma.workspaceCollaborator.count.mockReset();
    mockPrisma.workspaceState.upsert.mockReset();
    // Clean up room manager state between tests to prevent interference
    roomManager?.reset();
  });

  describe("non-existent workspace behavior", () => {
    it("does not persist room when workspace does not exist", async () => {
      const wsId = `ws-nonexistent-${uid()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null as any);
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(0);

      const { ws } = createMockWs();
      await roomManager.join({
        connectionId: `conn-nonexistent-${uid()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(mockPrisma.workspaceState.upsert).not.toHaveBeenCalled();
    });

    it("allows auto-bootstrap when workspace exists", async () => {
      const wsId = `ws-test-${uid()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: wsId,
        name: "Test",
      });
      mockPrisma.workspaceState.upsert.mockResolvedValueOnce({});

      const { ws } = createMockWs();
      await roomManager.join({
        connectionId: `conn-auto-${uid()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(mockPrisma.workspaceState.upsert).toHaveBeenCalled();
    });
  });

  describe("non-collaborator behavior", () => {
    it("allows join but workspaceState is not persisted for non-collaborator", async () => {
      const wsId = `ws-notcollab-${uid()}`;
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(1);

      const { ws } = createMockWs();
      const conn = await roomManager.join({
        connectionId: `conn-notcollab-${uid()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      expect(conn).toBeDefined();

      await roomManager.persistRoom(wsId);

      expect(mockPrisma.workspaceState.upsert).not.toHaveBeenCalled();
    });

    it("allows existing collaborator", async () => {
      const wsId = `ws-collab-${uid()}`;
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        id: "collab-1",
        role: "EDITOR" as Role,
        workspaceId: wsId,
        userId: "user-1",
        joinedAt: new Date(),
      });

      const { ws } = createMockWs();
      const conn = await roomManager.join({
        connectionId: `conn-collab-${uid()}`,
        ws,
        user: makeUser({ role: "EDITOR" }),
        workspaceId: wsId,
      });

      expect(conn.user.role).toBe("EDITOR");
    });
  });

  describe("binary sync and awareness messages are handled by room manager", () => {
    it("handles awareness message type MESSAGE_AWARENESS correctly", async () => {
      const wsId = `ws-aware-${uid()}`;
      const connId = `conn-aware-${uid()}`;
      const { ws } = createMockWs();
      await roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, LOCAL_MESSAGE_AWARENESS);
      const testUpdate = awarenessProtocol.encodeAwarenessUpdate(
        new awarenessProtocol.Awareness(new Y.Doc()),
        []
      );
      encoding.writeVarUint8Array(encoder, testUpdate);
      const awarenessMessage = encoding.toUint8Array(encoder);
      const result = roomManager.handleMessage(connId, awarenessMessage);

      expect(result).toBe(true);
    });

    it("broadcasts awareness update to other connections", async () => {
      const wsId = `ws-broadcast-${uid()}`;
      const connId1 = `conn-broadcast1-${uid()}`;
      const connId2 = `conn-broadcast2-${uid()}`;
      const { ws: ws1, sent: sent1 } = createMockWs();
      const { ws: ws2, sent: sent2 } = createMockWs();

      await roomManager.join({
        connectionId: connId1,
        ws: ws1,
        user: makeUser({ id: "user-1" }),
        workspaceId: wsId,
      });

      await roomManager.join({
        connectionId: connId2,
        ws: ws2,
        user: makeUser({ id: "user-2" }),
        workspaceId: wsId,
      });

      sent1.length = 0;
      sent2.length = 0;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, LOCAL_MESSAGE_AWARENESS);
      const testUpdate = awarenessProtocol.encodeAwarenessUpdate(
        new awarenessProtocol.Awareness(new Y.Doc()),
        []
      );
      encoding.writeVarUint8Array(encoder, testUpdate);
      const awarenessMessage = encoding.toUint8Array(encoder);
      roomManager.handleMessage(connId1, awarenessMessage);

      expect(sent2.length).toBeGreaterThan(0);
    });
  });

  describe("connection close cleans up properly", () => {
    it("removes connection from room and decreases active connections", async () => {
      const wsId = `ws-leave-${uid()}`;
      const connId = `conn-leave-${uid()}`;
      const { ws } = createMockWs();
      await roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      expect(roomManager.getRoom(wsId)?.connections.size).toBe(1);

      roomManager.leave(connId);

      const room = roomManager.getRoom(wsId);
      expect(room?.connections.size).toBe(0);
    });

    it("schedules cleanup when last connection leaves", async () => {
      const wsId = `ws-cleanup-${uid()}`;
      const connId = `conn-cleanup-${uid()}`;
      const { ws } = createMockWs();
      await roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      const roomBefore = roomManager.getRoom(wsId);
      expect(roomBefore?.cleanupTimeout).toBeNull();

      roomManager.leave(connId);

      const roomAfter = roomManager.getRoom(wsId);
      expect(roomAfter?.cleanupTimeout).not.toBeNull();
    });
  });

  describe("MESSAGE_WORKSPACE_DELETED is exported and used for deletion", () => {
    it("MESSAGE_WORKSPACE_DELETED constant equals 3", () => {
      expect(MESSAGE_WORKSPACE_DELETED).toBe(3);
    });

    it("deleteRoom closes all connections in the room", async () => {
      const wsId = `ws-delete-${uid()}`;
      const { ws: ws1 } = createMockWs();
      const { ws: ws2 } = createMockWs();

      await roomManager.join({
        connectionId: `conn-del1-${uid()}`,
        ws: ws1,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.join({
        connectionId: `conn-del2-${uid()}`,
        ws: ws2,
        user: makeUser(),
        workspaceId: wsId,
      });

      roomManager.deleteRoom(wsId);

      expect(ws1.close).toHaveBeenCalled();
      expect(ws2.close).toHaveBeenCalled();
    });
  });
});

// Restore module mocks after all tests in this file complete
afterAll(() => {
  mock.restore();
});
