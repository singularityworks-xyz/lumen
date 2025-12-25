import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import { YJS_MAP_NAMES } from "@lumen/yjs-shared";
import { roomManager } from "./room-manager";

const logger = createLogger({ name: "collab:helpers" });

export function generateId(length = 16): string {
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

export const CURSOR_COLORS = [
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

export function getColorForUser(userId: string): string {
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

export function toHeaders(
  elysiaHeaders: Record<string, string | undefined>
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(elysiaHeaders)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

export async function getCollaborator(
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

export async function addCollaborator(
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
        // Try to get name from active room first
        const room = roomManager.getRoom(workspaceId);
        let initialName = "Untitled Workspace";
        if (room) {
          const workspaceMap = room.doc.getMap(YJS_MAP_NAMES.WORKSPACE);
          const workspaceData = workspaceMap.get(workspaceId) as
            | { name: string }
            | undefined;
          if (workspaceData?.name) {
            initialName = workspaceData.name;
          }
        }

        await prisma.workspace.create({
          data: {
            id: workspaceId,
            name: initialName,
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
export async function checkWorkspaceExistence(
  idToCheck: string
): Promise<boolean> {
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

export async function createShareToken(
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

export async function getUserInfo(userId: string): Promise<{
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

export async function getWorkspaceName(
  workspaceId: string
): Promise<string | null> {
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

// Get share link info including owner and workspace name
export async function getShareInfo(token: string): Promise<{
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

// Get the count of collaborators on a workspace
export async function getWorkspaceCollaboratorCount(
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
