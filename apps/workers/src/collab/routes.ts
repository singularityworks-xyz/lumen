import { prisma, type Role } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import {
  recordSpanError,
  setSpanAttributes,
  withSpan,
  withSpanAsync,
} from "@lumen/logger/server";
import { Elysia, t } from "elysia";
import * as Y from "yjs";
import { auth } from "../auth/config/auth";
import { env } from "../env";
import { toHeaders } from "../utils/headers";
import {
  addCollaborator,
  checkWorkspaceExistence,
  createShareToken,
  generateId,
  getCollaborator,
  getColorForUser,
  getShareInfo,
  getWorkspaceCollaboratorCount,
  getWorkspaceName,
  revokeGuestShareToken,
} from "./helpers";
import {
  decrementActiveConnections,
  incrementActiveConnections,
  recordWsConnectionError,
  recordWsConnectionLatency,
  recordWsMessage,
} from "./metrics";
import { getWorkspacePresence } from "./presence-client";
import { type CollaboratorInfo, roomManager } from "./room-manager";

const logger = createLogger({ name: "collab:routes" });

interface WsData {
  __pendingAuth?: PendingAuthEntry;
  collaborator?: { role: Role };
  connectionId?: string;
  connectionStartTime?: number;
  initialStateVector?: Uint8Array;
  joinPromise?: Promise<void>;
  params: { workspaceId: string };
  query: { stateVector?: string };
  queuedMessages?: Uint8Array[];
  user?: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

// Auth data structure for pending authentication
interface PendingAuthEntry {
  collaborator: { role: Role };
  connectionId: string;
  connectionStartTime: number;
  initialStateVector?: Uint8Array;
  timestamp: number;
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

export const collabRoutes = new Elysia({ name: "collab-routes" })
  .ws("/ws/collab/:workspaceId", {
    body: t.Any(),
    params: t.Object({
      workspaceId: t.String(),
    }),
    query: t.Object({
      token: t.Optional(t.String()),
      guestToken: t.Optional(t.String()),
      stateVector: t.Optional(t.String()),
    }),

    beforeHandle(context) {
      return withSpanAsync("ws.auth", async () => {
        const { params, headers, set, query } = context;
        const { workspaceId } = params;
        const { token, guestToken } = query;
        const authMethod = guestToken
          ? "guest"
          : token?.startsWith("guest_")
            ? "guest"
            : token
              ? "jwt"
              : "session";
        const wsContext = context as typeof context & {
          __pendingAuth?: PendingAuthEntry;
        };

        setSpanAttributes({ workspaceId, authMethod });

        logger.debug("WebSocket beforeHandle starting", {
          workspaceId,
          hasToken: !!token,
          hasGuestToken: !!guestToken,
        });

        // Immediately reject if workspace was recently deleted
        if (roomManager.isWorkspaceDeleted(workspaceId)) {
          logger.warn("WebSocket connection rejected - workspace deleted", {
            workspaceId,
          });
          set.status = 410;
          return {
            error: "Gone",
            message: "Workspace has been deleted",
          };
        }

        // Handle guest token (public read-only viewer)
        const effectiveGuestToken =
          guestToken || (token?.startsWith("guest_") ? token : undefined);
        if (effectiveGuestToken) {
          const share = await prisma.workspaceShare.findUnique({
            where: { token: effectiveGuestToken },
          });

          if (!share || share.workspaceId !== workspaceId) {
            logger.warn("Invalid guest token for workspace", {
              workspaceId,
              token: effectiveGuestToken,
            });
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Invalid guest share token",
            };
          }

          if (share.expiresAt && share.expiresAt < new Date()) {
            logger.warn("Guest share token expired", {
              workspaceId,
              token: effectiveGuestToken,
            });
            set.status = 410;
            return {
              error: "Gone",
              message: "Guest share link has expired",
            };
          }

          let initialStateVector: Uint8Array | undefined;
          if (query.stateVector) {
            try {
              initialStateVector = new Uint8Array(
                Buffer.from(query.stateVector, "base64")
              );
            } catch {
              logger.warn("Invalid state vector in query", { workspaceId });
            }
          }

          const connectionId = generateId(16);
          const authEntry: PendingAuthEntry = {
            user: {
              id: `guest-${connectionId}`,
              name: "Guest Viewer",
              email: "guest@lumen.local",
              image: undefined,
            },
            collaborator: { role: "VIEWER" },
            initialStateVector,
            connectionId,
            timestamp: Date.now(),
            connectionStartTime: performance.now(),
          };
          wsContext.__pendingAuth = authEntry;

          logger.info("Guest WebSocket authenticated successfully", {
            workspaceId,
            connectionId,
          });
          return;
        }

        if (token) {
          try {
            const { createRemoteJWKSet, jwtVerify } = await import("jose");
            const baseUrl = env.BETTER_AUTH_URL;
            const JWKS = createRemoteJWKSet(
              new URL(`${baseUrl}/api/auth/jwks`)
            );

            const { payload } = await jwtVerify(token, JWKS, {
              issuer: baseUrl,
              audience: baseUrl,
            });

            if (!payload.sub) {
              logger.warn("JWT missing sub claim", { workspaceId });
              set.status = 401;
              return { error: "Unauthorized", message: "Invalid JWT token" };
            }

            const userId = payload.sub;
            let collab = await getCollaborator(workspaceId, userId);

            if (!collab) {
              const count = await getWorkspaceCollaboratorCount(workspaceId);
              if (count === 0) {
                // Only auto-assign if workspace actually exists (has state, shares, etc.)
                // This prevents creating entries for orphaned workspace IDs stored in client localStorage
                const exists = await checkWorkspaceExistence(workspaceId);
                if (!exists) {
                  logger.warn(
                    "WebSocket connection to non-existent workspace",
                    {
                      workspaceId,
                      userId,
                    }
                  );
                  set.status = 404;
                  return {
                    error: "Not Found",
                    message: "Workspace does not exist",
                  };
                }
                await addCollaborator(workspaceId, userId, "OWNER");
                collab = { role: "OWNER" };
                logger.info("Auto-assigned owner role", {
                  workspaceId,
                  userId,
                });
              } else {
                logger.warn("Non-collaborator WebSocket connection attempt", {
                  workspaceId,
                  userId,
                });
                set.status = 403;
                return {
                  error: "Forbidden",
                  message: "Not a collaborator on this workspace",
                };
              }
            }

            let initialStateVector: Uint8Array | undefined;
            if (query.stateVector) {
              try {
                initialStateVector = new Uint8Array(
                  Buffer.from(query.stateVector, "base64")
                );
              } catch {
                logger.warn("Invalid state vector in query", { workspaceId });
              }
            }

            // Generate unique connection ID for this WebSocket connection
            const connectionId = generateId(16);

            // Attach auth data directly to this request context.
            // Elysia copies context into ws.data during upgrade, so open() can read
            // the exact auth payload for this socket without cross-connection races.
            const authEntry: PendingAuthEntry = {
              user: {
                id: userId,
                name: (payload as Record<string, unknown>).name as
                  | string
                  | undefined,
                email: (payload as Record<string, unknown>).email as string,
                image: (payload as Record<string, unknown>).image as
                  | string
                  | undefined,
              },
              collaborator: collab,
              initialStateVector,
              connectionId,
              timestamp: Date.now(),
              connectionStartTime: performance.now(),
            };
            wsContext.__pendingAuth = authEntry;

            logger.debug("JWT auth successful, attached to context", {
              userId,
              connectionId,
            });

            // Return undefined to allow WebSocket upgrade to proceed
            return;
          } catch (error) {
            logger.error("JWT verification failed", {
              workspaceId,
              operation: "auth.jwt.verify",
              error: {
                type: "jwt_verification_error",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              },
            });
            set.status = 401;
            // Re-throw the error so the span wrapper can record it.
            throw error;
          }
        }

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          logger.warn("Unauthorized WebSocket connection attempt", {
            workspaceId,
          });
          set.status = 401;
          return { error: "Unauthorized", message: "Valid session required" };
        }

        let collab = await getCollaborator(workspaceId, session.user.id);

        if (!collab) {
          const count = await getWorkspaceCollaboratorCount(workspaceId);
          if (count === 0) {
            // Only auto-assign if workspace actually exists (has state, shares, etc.)
            // This prevents creating entries for orphaned workspace IDs stored in client localStorage
            const exists = await checkWorkspaceExistence(workspaceId);
            if (!exists) {
              logger.warn("WebSocket connection to non-existent workspace", {
                workspaceId,
                userId: session.user.id,
              });
              set.status = 404;
              return {
                error: "Not Found",
                message: "Workspace does not exist",
              };
            }
            await addCollaborator(workspaceId, session.user.id, "OWNER");
            collab = { role: "OWNER" };
            logger.info("Auto-assigned owner role", {
              workspaceId,
              userId: session.user.id,
            });
          } else {
            logger.warn("Non-collaborator WebSocket connection attempt", {
              workspaceId,
              userId: session.user.id,
            });
            set.status = 403;
            return {
              error: "Forbidden",
              message: "Not a collaborator on this workspace",
            };
          }
        }

        let initialStateVector: Uint8Array | undefined;
        if (query.stateVector) {
          try {
            initialStateVector = new Uint8Array(
              Buffer.from(query.stateVector, "base64")
            );
          } catch {
            logger.warn("Invalid state vector in query", { workspaceId });
          }
        }

        // Generate unique connection ID for this WebSocket connection
        const connectionId = generateId(16);

        // Attach auth data directly to this request context.
        // Elysia copies context into ws.data during upgrade, so open() can read
        // the exact auth payload for this socket without cross-connection races.
        const authEntry: PendingAuthEntry = {
          user: session.user,
          collaborator: collab,
          initialStateVector,
          connectionId,
          timestamp: Date.now(),
          connectionStartTime: performance.now(),
        };
        wsContext.__pendingAuth = authEntry;

        logger.debug("Session auth successful, attached to context", {
          userId: session.user.id,
          connectionId,
        });

        // Return undefined to allow WebSocket upgrade to proceed
        return;
      });
    },

