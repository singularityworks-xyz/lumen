/** biome-ignore-all lint/performance/noNamespaceImport: usecase */
import { prisma, type Role } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import {
  recordSpanError,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "@lumen/logger/server";
import {
  assignSafeYjsClientId,
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  MESSAGE_WORKSPACE_DELETED,
  YJS_MAP_NAMES,
} from "@lumen/yjs-shared";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { recordWsRoomJoinDuration } from "./metrics";

const logger = createLogger({ name: "collab:room-manager" });

// biome-ignore lint/performance/noBarrelFile: re-export needed for backward compatibility with existing imports
export { MESSAGE_WORKSPACE_DELETED } from "@lumen/yjs-shared";

export interface CollaboratorInfo {
  color: string;
  email: string;
  id: string;
  image?: string | null;
  name: string;
  role: Role;
}

export interface WsConnection {
  awarenessClientId: number;
  id: string;
  user: CollaboratorInfo;
  workspaceId: string;
  ws: {
    send: (data: Uint8Array) => void;
    close: () => void;
  };
}

interface Room {
  awareness: awarenessProtocol.Awareness;
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
  connections: Map<string, WsConnection>;
  doc: Y.Doc;
  lastModified: number;
  persistenceTimeout: ReturnType<typeof setTimeout> | null;
  workspaceId: string;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly connectionToRoom = new Map<string, string>();
  private readonly persistenceDebounceMs = 5000;
  // Track recently deleted workspaces to prevent recreation during delete
  private readonly deletedWorkspaces = new Set<string>();
  // Track pending room state loads to prevent duplicate Y.applyUpdate calls
  private readonly pendingLoads = new Map<string, Promise<boolean>>();

  getRoom(workspaceId: string): Room | undefined {
    return this.rooms.get(workspaceId);
  }

  isWorkspaceDeleted(workspaceId: string): boolean {
    return this.deletedWorkspaces.has(workspaceId);
  }

  getOrCreateRoom(workspaceId: string): Room {
    return withSpan("room.getOrCreate", () => {
      setSpanAttributes({ workspaceId });

      // Don't recreate rooms for recently deleted workspaces
      if (this.deletedWorkspaces.has(workspaceId)) {
        logger.warn("Attempt to create room for deleted workspace", {
          workspaceId,
        });
        throw new Error("Workspace has been deleted");
      }

      let room = this.rooms.get(workspaceId);
      const isNew = !room;

      if (!room) {
        logger.info("Creating new room", { workspaceId });

        const doc = new Y.Doc();
        assignSafeYjsClientId(doc);
        const awareness = new awarenessProtocol.Awareness(doc);

        doc.getMap(YJS_MAP_NAMES.BOARDS);
        doc.getMap(YJS_MAP_NAMES.COLUMNS);
        doc.getMap(YJS_MAP_NAMES.TASKS);
        doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
        doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS);
        doc.getMap(YJS_MAP_NAMES.AREAS);
        doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS);
        doc.getMap(YJS_MAP_NAMES.WORKSPACE);
        doc.getMap(YJS_MAP_NAMES.COMMENTS);

        const newRoom: Room = {
          workspaceId,
          doc,
          awareness,
          connections: new Map(),
          persistenceTimeout: null,
          cleanupTimeout: null,
          lastModified: Date.now(),
        };

        // Cleanup awareness when connection leaves
        awareness.on("change", (_changes: unknown, origin: unknown) => {
          // Only broadcast if the change didn't originate from a client message
          // (which is already broadcasted efficiently in handleAwarenessMessage)
          if (origin !== "client-update") {
            this.broadcastAwareness(workspaceId);
          }
        });

        // Schedule persistence and fan out canonical updates on doc changes
        doc.on("update", (update: Uint8Array, origin: unknown) => {
          const activeRoom = this.rooms.get(workspaceId) ?? newRoom;
          activeRoom.lastModified = Date.now();

          this.broadcastDocUpdate(activeRoom, update, origin);
          this.schedulePersistence(workspaceId);
        });

        this.rooms.set(workspaceId, newRoom);
        room = newRoom;
      }

      setSpanAttributes({ "room.isNew": isNew });
      return room;
    });
  }

  // Idempotent join - returns existing connection if same client reconnects
  join(options: {
    connectionId: string;
    ws: WsConnection["ws"];
    user: CollaboratorInfo;
    workspaceId: string;
    initialStateVector?: Uint8Array;
  }): Promise<WsConnection> {
    return withSpanAsync("room.join", async () => {
      const joinStartTime = performance.now();
      const { connectionId, ws, user, workspaceId, initialStateVector } =
        options;
      setSpanAttributes({
        connectionId,
        workspaceId,
        userId: user.id,
        role: user.role,
      });

      // Check for existing connection with same connectionId (reconnect scenario)
      const existingRoomId = this.connectionToRoom.get(connectionId);
      if (existingRoomId) {
        const existingRoom = this.rooms.get(existingRoomId);
        const existingConn = existingRoom?.connections.get(connectionId);
        if (existingConn) {
          logger.debug("Reusing existing connection", {
            connectionId,
            workspaceId,
          });
          existingConn.ws = ws;
          setSpanAttributes({ "room.reused": true });
          return existingConn;
        }
      }

      // Role check: viewers can connect and receive, but writes blocked elsewhere
      logger.debug("Client joining room", {
        connectionId,
        workspaceId,
        userId: user.id,
        role: user.role,
        operation: "room.join",
        userName: user.name,
        userEmail: user.email,
      });

      const room = this.getOrCreateRoom(workspaceId);

      // Load persisted state from database if room is fresh (no prior connections and empty doc).
      // This ensures new device logins restore workspace content even when no peers are online.
      // pendingLoads map deduplicates concurrent calls so multiple simultaneous joins only
      // trigger one DB fetch.
      if (room.connections.size === 0) {
        const boardsMap = room.doc.getMap(YJS_MAP_NAMES.BOARDS);
        if (boardsMap.size === 0) {
          await this.loadRoomState(workspaceId);
        }
      }

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

      // Cancel any scheduled cleanup since room is now active
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        room.cleanupTimeout = null;
      }

      room.connections.set(connectionId, connection);
      this.connectionToRoom.set(connectionId, workspaceId);

      // NOTE: We don't set awareness state on the server-side anymore.
      // The server acts as a relay - clients send their own awareness states.
      // Setting awareness here would use the server's clientID which is wrong.
      // Each client manages their own awareness state with their unique clientID.
      // Send initial sync (document state + existing awareness states)
      this.sendSyncStep1(connection, room, initialStateVector);
      // Broadcast awareness update to ALL clients (excluding the new one since they got it in step 1)
      // so everyone can see everyone else's cursor immediately
      this.broadcastAwareness(workspaceId);

      setSpanAttributes({
        "room.connections": room.connections.size,
        "room.reused": false,
      });
      const joinDurationSeconds = (performance.now() - joinStartTime) / 1000;
      recordWsRoomJoinDuration(joinDurationSeconds, {
        workspaceId,
        userId: user.id,
        connectionId,
      });

      logger.debug("Client joined room", {
        connectionId,
        workspaceId,
        userId: user.id,
        role: user.role,
        operation: "room.join.complete",
        totalConnections: room.connections.size,
        userName: user.name,
        userEmail: user.email,
      });

      return connection;
    });
  }

  leave(connectionId: string): void {
    withSpan("room.leave", () => {
      const workspaceId = this.connectionToRoom.get(connectionId);
      if (!workspaceId) {
        return;
      }

      setSpanAttributes({ connectionId, workspaceId });

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

      setSpanAttributes({ "room.remainingConnections": room.connections.size });
      logger.debug("Client left room", {
        connectionId,
        workspaceId,
        remainingConnections: room.connections.size,
      });

      if (room.connections.size === 0) {
        this.scheduleRoomCleanup(workspaceId);
      }
    });
  }

  handleMessage(connectionId: string, message: Uint8Array): boolean {
    return withSpan("room.handleMessage", (span) => {
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

      setSpanAttributes({
        connectionId,
        workspaceId,
        messageSize: message.byteLength,
      });

      try {
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);
        setSpanAttributes({ messageType });

        switch (messageType) {
          case MESSAGE_SYNC:
            return this.handleSyncMessage(connection, room, decoder);
          case MESSAGE_AWARENESS:
            return this.handleAwarenessMessage(connection, room, decoder);
          default:
            logger.warn("Unknown message type", { messageType, connectionId });
            return false;
        }
      } catch (error) {
        recordSpanError(span, error);
        logger.error("Failed to handle message", {
          connectionId,
          workspaceId,
          userId: connection?.user?.id,
          operation: "message.handle",
          error: {
            type: "message_processing_error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          messageLength: message.byteLength,
        });
        return false;
      }
    });
  }

  private handleSyncMessage(
    connection: WsConnection,
    room: Room,
    decoder: decoding.Decoder
  ): boolean {
    return withSpan("room.sync", () => {
      // Peek at the sync message type WITHOUT consuming it
      // The first byte after MESSAGE_SYNC is the sync protocol message type
      const syncMsgType = decoding.peekVarUint(decoder);
      const isWrite =
        syncMsgType === syncProtocol.messageYjsSyncStep2 ||
        syncMsgType === syncProtocol.messageYjsUpdate;

      setSpanAttributes({
        connectionId: connection.id,
        syncMsgType,
        isWrite,
      });

      // SyncStep2 and Update contain changes - check write permission for viewers
      if (isWrite && connection.user.role === "VIEWER") {
        logger.warn("Viewer attempted write operation", {
          connectionId: connection.id,
          userId: connection.user.id,
          syncMsgType,
        });
        return false;
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);

      let syncReadErrorMessage: string | null = null;

      // readSyncMessage will read the message type and handle the sync protocol
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        room.doc,
        connection,
        (error) => {
          syncReadErrorMessage = error.message;
        }
      );

      if (syncReadErrorMessage !== null) {
        logger.error("Failed to apply sync update", {
          connectionId: connection.id,
          workspaceId: room.workspaceId,
          userId: connection.user.id,
          syncMsgType,
          error: syncReadErrorMessage,
        });
        return false;
      }

      if (encoding.length(encoder) > 1) {
        connection.ws.send(encoding.toUint8Array(encoder));
      }

      setSpanAttributes({ syncMessageType });

      return true;
    });
  }

  private broadcastDocUpdate(
    room: Room,
    update: Uint8Array,
    origin: unknown
  ): void {
    let excludeConnectionId: string | null = null;

    if (
      typeof origin === "object" &&
      origin !== null &&
      "id" in origin &&
      typeof (origin as { id: unknown }).id === "string"
    ) {
      excludeConnectionId = (origin as { id: string }).id;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    room.connections.forEach((conn, connId) => {
      if (excludeConnectionId === null || connId !== excludeConnectionId) {
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

  private handleAwarenessMessage(
    connection: WsConnection,
    room: Room,
    decoder: decoding.Decoder
  ): boolean {
    return withSpan("room.awareness", () => {
      setSpanAttributes({ connectionId: connection.id });

      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        update,
        "client-update"
      );

      // Explicitly broadcast awareness updates to other clients
      // The awareness.on('change') listener also broadcasts, but this ensures
      // immediate propagation of cursor updates without waiting for change processing
      this.broadcastAwarenessToOthers(room, connection.id, update);

      return true;
    });
  }

  // Broadcast awareness update to all clients except sender
  private broadcastAwarenessToOthers(
    room: Room,
    excludeConnectionId: string,
    update: Uint8Array
  ): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [connId, conn] of room.connections.entries()) {
      if (connId !== excludeConnectionId) {
        try {
          conn.ws.send(message);
        } catch (error) {
          logger.error("Failed to broadcast awareness to connection", {
            connectionId: connId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }
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
    const awarenessMessage = encoding.toUint8Array(awarenessEncoder);
    connection.ws.send(awarenessMessage);
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

  persistRoom(workspaceId: string): Promise<void> {
    return withSpanAsync("room.persist", async (span) => {
      const room = this.rooms.get(workspaceId);
      if (!room) {
        return;
      }

      setSpanAttributes({ workspaceId });

      try {
        // First check if workspace exists in DB - don't persist if it doesn't
        const workspaceExists = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true },
        });

        if (!workspaceExists) {
          logger.debug("Skipping persistence - workspace not in DB", {
            workspaceId,
          });
          setSpanAttributes({ "room.persistence.skipped": true });
          return;
        }

        const state = Y.encodeStateAsUpdate(room.doc);
        const stateVector = Y.encodeStateVector(room.doc);

        const entityCounts = {
          boards: room.doc.getMap(YJS_MAP_NAMES.BOARDS).size,
          columns: room.doc.getMap(YJS_MAP_NAMES.COLUMNS).size,
          tasks: room.doc.getMap(YJS_MAP_NAMES.TASKS).size,
          boardPositions: room.doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).size,
          boardConnections: room.doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS)
            .size,
          areas: room.doc.getMap(YJS_MAP_NAMES.AREAS).size,
          areaPositions: room.doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS).size,
          comments: room.doc.getMap(YJS_MAP_NAMES.COMMENTS).size,
        };

        setSpanAttributes({
          stateSize: state.length,
          stateVectorSize: stateVector.length,
          "room.entityCounts.boards": entityCounts.boards,
          "room.entityCounts.columns": entityCounts.columns,
          "room.entityCounts.tasks": entityCounts.tasks,
        });

        logger.debug("Persisting room state", {
          workspaceId,
          operation: "room.persist",
          stateSize: state.length,
          stateVectorSize: stateVector.length,
          entityCounts,
          connections: room.connections.size,
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

        // Also update the Workspace metadata table if the name is available in Yjs
        const workspaceMap = room.doc.getMap(YJS_MAP_NAMES.WORKSPACE);
        const workspaceData = workspaceMap.get(workspaceId) as
          | { name: string }
          | undefined;

        if (workspaceData?.name) {
          try {
            await prisma.workspace.update({
              where: { id: workspaceId },
              data: { name: workspaceData.name },
            });
          } catch (err) {
            // Ignore error if workspace doesn't exist yet (handled elsewhere) or other race conditions
            logger.debug("Could not update workspace name metadata", {
              workspaceId,
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        }

        logger.debug("Room state persisted successfully", { workspaceId });
      } catch (error) {
        recordSpanError(span, error);
        logger.error("Failed to persist room state", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  loadRoomState(workspaceId: string): Promise<boolean> {
    // Check if a load is already in progress for this workspace
    const existingLoad = this.pendingLoads.get(workspaceId);
    if (existingLoad) {
      logger.debug("Returning existing loadRoomState promise", { workspaceId });
      return existingLoad;
    }

    // Create and store the load promise
    const loadPromise = withSpanAsync("room.loadState", async (span) => {
      setSpanAttributes({ workspaceId });

      try {
        const stored = await prisma.workspaceState.findUnique({
          where: { workspaceId },
        });
        if (stored?.yjsState) {
          if (stored.yjsState.length === 0) {
            logger.warn("Stored Yjs state is empty", { workspaceId });
            setSpanAttributes({
              "room.state.loaded": false,
              "room.state.empty": true,
            });
            return false;
          }

          try {
            const room = this.getOrCreateRoom(workspaceId);
            Y.applyUpdate(room.doc, new Uint8Array(stored.yjsState));

            const entityCounts = {
              boards: room.doc.getMap(YJS_MAP_NAMES.BOARDS).size,
              columns: room.doc.getMap(YJS_MAP_NAMES.COLUMNS).size,
              tasks: room.doc.getMap(YJS_MAP_NAMES.TASKS).size,
              boardPositions: room.doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS)
                .size,
              boardConnections: room.doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS)
                .size,
              areas: room.doc.getMap(YJS_MAP_NAMES.AREAS).size,
              areaPositions: room.doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS).size,
              comments: room.doc.getMap(YJS_MAP_NAMES.COMMENTS).size,
            };

            setSpanAttributes({
              stateSize: stored.yjsState.length,
              "room.state.loaded": true,
            });

            logger.info("Loaded room state from database", {
              workspaceId,
              stateSize: stored.yjsState.length,
              entityCounts,
            });
            return true;
          } catch (error) {
            recordSpanError(span, error);
            logger.error("Failed to apply stored Yjs state", {
              workspaceId,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            // We return false here so the caller knows state loading failed.
            // Maybe we should start with a fresh room instead?
            // For now, let's treat it as if no state existed, so a fresh doc is used.
            return false;
          }
        }

        setSpanAttributes({
          "room.state.loaded": false,
          "room.state.notFound": true,
        });
        logger.debug("No stored state found for workspace", { workspaceId });
        return false;
      } catch (error) {
        recordSpanError(span, error);
        logger.error("Failed to load room state", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      }
    }).finally(() => {
      // Always remove from pending loads when done
      this.pendingLoads.delete(workspaceId);
    });

    // Store the promise to prevent duplicate loads
    this.pendingLoads.set(workspaceId, loadPromise);

    return loadPromise;
  }

  scheduleRoomCleanup(workspaceId: string): void {
    const currentRoom = this.rooms.get(workspaceId);
    if (!currentRoom) {
      return;
    }

    // Clear any existing cleanup timeout before scheduling a new one
    if (currentRoom.cleanupTimeout) {
      clearTimeout(currentRoom.cleanupTimeout);
    }

    // Store the timeout ID so it can be cancelled if room becomes active
    currentRoom.cleanupTimeout = setTimeout(async () => {
      const room = this.rooms.get(workspaceId);
      if (room && room.connections.size === 0) {
        await this.persistRoom(workspaceId);
        if (room.persistenceTimeout) {
          clearTimeout(room.persistenceTimeout);
        }
        room.doc.destroy();
        this.rooms.delete(workspaceId);

        logger.debug("Room cleaned up", { workspaceId });
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

  deleteRoom(workspaceId: string): void {
    withSpan("room.delete", () => {
      const room = this.rooms.get(workspaceId);
      const connectionCount = room?.connections.size ?? 0;

      setSpanAttributes({ workspaceId, connectionCount });

      // Mark as deleted before doing anything else to prevent race conditions
      this.deletedWorkspaces.add(workspaceId);
      // Clean up the tracking after 30 seconds to prevent memory leaks
      setTimeout(() => {
        this.deletedWorkspaces.delete(workspaceId);
      }, 30_000);

      if (!room) {
        logger.info("Room already deleted or never existed", { workspaceId });
        return;
      }

      // Broadcast deleted message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_WORKSPACE_DELETED);
      const message = encoding.toUint8Array(encoder);

      for (const conn of room.connections.values()) {
        try {
          conn.ws.send(message);
          conn.ws.close();
        } catch (error) {
          logger.error("Failed to notify connection of deletion", {
            connectionId: conn.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      if (room.persistenceTimeout) {
        clearTimeout(room.persistenceTimeout);
      }
      room.doc.destroy();
      this.rooms.delete(workspaceId);

      logger.info("Room deleted", { workspaceId });
    });
  }

  /** Clears the internal deleted-workspaces tracking set.
   *  Intended for test cleanup or controlled maintenance — not part of
   *  regular production flow. Resets deletion-tracking state visible to
   *  methods that rely on deletedWorkspaces. */
  clearDeletedWorkspaces(): void {
    this.deletedWorkspaces.clear();
  }

  /** Resets all internal state — intended for test isolation only.
   *  Destroys all active Yjs docs, clears connection tracking, cancels
   *  pending persistence timeouts, and resets deleted-workspace tracking. */
  reset(): void {
    for (const [, room] of this.rooms) {
      if (room.persistenceTimeout) {
        clearTimeout(room.persistenceTimeout);
      }
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
      }
      room.doc.destroy();
    }
    this.rooms.clear();
    this.connectionToRoom.clear();
    this.deletedWorkspaces.clear();
    this.pendingLoads.clear();
  }
}

export const roomManager = new RoomManager();
