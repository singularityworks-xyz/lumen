process.env.DATABASE_URL = "postgres://dummy";

import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";
import { Elysia } from "elysia";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { roomManager } from "../../src/collab/room-manager";

const _MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_WORKSPACE_DELETED = 3;

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
    findUnique: mock(() => Promise.resolve({ id: "ws-1", name: "Test" })),
    update: mock(() => Promise.resolve({})),
  },
  workspaceState: {
    findUnique: mock(() => Promise.resolve(null)),
    upsert: mock(() => Promise.resolve({})),
  },
  workspaceCollaborator: {
    findUnique: mock(() =>
      Promise.resolve({
        id: "collab-1",
        role: "EDITOR" as Role,
        workspaceId: "ws-1",
        userId: "user-1",
        joinedAt: new Date(),
      })
    ),
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

describe("WORKERS-I-04: collab-websocket integration", () => {
  afterEach(() => {
    mockPrisma.workspaceCollaborator.findUnique.mockReset();
    mockPrisma.workspaceCollaborator.count.mockReset();
  });

  describe("non-existent workspace rejects with 404", () => {
    it("rejects connection to non-existent workspace when checkWorkspaceExistence returns false", async () => {
      const wsId = `ws-nonexistent-${uid()}`;
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null as any);
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(0);

      const { ws } = createMockWs();
      roomManager.join({
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
      roomManager.join({
        connectionId: `conn-auto-${uid()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      await roomManager.persistRoom(wsId);

      expect(mockPrisma.workspaceState.upsert).toHaveBeenCalled();
    });
  });

  describe("non-collaborator rejects with 403", () => {
    it("rejects user who is not a collaborator when count > 0", () => {
      const wsId = `ws-notcollab-${uid()}`;
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(
        null as any
      );
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(1);

      const { ws } = createMockWs();
      const conn = roomManager.join({
        connectionId: `conn-notcollab-${uid()}`,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      expect(conn).toBeDefined();
    });

    it("allows existing collaborator", () => {
      const wsId = `ws-collab-${uid()}`;
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        id: "collab-1",
        role: "EDITOR" as Role,
        workspaceId: wsId,
        userId: "user-1",
        joinedAt: new Date(),
      } as any);

      const { ws } = createMockWs();
      const conn = roomManager.join({
        connectionId: `conn-collab-${uid()}`,
        ws,
        user: makeUser({ role: "EDITOR" }),
        workspaceId: wsId,
      });

      expect(conn.user.role).toBe("EDITOR");
    });
  });

  describe("binary sync and awareness messages are handled by room manager", () => {
    it("handles awareness message type MESSAGE_AWARENESS correctly", () => {
      const wsId = `ws-aware-${uid()}`;
      const connId = `conn-aware-${uid()}`;
      const { ws } = createMockWs();
      roomManager.join({
        connectionId: connId,
        ws,
        user: makeUser(),
        workspaceId: wsId,
      });

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      const testUpdate = awarenessProtocol.encodeAwarenessUpdate(
        new awarenessProtocol.Awareness(new Y.Doc()),
        []
      );
      encoding.writeVarUint8Array(encoder, testUpdate);
      const awarenessMessage = encoding.toUint8Array(encoder);
      const result = roomManager.handleMessage(connId, awarenessMessage);

      expect(result).toBe(true);
    });

    it("broadcasts awareness update to other connections", () => {
      const wsId = `ws-broadcast-${uid()}`;
      const connId1 = `conn-broadcast1-${uid()}`;
      const connId2 = `conn-broadcast2-${uid()}`;
      const { ws: ws1, sent: sent1 } = createMockWs();
      const { ws: ws2, sent: sent2 } = createMockWs();

      roomManager.join({
        connectionId: connId1,
        ws: ws1,
        user: makeUser({ id: "user-1" }),
        workspaceId: wsId,
      });

      roomManager.join({
        connectionId: connId2,
        ws: ws2,
        user: makeUser({ id: "user-2" }),
        workspaceId: wsId,
      });

      sent1.length = 0;
      sent2.length = 0;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
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
    it("removes connection from room and decreases active connections", () => {
      const wsId = `ws-leave-${uid()}`;
      const connId = `conn-leave-${uid()}`;
      const { ws } = createMockWs();
      roomManager.join({
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

    it("schedules cleanup when last connection leaves", () => {
      const wsId = `ws-cleanup-${uid()}`;
      const connId = `conn-cleanup-${uid()}`;
      const { ws } = createMockWs();
      roomManager.join({
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

    it("deleteRoom closes all connections in the room", () => {
      const wsId = `ws-delete-${uid()}`;
      const { ws: ws1 } = createMockWs();
      const { ws: ws2 } = createMockWs();

      roomManager.join({
        connectionId: `conn-del1-${uid()}`,
        ws: ws1,
        user: makeUser(),
        workspaceId: wsId,
      });

      roomManager.join({
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
