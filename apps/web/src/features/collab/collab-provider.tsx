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
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const logger = createLogger({ name: "collab:provider" });
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_WORKSPACE_DELETED = 3;

// Encode Uint8Array to base64 string in a browser-compatible way
// Uses btoa for browsers, falls back to Buffer for Node environments
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  // Feature-detect Buffer for Node.js environments
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return Buffer.from(uint8Array).toString("base64");
  }

  // Browser-compatible approach: convert bytes to binary string, then base64
  let binaryString = "";
  for (const byte of uint8Array) {
    binaryString += String.fromCharCode(byte);
  }
  return btoa(binaryString);
}

export type CursorPosition = {
  x: number;
  y: number;
  viewportX?: number;
  viewportY?: number;
};

export type OpenDialog = {
  id: string;
  type:
    | "quick-actions"
    | "board-dialog"
    | "column-dialog"
    | "task-dialog"
    | "connection-dialog"
    | "create-task";
  targetId: string;
  dialogType?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
};

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  role: "owner" | "editor" | "viewer";
  cursor?: CursorPosition;
  selection?: string[];
  openDialogs?: OpenDialog[];
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
  updateOpenDialogs: (dialogs: OpenDialog[]) => void;
};

const CollaborationContext = createContext<CollaborationContextType | null>(
  null
);

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16_000, 30_000];
const CURSOR_THROTTLE_MS = 16; // ~60fps for smooth cursor updates - will turn it down if needed

