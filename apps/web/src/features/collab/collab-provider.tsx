/** biome-ignore-all lint/performance/noNamespaceImport: usecase */
"use client";

import { createLogger } from "@lumen/logger";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";

const logger = createLogger({ name: "collab:provider" });
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export type CursorPosition = {
  x: number;
  y: number;
  viewportX?: number;
  viewportY?: number;
};

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  role: "owner" | "editor" | "viewer";
  cursor?: CursorPosition;
  selection?: string[];
};

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type CollaborationContextType = {
  doc: Y.Doc | null;
  awareness: awarenessProtocol.Awareness | null;
  connectionState: ConnectionState;
  collaborators: Collaborator[];
  isCollaborating: boolean;
  localUser: Collaborator | null;
  connect: (workspaceId: string) => void;
  disconnect: () => void;
  updateCursor: (position: CursorPosition | null) => void;
  updateSelection: (selectedIds: string[]) => void;
};

const CollaborationContext = createContext<CollaborationContextType | null>(
  null
);

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16_000, 30_000];
const CURSOR_THROTTLE_MS = 50;

type CollaborationProviderProps = {
  children: ReactNode;
  apiUrl?: string;
  enabled?: boolean;
};

export function CollaborationProvider({
  children,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  enabled = true,
}: CollaborationProviderProps) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [localUser, setLocalUser] = useState<Collaborator | null>(null);
  const [isCollaborating, setIsCollaborating] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastCursorUpdateRef = useRef(0);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (persistenceRef.current) {
      persistenceRef.current.destroy();
      persistenceRef.current = null;
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
      awarenessRef.current = null;
    }
    if (docRef.current) {
      docRef.current.destroy();
      docRef.current = null;
    }
    workspaceIdRef.current = null;
    setConnectionState("disconnected");
    setCollaborators([]);
    setLocalUser(null);
    setIsCollaborating(false);
  }, []);

  const handleAwarenessUpdate = useCallback(() => {
    const awareness = awarenessRef.current;
    if (!awareness) {
      return;
    }

    const states = awareness.getStates();
    const newCollaborators: Collaborator[] = [];

    states.forEach((state, clientId) => {
      if (state.user && clientId !== awareness.clientID) {
        newCollaborators.push({
          id: state.user.id,
          name: state.user.name || "Anonymous",
          color: state.user.color || "#888",
          role: state.user.role || "viewer",
          cursor: state.cursor,
          selection: state.selection,
        });
      }
    });

    setCollaborators(newCollaborators);
  }, []);

  const connect = useCallback(
    async (workspaceId: string) => {
      if (!enabled) {
        return;
      }

      cleanup();
      workspaceIdRef.current = workspaceId;

      logger.info("Connecting to workspace", { workspaceId });
      setConnectionState("connecting");

      const { getJwtToken } = await import("@/src/lib/auth-client");
      const token = await getJwtToken();
      if (!token) {
        logger.error("Failed to get JWT token for WebSocket");
        setConnectionState("error");
        return;
      }

      const doc = new Y.Doc();
      docRef.current = doc;

      const awareness = new awarenessProtocol.Awareness(doc);
      awarenessRef.current = awareness;

      awareness.on("change", handleAwarenessUpdate);

      const persistence = new IndexeddbPersistence(
        `lumen-collab-${workspaceId}`,
        doc
      );
      persistenceRef.current = persistence;

      persistence.on("synced", () => {
        logger.info("Synced with IndexedDB", { workspaceId });
      });

      // biome-ignore lint/performance/useTopLevelRegex: nah
      const wsUrl = apiUrl.replace(/^http/, "ws");
      const stateVector = Y.encodeStateVector(doc);
      const stateVectorBase64 = Buffer.from(stateVector).toString("base64");

      const ws = new WebSocket(
        `${wsUrl}/ws/collab/${workspaceId}?token=${encodeURIComponent(token)}&stateVector=${encodeURIComponent(stateVectorBase64)}`
      );
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      logger.info("Attempting WebSocket connection", {
        url: `${wsUrl}/ws/collab/${workspaceId}`,
      });

      ws.onopen = () => {
        logger.info("WebSocket connected", { workspaceId });
        setConnectionState("connected");
        setIsCollaborating(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          if (data.byteLength === 0) {
            return;
          }

          const decoder = decoding.createDecoder(data);
          const messageType = decoding.readVarUint(decoder);

          switch (messageType) {
            case MESSAGE_SYNC: {
              const update = decoding.readVarUint8Array(decoder);
              Y.applyUpdate(doc, update, "server");
              logger.debug("Applied sync update from server", {
                updateSize: update.length,
              });
              break;
            }
            case MESSAGE_AWARENESS: {
              const awarenessUpdate = decoding.readVarUint8Array(decoder);
              awarenessProtocol.applyAwarenessUpdate(
                awareness,
                awarenessUpdate,
                "server"
              );
              break;
            }
            default:
              logger.warn("Unknown message type", { messageType });
              break;
          }
        } catch (error) {
          logger.error("Failed to handle WebSocket message", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      ws.onclose = (event) => {
        logger.info("WebSocket closed", { workspaceId, code: event.code });
        setConnectionState("disconnected");
        setIsCollaborating(false);

        if (workspaceIdRef.current === workspaceId) {
          const delay =
            RECONNECT_DELAYS[
              Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
            ];
          reconnectAttemptRef.current += 1;

          logger.info("Scheduling reconnect", {
            delay,
            attempt: reconnectAttemptRef.current,
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            if (workspaceIdRef.current === workspaceId) {
              connect(workspaceId);
            }
          }, delay);
        }
      };

      ws.onerror = (error) => {
        logger.error("WebSocket error", { error });
        setConnectionState("error");
      };

      // Listen for local doc updates and send to server
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin === "server" || !ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        encoding.writeVarUint8Array(encoder, update);
        ws.send(encoding.toUint8Array(encoder));
      });
    },
    [enabled, apiUrl, cleanup, handleAwarenessUpdate]
  );

  const disconnect = useCallback(() => {
    logger.info("Disconnecting", { workspaceId: workspaceIdRef.current });
    cleanup();
  }, [cleanup]);

  const updateCursor = useCallback((position: CursorPosition | null) => {
    const awareness = awarenessRef.current;
    if (!awareness) {
      return;
    }

    const now = Date.now();
    if (now - lastCursorUpdateRef.current < CURSOR_THROTTLE_MS) {
      return;
    }
    lastCursorUpdateRef.current = now;

    awareness.setLocalStateField("cursor", position);
  }, []);

  const updateSelection = useCallback((selectedIds: string[]) => {
    const awareness = awarenessRef.current;
    if (!awareness) {
      return;
    }

    awareness.setLocalStateField("selection", selectedIds);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  return (
    <CollaborationContext.Provider
      value={{
        doc: docRef.current,
        awareness: awarenessRef.current,
        connectionState,
        collaborators,
        isCollaborating,
        localUser,
        connect,
        disconnect,
        updateCursor,
        updateSelection,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration(): CollaborationContextType {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error(
      "useCollaboration must be used within CollaborationProvider"
    );
  }
  return context;
}