    open(ws) {
      return withSpanAsync("ws.open", async () => {
        logger.debug("WebSocket open handler called");
        const { workspaceId } = ws.data.params;
        const wsData = ws.data as unknown as WsData;

        // Read auth data from this socket's upgrade context.
        // This is deterministic and avoids cross-connection mixups.
        const authData = wsData.__pendingAuth;
        wsData.__pendingAuth = undefined;

        if (!authData) {
          logger.error("No auth data found on WebSocket context", {
            workspaceId,
          });
          recordWsConnectionError({ workspaceId, error: "auth_data_missing" });
          ws.close();
          return;
        }

        const {
          user,
          collaborator,
          initialStateVector,
          connectionId,
          connectionStartTime,
        } = authData;
        const color = getColorForUser(user.id);

        setSpanAttributes({
          connectionId,
          workspaceId,
          userId: user.id,
        });

        const collabInfo: CollaboratorInfo = {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          image: user.image,
          role: collaborator.role,
          color,
        };

        wsData.connectionId = connectionId;
        wsData.user = user;
        wsData.collaborator = collaborator;
        wsData.queuedMessages = [];

        const joinPromise = (async () => {
          await roomManager.join({
            connectionId,
            ws: {
              // Use ws.raw.send() for direct Bun WebSocket access - ws.send() may have issues with async sends
              // Elysia WebSocket typings do not currently expose raw, so we cast to any
              // It really was pain to figure this out...
              send: (msgData: Uint8Array) => {
                try {
                  ws.raw.send(msgData);
                } catch (error) {
                  logger.error("Failed to send via raw WebSocket", {
                    connectionId,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                  });
                }
              },
              close: () => ws.close(),
            },
            user: collabInfo,
            workspaceId,
            initialStateVector,
          });

          // Drain any messages that arrived before join completed.
          const queued = wsData.queuedMessages ?? [];
          wsData.queuedMessages = [];
          for (const queuedMessage of queued) {
            const handled = roomManager.handleMessage(
              connectionId,
              queuedMessage
            );
            if (handled) {
              recordWsMessage({
                messageSize: queuedMessage.byteLength.toString(),
              });
            } else {
              recordWsConnectionError({
                connectionId,
                workspaceId,
                error: "queued_message_handle_failed",
              });
            }
          }

          // Record connection metrics
          if (connectionStartTime) {
            const latencySeconds =
              (performance.now() - connectionStartTime) / 1000;
            recordWsConnectionLatency(latencySeconds, {
              workspaceId,
              userId: user.id,
            });
          }

          incrementActiveConnections();

          logger.info("WebSocket opened", {
            connectionId,
            workspaceId,
            userId: user.id,
            role: collaborator.role,
            operation: "websocket.open",
            userName: user.name,
            userEmail: user.email,
          });
        })();

        wsData.joinPromise = joinPromise;

        try {
          await joinPromise;
        } finally {
          wsData.joinPromise = undefined;
          wsData.queuedMessages = undefined;
        }
      });
    },