const CURSOR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#06b6d4", // cyan
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    // biome-ignore lint/suspicious/noBitwiseOperators: Hash function requires bitwise operations
    hash = (hash << 5) - hash + char;
    // biome-ignore lint/suspicious/noBitwiseOperators: Hash function requires bitwise operations
    hash &= hash;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length] ?? "#3b82f6";
}

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
  const localUserInfoRef = useRef<{
    id: string;
    name: string;
    color: string;
    role: "owner" | "editor" | "viewer";
  } | null>(null);
  const workspaceDeletedRef = useRef(false);

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
    workspaceDeletedRef.current = false;
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
    // Use Map to deduplicate by user.id - keep only the latest state for each user
    const collaboratorMap = new Map<string, Collaborator>();

    // Get local user ID to filter out own cursor
    const localUserId = localUserInfoRef.current?.id;

    states.forEach((state, clientId) => {
      // Filter out own cursor by both clientID AND userId
      // This handles edge cases where same user has multiple connections
      // or server-side awareness state matches local user
      const isLocalClient = clientId === awareness.clientID;
      const isLocalUser = state.user?.id === localUserId;

      if (state.user && !isLocalClient && !isLocalUser) {
        // Overwrite previous entry for same user - this ensures only 1 cursor per user
        collaboratorMap.set(state.user.id, {
          id: state.user.id,
          name: state.user.name || "Anonymous",
          color: state.user.color || "#888",
          role: state.user.role || "viewer",
          cursor: state.cursor,
          selection: state.selection,
          openDialogs: state.openDialogs,
        });
      }
    });

    const newCollaborators = Array.from(collaboratorMap.values());

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

      const { getJwtToken, authClient } = await import("@/src/lib/auth-client");
      const token = await getJwtToken();
      if (!token) {
        logger.error("Failed to get JWT token for WebSocket");
        setConnectionState("error");
        return;
      }

      const sessionResult = await authClient.getSession();
      const sessionUser = sessionResult.data?.user;
      if (sessionUser) {
        const userColor = getColorForUser(sessionUser.id);
        localUserInfoRef.current = {
          id: sessionUser.id,
          name: sessionUser.name || sessionUser.email || "Anonymous",
          color: userColor,
          role: "editor",
        };
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
      const stateVectorBase64 = uint8ArrayToBase64(stateVector);

      const ws = new WebSocket(
        `${wsUrl}/ws/collab/${workspaceId}?stateVector=${encodeURIComponent(stateVectorBase64)}`
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

        if (localUserInfoRef.current) {
          awareness.setLocalStateField("user", localUserInfoRef.current);
          setLocalUser(localUserInfoRef.current);
        }

        // Immediately broadcast local awareness state to ensure other clients see us
        // This fixes the issue where cursors aren't visible until page refresh
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          [awareness.clientID]
        );
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessUpdate);
        ws.send(encoding.toUint8Array(encoder));

        // Trigger local awareness update handler to sync any existing collaborator state
        handleAwarenessUpdate();
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
              // Use proper sync protocol to handle SyncStep1/SyncStep2/Update messages
              const responseEncoder = encoding.createEncoder();
              encoding.writeVarUint(responseEncoder, MESSAGE_SYNC);
              // This function side-effects by applying updates to the doc.
              // We must call it even if we don't use the return value.
              syncProtocol.readSyncMessage(
                decoder,
                responseEncoder,
                doc,
                "server"
              );

              // Send response if needed (e.g., SyncStep2 in response to SyncStep1)
              if (
                encoding.length(responseEncoder) > 1 &&
                ws.readyState === WebSocket.OPEN
              ) {
                ws.send(encoding.toUint8Array(responseEncoder));
              }

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
              if (messageType === MESSAGE_WORKSPACE_DELETED) {
                logger.warn("Workspace deleted notification received", {
                  workspaceId,
                });
                import("../kanban/store/kanban-store").then(
                  ({ useKanbanStore }) => {
                    const state = useKanbanStore.getState();
                    const workspace = state.workspaces.byId[workspaceId];

                    // Only show "deleted" banner for editors (non-owners)
                    // The owner initiated the delete, so they don't need the banner
                    const isSharedWorkspace = workspace?.isShared === true;

                    if (isSharedWorkspace) {
                      logger.info(
                        "Editor received workspace deleted notification",
                        { workspaceId }
                      );
                      state.markWorkspaceDeleted(workspaceId);
                      state.setDeletedSharedWorkspace(workspaceId);
                    } else {
                      // Owner is deleting their own workspace - no banner needed
                      logger.info(
                        "Owner workspace deletion confirmed by server",
                        { workspaceId }
                      );
                    }
                  }
                );
                // Mark workspace as deleted to prevent reconnect attempts
                workspaceDeletedRef.current = true;
                ws.close();
                setConnectionState("disconnected");
                setIsCollaborating(false);
              } else {
                logger.warn("Unknown message type", { messageType });
              }
              break;
          }
        } catch (error) {
          logger.error("Caught error while handling a Yjs update", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      ws.onclose = (event) => {
        logger.info("WebSocket closed", { workspaceId, code: event.code });
        setConnectionState("disconnected");
        setIsCollaborating(false);

        // Don't reconnect if workspace was deleted
        if (workspaceDeletedRef.current) {
          logger.info("Skipping reconnect - workspace was deleted", {
            workspaceId,
          });
          workspaceDeletedRef.current = false;
          return;
        }

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

      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin === "server" || !ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        // Use proper sync protocol format for sending updates
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        ws.send(encoding.toUint8Array(encoder));
      });

      // Listen for local awareness updates and broadcast to server
      awareness.on(
        "update",
        ({
          added,
          updated,
          removed,
        }: {
          added: number[];
          updated: number[];
          removed: number[];
        }) => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
          }

          const changedClients = [...added, ...updated, ...removed];
          if (changedClients.length === 0) {
            return;
          }

          const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
            awareness,
            changedClients
          );
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(encoder, awarenessUpdate);
          ws.send(encoding.toUint8Array(encoder));
        }
      );
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
      logger.debug("updateCursor: no awareness");
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

  const updateOpenDialogs = useCallback((dialogs: OpenDialog[]) => {
    const awareness = awarenessRef.current;
    if (!awareness) {
      return;
    }

    awareness.setLocalStateField("openDialogs", dialogs);
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
        updateOpenDialogs,
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
