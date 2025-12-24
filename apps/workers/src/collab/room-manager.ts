/** biome-ignore-all lint/performance/noNamespaceImport: usecase */
import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const logger = createLogger({ name: "collab:room-manager" });
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export type CollaboratorInfo = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "owner" | "editor" | "viewer";
  color: string;
};

export type WsConnection = {
  id: string;
  ws: {
    send: (data: Uint8Array) => void;
    close: () => void;
  };
  user: CollaboratorInfo;
  workspaceId: string;
  awarenessClientId: number;
};

type Room = {
  workspaceId: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  connections: Map<string, WsConnection>;
  persistenceTimeout: ReturnType<typeof setTimeout> | null;
  lastModified: number;
};

class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly connectionToRoom = new Map<string, string>();
  private readonly persistenceDebounceMs = 5000;

  getRoom(workspaceId: string): Room | undefined {
    return this.rooms.get(workspaceId);
  }

  getOrCreateRoom(workspaceId: string): Room {
    let room = this.rooms.get(workspaceId);

    if (!room) {
      logger.info("Creating new room", { workspaceId });

      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);

      doc.getMap("boards");
      doc.getMap("columns");
      doc.getMap("tasks");
      doc.getMap("boardPositions");
      doc.getMap("boardConnections");
      doc.getMap("areas");
      doc.getMap("areaPositions");
      doc.getMap("workspace");

      room = {
        workspaceId,
        doc,
        awareness,
        connections: new Map(),
        persistenceTimeout: null,
        lastModified: Date.now(),
      };

      // Cleanup awareness when connection leaves
      awareness.on("change", () => {
        this.broadcastAwareness(workspaceId);
      });

      // Schedule persistence on doc updates
      doc.on("update", () => {
        const currentRoom = this.rooms.get(workspaceId);
        if (currentRoom) {
          currentRoom.lastModified = Date.now();
        }
        this.schedulePersistence(workspaceId);
      });

      this.rooms.set(workspaceId, room);
    }

    return room;
  }

  // Idempotent join - returns existing connection if same client reconnects
  join(options: {
    connectionId: string;
    ws: WsConnection["ws"];
    user: CollaboratorInfo;
    workspaceId: string;
    initialStateVector?: Uint8Array;
  }): WsConnection {
    const { connectionId, ws, user, workspaceId, initialStateVector } = options;
    // Check for existing connection with same connectionId (reconnect scenario)
    const existingRoomId = this.connectionToRoom.get(connectionId);
    if (existingRoomId) {
      const existingRoom = this.rooms.get(existingRoomId);
      const existingConn = existingRoom?.connections.get(connectionId);
      if (existingConn) {
        logger.info("Reusing existing connection", {
          connectionId,
          workspaceId,
        });
        existingConn.ws = ws;
        return existingConn;
      }
    }

    // Role check: viewers can connect and receive, but writes blocked elsewhere
    logger.info("Client joining room", {
      connectionId,
      workspaceId,
      userId: user.id,
      role: user.role,
    });

    const room = this.getOrCreateRoom(workspaceId);

    // Generate unique awareness client ID
    const awarenessClientId = Math.floor(
      Math.random() * Number.MAX_SAFE_INTEGER
    );

    const connection: WsConnection = {
      id: connectionId,
      ws,
      user,
      workspaceId,
      awarenessClientId,
    };

    room.connections.set(connectionId, connection);
    this.connectionToRoom.set(connectionId, workspaceId);

    // Set awareness state for this user
    room.awareness.setLocalStateField("user", {
      id: user.id,
      name: user.name,
      color: user.color,
      role: user.role,
    });

    // Send initial sync
    this.sendSyncStep1(connection, room, initialStateVector);

    logger.info("Client joined room", {
      connectionId,
      workspaceId,
      totalConnections: room.connections.size,
    });

    return connection;
  }

  leave(connectionId: string): void {
    const workspaceId = this.connectionToRoom.get(connectionId);
    if (!workspaceId) {
      return;
    }

    const room = this.rooms.get(workspaceId);
    if (!room) {
      return;
    }

    const connection = room.connections.get(connectionId);
    if (connection) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [connection.awarenessClientId],
        "client left"
      );
    }

    room.connections.delete(connectionId);
    this.connectionToRoom.delete(connectionId);

    logger.info("Client left room", {
      connectionId,
      workspaceId,
      remainingConnections: room.connections.size,
    });

    if (room.connections.size === 0) {
      this.scheduleRoomCleanup(workspaceId);
    }
  }

  handleMessage(connectionId: string, message: Uint8Array): boolean {
    const workspaceId = this.connectionToRoom.get(connectionId);
    if (!workspaceId) {
      return false;
    }

    const room = this.rooms.get(workspaceId);
    if (!room) {
      return false;
    }

    const connection = room.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC:
        return this.handleSyncMessage(connection, room, decoder, message);
      case MESSAGE_AWARENESS:
        return this.handleAwarenessMessage(connection, room, decoder);
      default:
        logger.warn("Unknown message type", { messageType, connectionId });
        return false;
    }
  }

  private handleSyncMessage(
    connection: WsConnection,
    room: Room,
    decoder: decoding.Decoder,
    originalMessage: Uint8Array
  ): boolean {
    // Role check for write operations
    const messageType = decoding.readVarUint(decoder);

    // SyncStep2 contains updates - check write permission
    if (
      messageType === syncProtocol.messageYjsSyncStep2 &&
      connection.user.role === "viewer"
    ) {
      logger.warn("Viewer attempted write operation", {
        connectionId: connection.id,
        userId: connection.user.id,
      });
      return false;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);

    const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      room.doc,
      connection
    );

    if (encoding.length(encoder) > 1) {
      connection.ws.send(encoding.toUint8Array(encoder));
    }

    // Broadcast updates to other clients
    if (
      syncMessageType === syncProtocol.messageYjsSyncStep2 ||
      syncMessageType === syncProtocol.messageYjsUpdate
    ) {
      this.broadcastUpdate(room, connection.id, originalMessage);
    }

    return true;
  }

  private handleAwarenessMessage(
    connection: WsConnection,
    room: Room,
    decoder: decoding.Decoder
  ): boolean {
    const update = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, connection);
    return true;
  }

  // Send initial sync (step 1) and optionally step 2 if state vector provided
  private sendSyncStep1(
    connection: WsConnection,
    room: Room,
    initialStateVector?: Uint8Array
  ): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    connection.ws.send(encoding.toUint8Array(encoder));

    // If client provided state vector, send step 2 with delta
    if (initialStateVector) {
      const encoder2 = encoding.createEncoder();
      encoding.writeVarUint(encoder2, MESSAGE_SYNC);
      syncProtocol.writeSyncStep2(encoder2, room.doc, initialStateVector);
      connection.ws.send(encoding.toUint8Array(encoder2));
    }

    // Send awareness state
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(room.awareness.getStates().keys())
      )
    );
    connection.ws.send(encoding.toUint8Array(awarenessEncoder));
  }

  // Broadcast document update to all clients except sender
  private broadcastUpdate(
    room: Room,
    excludeConnectionId: string,
    message: Uint8Array
  ): void {
    room.connections.forEach((conn, connId) => {
      if (connId !== excludeConnectionId) {
        try {
          conn.ws.send(message);
        } catch (error) {
          logger.error("Failed to broadcast to connection", {
            connectionId: connId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    });
  }

  // Broadcast awareness update to all clients
  private broadcastAwareness(workspaceId: string): void {
    const room = this.rooms.get(workspaceId);
    if (!room) {
      return;
    }

    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      room.awareness,
      Array.from(room.awareness.getStates().keys())
    );

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    const message = encoding.toUint8Array(encoder);

    for (const conn of room.connections.values()) {
      try {
        conn.ws.send(message);
      } catch (error) {
        logger.error("Failed to broadcast awareness", {
          connectionId: conn.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  private schedulePersistence(workspaceId: string): void {
    const room = this.rooms.get(workspaceId);
    if (!room) {
      return;
    }

    if (room.persistenceTimeout) {
      clearTimeout(room.persistenceTimeout);
    }

    room.persistenceTimeout = setTimeout(() => {
      this.persistRoom(workspaceId);
    }, this.persistenceDebounceMs);
  }

  async persistRoom(workspaceId: string): Promise<void> {
    const room = this.rooms.get(workspaceId);
    if (!room) {
      return;
    }

    try {
      const state = Y.encodeStateAsUpdate(room.doc);
      const stateVector = Y.encodeStateVector(room.doc);

      logger.info("Persisting room state", {
        workspaceId,
        stateSize: state.length,
        stateVectorSize: stateVector.length,
      });

      await prisma.workspaceState.upsert({
        where: { workspaceId },
        update: {
          yjsState: Buffer.from(state),
          stateVector: Buffer.from(stateVector),
        },
        create: {
          workspaceId,
          yjsState: Buffer.from(state),
          stateVector: Buffer.from(stateVector),
        },
      });
    } catch (error) {
      logger.error("Failed to persist room state", {
        workspaceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async loadRoomState(workspaceId: string): Promise<boolean> {
    try {
      const stored = await prisma.workspaceState.findUnique({
        where: { workspaceId },
      });
      if (stored?.yjsState) {
        const room = this.getOrCreateRoom(workspaceId);
        Y.applyUpdate(room.doc, new Uint8Array(stored.yjsState));
        logger.info("Loaded room state from database", { workspaceId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Failed to load room state", {
        workspaceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  private scheduleRoomCleanup(workspaceId: string): void {
    setTimeout(async () => {
      const room = this.rooms.get(workspaceId);
      if (room && room.connections.size === 0) {
        // Persist before cleanup
        await this.persistRoom(workspaceId);

        // Clear timeout
        if (room.persistenceTimeout) {
          clearTimeout(room.persistenceTimeout);
        }

        // Cleanup
        room.doc.destroy();
        this.rooms.delete(workspaceId);

        logger.info("Room cleaned up", { workspaceId });
      }
    }, 30_000);
  }

  getRoomStats(workspaceId: string): {
    connections: number;
    lastModified: number;
  } | null {
    const room = this.rooms.get(workspaceId);
    if (!room) {
      return null;
    }

    return {
      connections: room.connections.size,
      lastModified: room.lastModified,
    };
  }

  getCollaborators(workspaceId: string): CollaboratorInfo[] {
    const room = this.rooms.get(workspaceId);
    if (!room) {
      return [];
    }

    return Array.from(room.connections.values()).map((conn) => conn.user);
  }
}

export const roomManager = new RoomManager();