    message(ws, message) {
      const data = ws.data as unknown as WsData;
      const connectionId = data.connectionId;
      const workspaceId = ws.data.params.workspaceId;
      if (!connectionId) {
        return;
      }

      const messageSize =
        message instanceof ArrayBuffer
          ? message.byteLength
          : message instanceof Uint8Array
            ? message.byteLength
            : 0;

      if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
        const msgData =
          message instanceof ArrayBuffer ? new Uint8Array(message) : message;

        if (data.joinPromise) {
          if (!data.queuedMessages) {
            data.queuedMessages = [];
          }

          // Keep queue bounded to avoid unbounded memory usage.
          if (data.queuedMessages.length >= 32) {
            data.queuedMessages.shift();
          }
          data.queuedMessages.push(msgData);
          return;
        }

        const handled = roomManager.handleMessage(connectionId, msgData);
        if (handled) {
          recordWsMessage({ messageSize: messageSize.toString() });
        } else {
          recordWsConnectionError({
            connectionId,
            workspaceId,
            error: "message_handle_failed",
          });
        }
      }
    },

    close(ws) {
      withSpan("ws.close", () => {
        const data = ws.data as unknown as WsData;
        const connectionId = data.connectionId;
        const workspaceId = ws.data.params.workspaceId;

        if (!connectionId) {
          return;
        }

        setSpanAttributes({ connectionId, workspaceId });

        roomManager.leave(connectionId);
        decrementActiveConnections();

        logger.info("WebSocket closed", {
          connectionId,
          workspaceId,
          operation: "websocket.close",
        });
      });
    },
  })

  // Get existing share links for workspace (collaborator and public guest links)
  .get(
    "/api/workspaces/:workspaceId/share",
    ({ params, headers, set }) =>
      withSpanAsync("workspace.getShare", async () => {
        const { workspaceId } = params;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const collab = await getCollaborator(workspaceId, session.user.id);
        if (!collab) {
          set.status = 403;
          return { error: "Not a collaborator on this workspace" };
        }

        try {
          const shares = await prisma.workspaceShare.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
          });

          const collaboratorShare = shares.find(
            (s) => !s.isGuest && s.role !== "VIEWER"
          );
          const guestShare = shares.find(
            (s) => s.isGuest || s.role === "VIEWER"
          );

          return {
            token: collaboratorShare?.token ?? null,
            url: collaboratorShare
              ? `${env.WEB_URL}?share=${collaboratorShare.token}`
              : null,
            collaboratorLink: collaboratorShare
              ? {
                  token: collaboratorShare.token,
                  url: `${env.WEB_URL}?share=${collaboratorShare.token}`,
                  expiresAt: collaboratorShare.expiresAt,
                }
              : null,
            guestLink: guestShare
              ? {
                  enabled: true,
                  token: guestShare.token,
                  url: `${env.WEB_URL}?guest=${guestShare.token}`,
                  expiresAt: guestShare.expiresAt,
                }
              : {
                  enabled: false,
                  token: null,
                  url: null,
                  expiresAt: null,
                },
          };
        } catch (error) {
          logger.error("Failed to fetch share link", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        return {
          url: null,
          token: null,
          collaboratorLink: null,
          guestLink: {
            enabled: false,
            token: null,
            url: null,
            expiresAt: null,
          },
        };
      }),
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Enable/create guest share link (Owner only)
  .post(
    "/api/workspaces/:workspaceId/share/guest",
    ({ params, headers, set }) => {
      return withSpanAsync("workspace.createGuestShare", async () => {
        const { workspaceId } = params;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const collab = await getCollaborator(workspaceId, session.user.id);
        if (!collab || collab.role !== "OWNER") {
          set.status = 403;
          return { error: "Only workspace owner can manage guest share links" };
        }

        // Clean up any existing guest shares
        await revokeGuestShareToken(workspaceId);

        const token = await createShareToken(
          workspaceId,
          session.user.id,
          "VIEWER",
          true
        );

        const room = roomManager.getRoom(workspaceId);
        if (room) {
          await roomManager.persistRoom(workspaceId);
        }

        logger.info("Guest share link enabled", {
          workspaceId,
          createdBy: session.user.id,
          operation: "share.guest.enable",
        });

        return {
          enabled: true,
          token,
          url: `${env.WEB_URL}?guest=${token}`,
        };
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Disable/revoke guest share link (Owner only)
  .delete(
    "/api/workspaces/:workspaceId/share/guest",
    ({ params, headers, set }) =>
      withSpanAsync("workspace.revokeGuestShare", async () => {
        const { workspaceId } = params;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const collab = await getCollaborator(workspaceId, session.user.id);
        if (!collab || collab.role !== "OWNER") {
          set.status = 403;
          return { error: "Only workspace owner can manage guest share links" };
        }

        await revokeGuestShareToken(workspaceId);

        logger.info("Guest share link revoked", {
          workspaceId,
          userId: session.user.id,
          operation: "share.guest.revoke",
        });

        return {
          enabled: false,
          success: true,
        };
      }),
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Create new share link
  .post(
    "/api/workspaces/:workspaceId/share",
    ({ params, headers, set, body }) => {
      return withSpanAsync("workspace.createShare", async () => {
        const { workspaceId } = params;
        const workspaceName = body?.name;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        // Get room reference for later use (may not exist yet for first share)
        const room = roomManager.getRoom(workspaceId);

        let collab = await getCollaborator(workspaceId, session.user.id);

        // Auto-assign owner if no collaborators exist yet (first share)
        if (!collab) {
          const count = await getWorkspaceCollaboratorCount(workspaceId);
          if (count === 0) {
            // Create workspace with name from request if provided
            const nameToUse = workspaceName || "Untitled Workspace";

            // Check if workspace exists
            const existingWorkspace = await prisma.workspace.findUnique({
              where: { id: workspaceId },
              select: { id: true },
            });

            if (!existingWorkspace) {
              logger.info("Creating workspace record on first share", {
                workspaceId,
                name: nameToUse,
                userId: session.user.id,
              });
              await prisma.workspace.create({
                data: {
                  id: workspaceId,
                  name: nameToUse,
                  ownerId: session.user.id,
                },
              });
            }

            await addCollaborator(workspaceId, session.user.id, "OWNER");
            collab = { role: "OWNER" };
            logger.info("Auto-assigned owner role on share", {
              workspaceId,
              userId: session.user.id,
            });
          }
        }

        if (!collab || collab.role !== "OWNER") {
          set.status = 403;
          return { error: "Only workspace owner can create share links" };
        }

        // Update workspace name if provided in request and different from current
        if (workspaceName) {
          try {
            await prisma.workspace.update({
              where: { id: workspaceId },
              data: { name: workspaceName },
            });
            logger.debug("Updated workspace name from share request", {
              workspaceId,
              name: workspaceName,
            });
          } catch {
            // Workspace might not exist yet - try to create
            const existingWorkspace = await prisma.workspace.findUnique({
              where: { id: workspaceId },
              select: { id: true },
            });
            if (!existingWorkspace) {
              await prisma.workspace.create({
                data: {
                  id: workspaceId,
                  name: workspaceName,
                  ownerId: session.user.id,
                },
              });
            }
          }
        } else {
          // Fallback: Try to get name from active room
          const currentName = await getWorkspaceName(workspaceId);
          if (!currentName || currentName === "Untitled Workspace") {
            const currentRoom = roomManager.getRoom(workspaceId);
            if (currentRoom) {
              const workspaceMap = currentRoom.doc.getMap("workspace");
              const workspaceData = workspaceMap.get(workspaceId) as
                | { name: string }
                | undefined;
              if (workspaceData?.name) {
                await prisma.workspace.update({
                  where: { id: workspaceId },
                  data: { name: workspaceData.name },
                });
              }
            }
          }
        }

        const token = await createShareToken(workspaceId, session.user.id);

        // Immediately persist room state so editors who join right away can get the state
        // This bypasses the normal debounce to ensure a smooth experience
        if (room) {
          logger.info("Persisting room state immediately on share", {
            workspaceId,
          });
          await roomManager.persistRoom(workspaceId);
        }

        logger.info("Share link created", {
          workspaceId,
          workspaceName,
          createdBy: session.user.id,
          operation: "share.create",
        });

        return {
          token,
          url: `${env.WEB_URL}?share=${token}`,
        };
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
      body: t.Optional(
        t.Object({
          name: t.Optional(t.String()),
        })
      ),
    }
  )

  .get(
    "/api/share/:token",
    async ({ params, set }) =>
      withSpanAsync("share.getInfo", async () => {
        const { token } = params;
        setSpanAttributes({ token });

        const shareInfo = await getShareInfo(token);
        if (!shareInfo) {
          set.status = 404;
          return { error: "Share link not found or expired" };
        }

        if (shareInfo.expiresAt && shareInfo.expiresAt < new Date()) {
          set.status = 410;
          return { error: "Share link has expired" };
        }

        return {
          workspaceId: shareInfo.workspaceId,
          workspaceName: shareInfo.workspaceName,
          owner: shareInfo.owner,
          isGuest: shareInfo.isGuest ?? false,
          role: shareInfo.role ?? "EDITOR",
        };
      }),
    {
      params: t.Object({ token: t.String() }),
    }
  )

  // Public guest info (unauthenticated)
  .get(
    "/api/share/guest/:token",
    async ({ params, set }) =>
      withSpanAsync("share.getGuestInfo", async () => {
        const { token } = params;
        setSpanAttributes({ token });

        const shareInfo = await getShareInfo(token);
        if (!shareInfo) {
          set.status = 404;
          return { error: "Share link not found or disabled" };
        }

        if (shareInfo.expiresAt && shareInfo.expiresAt < new Date()) {
          set.status = 410;
          return { error: "Share link has expired" };
        }

        return {
          workspaceId: shareInfo.workspaceId,
          workspaceName: shareInfo.workspaceName,
          owner: shareInfo.owner,
          isGuest: true,
          role: "VIEWER",
        };
      }),
    {
      params: t.Object({ token: t.String() }),
    }
  )

  // Public guest workspace state snapshot (unauthenticated)
  .get(
    "/api/share/guest/:token/state",
    async ({ params, set }) =>
      withSpanAsync("share.getGuestState", async () => {
        const { token } = params;
        setSpanAttributes({ token });

        const shareInfo = await getShareInfo(token);
        if (!shareInfo) {
          set.status = 404;
          return { error: "Share link not found or disabled" };
        }

        if (shareInfo.expiresAt && shareInfo.expiresAt < new Date()) {
          set.status = 410;
          return { error: "Share link has expired" };
        }

        const workspaceId = shareInfo.workspaceId;

        // Try to get state from active room first
        const room = roomManager.getRoom(workspaceId);
        if (room) {
          const doc = room.doc;
          return {
            workspace: Object.fromEntries(doc.getMap("workspace").entries()),
            boards: Object.fromEntries(doc.getMap("boards").entries()),
            columns: Object.fromEntries(doc.getMap("columns").entries()),
            tasks: Object.fromEntries(doc.getMap("tasks").entries()),
            boardPositions: Object.fromEntries(
              doc.getMap("boardPositions").entries()
            ),
            textBoards: Object.fromEntries(doc.getMap("textBoards").entries()),
            textBoardPositions: Object.fromEntries(
              doc.getMap("textBoardPositions").entries()
            ),
            boardConnections: Object.fromEntries(
              doc.getMap("boardConnections").entries()
            ),
            taskDetailModals: Object.fromEntries(
              doc.getMap("taskDetailModals").entries()
            ),
          };
        }

        // Fall back to database
        try {
          const stored = await prisma.workspaceState.findUnique({
            where: { workspaceId },
          });
          if (stored?.yjsState) {
            const tempRoom = roomManager.getOrCreateRoom(workspaceId);
            const doc = tempRoom.doc;
            Y.applyUpdate(doc, new Uint8Array(stored.yjsState));

            return {
              workspace: Object.fromEntries(doc.getMap("workspace").entries()),
              boards: Object.fromEntries(doc.getMap("boards").entries()),
              columns: Object.fromEntries(doc.getMap("columns").entries()),
              tasks: Object.fromEntries(doc.getMap("tasks").entries()),
              boardPositions: Object.fromEntries(
                doc.getMap("boardPositions").entries()
              ),
              textBoards: Object.fromEntries(
                doc.getMap("textBoards").entries()
              ),
              textBoardPositions: Object.fromEntries(
                doc.getMap("textBoardPositions").entries()
              ),
              boardConnections: Object.fromEntries(
                doc.getMap("boardConnections").entries()
              ),
              taskDetailModals: Object.fromEntries(
                doc.getMap("taskDetailModals").entries()
              ),
            };
          }
        } catch (error) {
          logger.error("Failed to fetch guest workspace state", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        return {
          workspace: {},
          boards: {},
          columns: {},
          tasks: {},
          boardPositions: {},
          textBoards: {},
          textBoardPositions: {},
          boardConnections: {},
          taskDetailModals: {},
        };
      }),
    {
      params: t.Object({ token: t.String() }),
    }
  )

  .post(
    "/api/share/:token/join",
    async ({ params, headers, set }) =>
      withSpanAsync("share.join", async () => {
        const { token } = params;
        setSpanAttributes({ token });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return {
            error: "Unauthorized",
            message: "Please login to join workspace",
          };
        }

        const shareInfo = await getShareInfo(token);
        if (!shareInfo) {
          set.status = 404;
          return { error: "Share link not found or expired" };
        }

        if (shareInfo.expiresAt && shareInfo.expiresAt < new Date()) {
          set.status = 410;
          return { error: "Share link has expired" };
        }

        const existing = await getCollaborator(
          shareInfo.workspaceId,
          session.user.id
        );
        if (existing) {
          return {
            workspaceId: shareInfo.workspaceId,
            role: existing.role,
            message: "Already a collaborator",
          };
        }

        await addCollaborator(shareInfo.workspaceId, session.user.id, "EDITOR");

        logger.info("User joined workspace via share link", {
          workspaceId: shareInfo.workspaceId,
          userId: session.user.id,
        });

        setSpanAttributes({ userId: session.user.id });
        return {
          workspaceId: shareInfo.workspaceId,
          role: "EDITOR",
          message: "Successfully joined workspace",
          workspaceName: shareInfo.workspaceName,
          owner: shareInfo.owner,
        };
      }),
    {
      params: t.Object({ token: t.String() }),
    }
  )

  .get(
    "/api/workspaces/:workspaceId/collaborators",
    ({ params, headers, set }) => {
      return withSpanAsync("workspace.getCollaborators", async () => {
        const { workspaceId } = params;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const isMember =
          (await getCollaborator(workspaceId, session.user.id)) ||
          (await prisma.workspace.findFirst({
            where: { id: workspaceId, ownerId: session.user.id },
          }));

        if (!isMember) {
          set.status = 403;
          return { error: "Not a collaborator on this workspace" };
        }

        // Fetch all collaborators from DB (including owner)
        const collaborators = await prisma.workspaceCollaborator.findMany({
          where: { workspaceId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        });

        // Also fetch owner info to ensure they're included even if not in collaborators table
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        });

        const result = collaborators.map((c) => ({
          id: c.userId,
          name: c.user.name,
          email: c.user.email,
          image: c.user.image,
          role: c.role,
          joinedAt: c.joinedAt,
        }));

        // Ensure owner is in list (if not already in collaborators table)
        if (workspace?.owner) {
          const ownerAlreadyInList = result.some(
            (c) => c.id === workspace.owner.id
          );
          if (!ownerAlreadyInList) {
            result.push({
              id: workspace.owner.id,
              name: workspace.owner.name,
              email: workspace.owner.email,
              image: workspace.owner.image,
              role: "OWNER",
              joinedAt: workspace.createdAt,
            });
          }
        }

        // Remove duplicates just in case
        const uniqueCollaborators = new Map();
        for (const c of result) {
          uniqueCollaborators.set(c.id, c);
        }

        // Get online status from Presence as the single source of truth
        const presence = await getWorkspacePresence(workspaceId);
        const onlineIds = presence.userIds;

        const knownCollaborators = Array.from(uniqueCollaborators.values()).map(
          (c) => ({
            ...c,
            isOnline: onlineIds.has(c.id),
          })
        );

        return {
          collaborators: knownCollaborators,
          // Presence may include users without a collaborator row (e2e
          // anonymous sockets, stale members); only count known collaborators.
          onlineCount: knownCollaborators.filter((c) => c.isOnline).length,
        };
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Get workspace state for initial sync
  .get(
    "/api/workspaces/:workspaceId/state",
    ({ params, headers, set }) => {
      return withSpanAsync("workspace.getState", async () => {
        const { workspaceId } = params;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const collab = await getCollaborator(workspaceId, session.user.id);
        if (!collab) {
          set.status = 403;
          return { error: "Not a collaborator on this workspace" };
        }

        // Try to get state from active room first
        const room = roomManager.getRoom(workspaceId);
        if (room) {
          const doc = room.doc;
          return {
            workspace: Object.fromEntries(doc.getMap("workspace").entries()),
            boards: Object.fromEntries(doc.getMap("boards").entries()),
            columns: Object.fromEntries(doc.getMap("columns").entries()),
            tasks: Object.fromEntries(doc.getMap("tasks").entries()),
            boardPositions: Object.fromEntries(
              doc.getMap("boardPositions").entries()
            ),
          };
        }

        // Fall back to database
        try {
          const stored = await prisma.workspaceState.findUnique({
            where: { workspaceId },
          });
          if (stored?.yjsState) {
            // Load from stored Yjs state - must apply the update before reading maps
            const tempRoom = roomManager.getOrCreateRoom(workspaceId);
            const doc = tempRoom.doc;

            // Apply the stored state to the document
            Y.applyUpdate(doc, new Uint8Array(stored.yjsState));

            return {
              workspace: Object.fromEntries(doc.getMap("workspace").entries()),
              boards: Object.fromEntries(doc.getMap("boards").entries()),
              columns: Object.fromEntries(doc.getMap("columns").entries()),
              tasks: Object.fromEntries(doc.getMap("tasks").entries()),
              boardPositions: Object.fromEntries(
                doc.getMap("boardPositions").entries()
              ),
            };
          }
        } catch (error) {
          logger.error("Failed to fetch workspace state", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Return empty state
        return {
          workspace: {},
          boards: {},
          columns: {},
          tasks: {},
          boardPositions: {},
        };
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  .get("/api/workspaces", ({ headers, set }) => {
    return withSpanAsync("workspace.list", async (span) => {
      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });

      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      setSpanAttributes({ userId: session.user.id });

      try {
        // Fetch workspaces where user is owner or collaborator
        const workspaces = await prisma.workspace.findMany({
          where: {
            OR: [
              { ownerId: session.user.id },
              { collaborators: { some: { userId: session.user.id } } },
            ],
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            collaborators: {
              select: { userId: true },
            },
            _count: {
              select: { shares: true, collaborators: true },
            },
          },
        });

        return workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          description: ws.description,
          ownerId: ws.ownerId,
          ownerName: ws.owner.name,
          ownerImage: ws.owner.image,
          created_at: ws.createdAt,
          // A workspace is shared if it has more than 1 collaborator (owner + someone else)
          // OR if it has active share links
          isShared: ws._count.collaborators > 1 || ws._count.shares > 0,
        }));
      } catch (error) {
        recordSpanError(span, error);
        logger.error("Failed to list workspaces", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        set.status = 500;
        return { error: "Failed to list workspaces" };
      }
    });
  })

  .post(
    "/api/workspaces",
    ({ body, headers, set }) => {
      return withSpanAsync("workspace.create", async (span) => {
        const { id, name, description } = body;
        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });

        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        const workspaceId = id || generateId(16);
        setSpanAttributes({ workspaceId, name });

        try {
          const workspace = await prisma.workspace.upsert({
            where: { id: workspaceId },
            create: {
              id: workspaceId,
              name,
              description,
              ownerId: session.user.id,
              collaborators: {
                create: {
                  userId: session.user.id,
                  role: "OWNER",
                },
              },
            },
            update: {
              name,
              description,
              // Don't update owner or collaborators here, they are consistent
            },
          });

          logger.info(
            { workspaceId: workspace.id, userId: session.user.id },
            "Workspace created via API"
          );

          return {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            ownerId: workspace.ownerId,
          };
        } catch (error) {
          recordSpanError(span, error);
          logger.error("Failed to create workspace", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          set.status = 500;
          return { error: "Failed to create workspace" };
        }
      });
    },
    {
      body: t.Object({
        id: t.Optional(t.String()),
        name: t.String(),
        description: t.Optional(t.String()),
      }),
    }
  )

  // Update workspace
  .patch(
    "/api/workspaces/:workspaceId",
    ({ params, body, headers, set }) => {
      return withSpanAsync("workspace.update", async (span) => {
        const { workspaceId } = params;
        const { name, description } = body;
        setSpanAttributes({ workspaceId });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });

        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        // Check permissions
        const collab = await getCollaborator(workspaceId, session.user.id);
        if (!collab || collab.role !== "OWNER") {
          set.status = 403;
          return { error: "Only workspace owner can update workspace details" };
        }

        try {
          // Check if record exists
          const exists = await prisma.workspace.findUnique({
            where: { id: workspaceId },
          });

          let result: { id: string; name: string; description: string | null };
          if (exists) {
            result = await prisma.workspace.update({
              where: { id: workspaceId },
              data: {
                name,
                description,
              },
            });
          } else {
            // Migration path: if it doesn't exist but user is owner (checked above via collaborator table), create it
            result = await prisma.workspace.create({
              data: {
                id: workspaceId,
                name: name || "Untitled Workspace",
                description,
                ownerId: session.user.id,
                // Relations are already there in other tables, but we need to ensure consistency?
                // Actually, relations rely on IDs, so just creating the parent record should link them if FKs match.
                // But wait, existing collaborators reference workspaceId. If I create the workspace record now, it works.
              },
            });
          }

          logger.info(
            { workspaceId, userId: session.user.id },
            "Workspace updated via API"
          );

          return {
            id: result.id,
            name: result.name,
            description: result.description,
          };
        } catch (error) {
          recordSpanError(span, error);
          logger.error("Failed to update workspace", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          set.status = 500;
          return { error: "Failed to update workspace" };
        }
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  )

  .delete(
    "/api/workspaces/:workspaceId",
    ({ params, headers, set, query }) => {
      return withSpanAsync("workspace.delete", async (span) => {
        const { workspaceId } = params;
        const ephemeral = query.ephemeral === "true";
        setSpanAttributes({ workspaceId, ephemeral });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });

        if (!session) {
          set.status = 401;
          return { error: "Unauthorized" };
        }

        if (ephemeral) {
          roomManager.deleteRoom(workspaceId);
          return { success: true };
        }

        // Check if user is owner
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { ownerId: true },
        });

        if (!workspace) {
          set.status = 404;
          return { error: "Workspace not found" };
        }

        if (workspace.ownerId !== session.user.id) {
          set.status = 403;
          return { error: "Only the owner can delete the workspace" };
        }

        try {
          // 1. Notify all connected clients and close connections
          // This will trigger the "Workspace Deleted" banner on their end
          roomManager.deleteRoom(workspaceId);

          // 2. Delete from database
          await prisma.workspace.delete({
            where: { id: workspaceId },
          });

          logger.info(
            { workspaceId, userId: session.user.id },
            "Workspace deleted via API"
          );

          return { success: true };
        } catch (error) {
          recordSpanError(span, error);
          logger.error("Failed to delete workspace", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          set.status = 500;
          return { error: "Failed to delete workspace" };
        }
      });
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  );
