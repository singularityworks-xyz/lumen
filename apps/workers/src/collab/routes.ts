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
    // Ensure workspace exists before adding collaborator (handles race conditions)
    if (role === "owner") {
      const workspaceExists = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });

      if (!workspaceExists) {
        logger.info(
          { workspaceId, userId },
          "Lazily creating workspace record for new owner"
        );
        await prisma.workspace.create({
          data: {
            id: workspaceId,
            name: "Untitled Workspace", // Will be updated by the actual creation logic or subsequent edits
            ownerId: userId,
          },
        });
      }
    }

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

/**
 * Check if a workspace exists (has state or was explicitly created).
 * A workspace is considered to exist if it has:
 * 1. A WorkspaceState entry (persisted state), OR
 * 2. At least one collaborator (was shared with someone), OR
 * 3. A share link (was explicitly shared)
 */
async function checkWorkspaceExistence(idToCheck: string): Promise<boolean> {
  try {
    const workspaceRecord = await prisma.workspace.findUnique({
      where: { id: idToCheck },
      select: { id: true },
    });
    if (workspaceRecord) {
      return true;
    }

    const state = await prisma.workspaceState.findUnique({
      where: { workspaceId: idToCheck },
      select: { id: true },
    });
    if (state) {
      return true;
    }

    const collabCount = await prisma.workspaceCollaborator.count({
      where: { workspaceId: idToCheck },
    });
    if (collabCount > 0) {
      return true;
    }

    const shareCount = await prisma.workspaceShare.count({
      where: { workspaceId: idToCheck },
    });
    if (shareCount > 0) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Failed to check workspace existence", {
      workspaceId: idToCheck,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
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

async function getUserInfo(userId: string): Promise<{
  id: string;
  name: string | null;
  image: string | null;
  email: string;
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, image: true, email: true },
    });
    return user;
  } catch (error) {
    logger.error("Failed to get user info", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function getWorkspaceName(workspaceId: string): Promise<string | null> {
  try {
    // Try to get from Workspace table first (authoritative source)
    const record = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    if (record) {
      return record.name;
    }

    // Fallback: Try to get from active room
    const room = roomManager.getRoom(workspaceId);
    if (room) {
      const workspaceMap = room.doc.getMap("workspace");
      // Assuming workspace map keys are workspace IDs
      const workspace = workspaceMap.get(workspaceId) as
        | { name: string }
        | undefined;
      return workspace?.name || null;
    }

    // Fallback to database
    const stored = await prisma.workspaceState.findUnique({
      where: { workspaceId },
    });

    if (stored?.yjsState) {
      // Create temp room to parse name
      // Note: This parses the whole doc which is heavy, but we need the name
      const tempRoom = roomManager.getOrCreateRoom(workspaceId);
      const workspaceMap = tempRoom.doc.getMap("workspace");
      const workspace = workspaceMap.get(workspaceId) as
        | { name: string }
        | undefined;
      // We don't explicit destroy here as roomManager manages cache,
      // but if we created it just for this, it stays in memory which is fine for now
      return workspace?.name || null;
    }

    return null;
  } catch (error) {
    logger.error("Failed to get workspace name", {
      workspaceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

async function getShareInfo(token: string): Promise<{
  workspaceId: string;
  createdBy: string;
  expiresAt: Date | null;
  workspaceName?: string | null;
  owner?: {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };
} | null> {
  try {
    const share = await prisma.workspaceShare.findUnique({
      where: { token },
    });
    if (!share) {
      return null;
    }
    const owner = await getUserInfo(share.createdBy);
    const workspaceName = await getWorkspaceName(share.workspaceId);

    return {
      workspaceId: share.workspaceId,
      createdBy: share.createdBy,
      expiresAt: share.expiresAt,
      workspaceName,
      owner: owner || undefined,
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
              // Only auto-assign if workspace actually exists (has state, shares, etc.)
              // This prevents creating entries for orphaned workspace IDs stored in client localStorage
              const exists = await checkWorkspaceExistence(workspaceId);
              if (!exists) {
                logger.warn("WebSocket connection to non-existent workspace", {
                  workspaceId,
                  userId,
                });
                set.status = 404;
                return {
                  error: "Not Found",
                  message: "Workspace does not exist",
                };
              }
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
        workspaceName: shareInfo.workspaceName,
        owner: shareInfo.owner,
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
        workspaceName: shareInfo.workspaceName,
        owner: shareInfo.owner,
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

      // Also fetch owner info if not in collaborators table (though should be there)
      await prisma.workspace.findUnique({
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

      // Ensure owner is in list (if for some reason not in collaborators)
      // but typically we add owner to collaborators on creation.
      // Filter out duplicates just in case
      const uniqueCollaborators = new Map();
      for (const c of result) {
        uniqueCollaborators.set(c.id, c);
      }

      // Get online status
      const onlineUsers = roomManager.getCollaborators(workspaceId);
      const onlineIds = new Set(onlineUsers.map((u) => u.id));

      return {
        collaborators: Array.from(uniqueCollaborators.values()).map((c) => ({
          ...c,
          isOnline: onlineIds.has(c.id),
        })),
        onlineCount: onlineIds.size,
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
  )

  .get("/api/workspaces", async ({ headers, set }) => {
    const session = await auth.api.getSession({
      headers: toHeaders(headers),
    });

    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

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
      logger.error("Failed to list workspaces", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      set.status = 500;
      return { error: "Failed to list workspaces" };
    }
  })

  .post(
    "/api/workspaces",
    async ({ body, headers, set }) => {
      const { id, name, description } = body;
      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });

      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const workspaceId = id || generateId(16);

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
                role: "owner",
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
        logger.error("Failed to create workspace", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        set.status = 500;
        return { error: "Failed to create workspace" };
      }
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
    async ({ params, body, headers, set }) => {
      const { workspaceId } = params;
      const { name, description } = body;

      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });

      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Check permissions
      const collab = await getCollaborator(workspaceId, session.user.id);
      if (!collab || collab.role !== "owner") {
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
        logger.error("Failed to update workspace", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        set.status = 500;
        return { error: "Failed to update workspace" };
      }
    },
    {
      params: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  );
