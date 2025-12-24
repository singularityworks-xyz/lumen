import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import { Elysia, t } from "elysia";
import { auth } from "../auth/config/auth";
import { type CollaboratorInfo, roomManager } from "./room-manager";

const logger = createLogger({ name: "collab:routes" });

function generateId(length = 16): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }
  return result;
}

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
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

function toHeaders(elysiaHeaders: Record<string, string | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(elysiaHeaders)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function getCollaborator(
  workspaceId: string,
  userId: string
): Promise<{ role: "owner" | "editor" | "viewer" } | null> {
  try {
    const collab = await prisma.workspaceCollaborator.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!collab) {
      return null;
    }
    return { role: collab.role as "owner" | "editor" | "viewer" };
  } catch (error) {
    logger.error("Failed to get collaborator", {
      workspaceId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function addCollaborator(
  workspaceId: string,
  userId: string,
  role: "owner" | "editor" | "viewer"
): Promise<void> {
  try {
    await prisma.workspaceCollaborator.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: { role },
      create: { workspaceId, userId, role },
    });
  } catch (error) {
    logger.error("Failed to add collaborator", {
      workspaceId,
      userId,
      role,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function createShareToken(
  workspaceId: string,
  createdBy: string,
  expiresAt?: Date
): Promise<string> {
  const token = generateId(16);
  try {
    await prisma.workspaceShare.create({
      data: {
        workspaceId,
        token,
        createdBy,
        expiresAt,
      },
    });
    return token;
  } catch (error) {
    logger.error("Failed to create share token", {
      workspaceId,
      createdBy,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function getShareInfo(token: string): Promise<{
  workspaceId: string;
  createdBy: string;
  expiresAt: Date | null;
} | null> {
  try {
    const share = await prisma.workspaceShare.findUnique({
      where: { token },
    });
    if (!share) {
      return null;
    }
    return {
      workspaceId: share.workspaceId,
      createdBy: share.createdBy,
      expiresAt: share.expiresAt,
    };
  } catch (error) {
    logger.error("Failed to get share info", {
      token,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function getWorkspaceCollaboratorCount(
  workspaceId: string
): Promise<number> {
  try {
    return await prisma.workspaceCollaborator.count({
      where: { workspaceId },
    });
  } catch {
    return 0;
  }
}

type WsData = {
  params: { workspaceId: string };
  query: { stateVector?: string };
  user?: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
  collaborator?: { role: "owner" | "editor" | "viewer" };
  initialStateVector?: Uint8Array;
  connectionId?: string;
};

// Store pending auth data between beforeHandle and open handler
const pendingAuth = new Map<
  string,
  {
    user: {
      id: string;
      name?: string | null;
      email: string;
      image?: string | null;
    };
    collaborator: { role: "owner" | "editor" | "viewer" };
    initialStateVector?: Uint8Array;
    timestamp: number;
  }
>();

// Clean up old pending auth entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingAuth.entries()) {
    if (now - value.timestamp > 30_000) {
      pendingAuth.delete(key);
    }
  }
}, 30_000);

export const collabRoutes = new Elysia({ name: "collab-routes" })
  .ws("/ws/collab/:workspaceId", {
    body: t.Any(),
    params: t.Object({
      workspaceId: t.String(),
    }),
    query: t.Object({
      token: t.Optional(t.String()),
      stateVector: t.Optional(t.String()),
    }),

    async beforeHandle({ params, headers, set, query }) {
      const { workspaceId } = params;
      const { token } = query;

      logger.debug("WebSocket beforeHandle starting", {
        workspaceId,
        hasToken: !!token,
      });

      if (token) {
        try {
          const { createRemoteJWKSet, jwtVerify } = await import("jose");
          const baseUrl =
            process.env.BETTER_AUTH_URL || "http://localhost:3002";
          const JWKS = createRemoteJWKSet(new URL(`${baseUrl}/api/auth/jwks`));

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
              await addCollaborator(workspaceId, userId, "owner");
              collab = { role: "owner" };
              logger.info("Auto-assigned owner role", { workspaceId, userId });
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

          // Store auth data in pending map for open handler to retrieve
          const authKey = `${workspaceId}:${userId}`;
          pendingAuth.set(authKey, {
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
            timestamp: Date.now(),
          });

          logger.debug("JWT auth successful, stored in pendingAuth", {
            userId,
            authKey,
          });

          // Return undefined to allow WebSocket upgrade to proceed
          return;
        } catch (error) {
          logger.error("JWT verification failed", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          set.status = 401;
          return { error: "Unauthorized", message: "Invalid JWT token" };
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
          await addCollaborator(workspaceId, session.user.id, "owner");
          collab = { role: "owner" };
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

      // Store auth data in pending map for open handler to retrieve
      const authKey = `${workspaceId}:${session.user.id}`;
      pendingAuth.set(authKey, {
        user: session.user,
        collaborator: collab,
        initialStateVector,
        timestamp: Date.now(),
      });

      logger.debug("Session auth successful, stored in pendingAuth", {
        userId: session.user.id,
        authKey,
      });

      // Return undefined to allow WebSocket upgrade to proceed
      return;
    },

    open(ws) {
      logger.debug("WebSocket open handler called");
      const { workspaceId } = ws.data.params;
      const wsData = ws.data as unknown as WsData;

      // Find auth data from pendingAuth Map - look for any entry with matching workspaceId
      let authData:
        | (typeof pendingAuth extends Map<string, infer V> ? V : never)
        | undefined;
      let authKey: string | undefined;

      for (const [key, value] of pendingAuth.entries()) {
        if (key.startsWith(`${workspaceId}:`)) {
          authData = value;
          authKey = key;
          break;
        }
      }

      if (!authData) {
        logger.error("No pending auth data found for workspace", {
          workspaceId,
        });
        ws.close();
        return;
      }

      // Remove from pending auth
      if (authKey) {
        pendingAuth.delete(authKey);
      }

      const { user, collaborator, initialStateVector } = authData;

      const connectionId = generateId(12);
      const color = getColorForUser(user.id);

      const collabInfo: CollaboratorInfo = {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        image: user.image,
        role: collaborator.role,
        color,
      };

      roomManager.join({
        connectionId,
        ws: {
          send: (msgData: Uint8Array) => ws.send(msgData),
          close: () => ws.close(),
        },
        user: collabInfo,
        workspaceId,
        initialStateVector,
      });

      wsData.connectionId = connectionId;
      wsData.user = user;
      wsData.collaborator = collaborator;

      logger.info("WebSocket opened", {
        connectionId,
        workspaceId,
        userId: user.id,
        role: collaborator.role,
      });
    },

    message(ws, message) {
      const data = ws.data as unknown as WsData;
      const connectionId = data.connectionId;
      if (!connectionId) {
        return;
      }

      if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
        const msgData =
          message instanceof ArrayBuffer ? new Uint8Array(message) : message;
        roomManager.handleMessage(connectionId, msgData);
      }
    },

    close(ws) {
      const data = ws.data as unknown as WsData;
      const connectionId = data.connectionId;
      if (!connectionId) {
        return;
      }

      roomManager.leave(connectionId);

      logger.info("WebSocket closed", {
        connectionId,
        workspaceId: ws.data.params.workspaceId,
      });
    },
  })

  // Get existing share link for workspace
  .get(
    "/api/workspaces/:workspaceId/share",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

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

      // Find existing share link
      try {
        const share = await prisma.workspaceShare.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: "desc" },
        });

        if (share) {
          return {
            token: share.token,
            url: `${process.env.WEB_URL || "http://localhost:3000"}?share=${share.token}`,
            expiresAt: share.expiresAt,
          };
        }
      } catch (error) {
        logger.error("Failed to fetch share link", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return { url: null };
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Create new share link
  .post(
    "/api/workspaces/:workspaceId/share",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });
      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let collab = await getCollaborator(workspaceId, session.user.id);

      // Auto-assign owner if no collaborators exist yet (first share)
      if (!collab) {
        const count = await getWorkspaceCollaboratorCount(workspaceId);
        if (count === 0) {
          await addCollaborator(workspaceId, session.user.id, "owner");
          collab = { role: "owner" };
          logger.info("Auto-assigned owner role on share", {
            workspaceId,
            userId: session.user.id,
          });
        }
      }

      if (!collab || collab.role !== "owner") {
        set.status = 403;
        return { error: "Only workspace owner can create share links" };
      }

      const token = await createShareToken(workspaceId, session.user.id);

      logger.info("Share link created", {
        workspaceId,
        createdBy: session.user.id,
      });

      return {
        token,
        url: `${process.env.WEB_URL || "http://localhost:3000"}?share=${token}`,
      };
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  .get(
    "/api/share/:token",
    async ({ params, set }) => {
      const { token } = params;

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
      };
    },
    {
      params: t.Object({ token: t.String() }),
    }
  )

  .post(
    "/api/share/:token/join",
    async ({ params, headers, set }) => {
      const { token } = params;

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

      await addCollaborator(shareInfo.workspaceId, session.user.id, "editor");

      logger.info("User joined workspace via share link", {
        workspaceId: shareInfo.workspaceId,
        userId: session.user.id,
      });

      return {
        workspaceId: shareInfo.workspaceId,
        role: "editor",
        message: "Successfully joined workspace",
      };
    },
    {
      params: t.Object({ token: t.String() }),
    }
  )

  .get(
    "/api/workspaces/:workspaceId/collaborators",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

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

      const online = roomManager.getCollaborators(workspaceId);

      return {
        online,
        count: online.length,
      };
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  )

  // Get workspace state for initial sync
  .get(
    "/api/workspaces/:workspaceId/state",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

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
          // Load from stored Yjs state
          const tempRoom = roomManager.getOrCreateRoom(workspaceId);
          const doc = tempRoom.doc;
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
    },
    {
      params: t.Object({ workspaceId: t.String() }),
    }
  );
