import { createLogger } from "@lumen/logger";
import { roomManager } from "../../../collab";

export const logger = createLogger({ name: "ai:tool-executor" });

export type ToolExecutionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
};

export type WorkspaceSnapshot = {
  name: string;
  boards: Array<{
    id: string;
    name: string;
    description?: string;
    accentColor?: string;
    icon?: string;
    columns: Array<{
      id: string;
      name: string;
      description?: string;
      position: number;
      accentColor?: string;
      icon?: string;
      tasks: Array<{
        id: string;
        title: string;
        description?: string;
        priority: "low" | "medium" | "high";
        status: "todo" | "done" | "trash";
        progress: number;
        position: number;
        dueDate?: string;
        tags?: string[];
        assignedTo?: string;
      }>;
    }>;
  }>;
};

export type ExecutorContext = {
  workspaceId: string;
  userId: string;
  snapshot?: WorkspaceSnapshot;
};

export function getWorkspaceFromSnapshot(
  ctx: ExecutorContext
): WorkspaceSnapshot | null {
  if (ctx.snapshot) {
    logger.debug("Using workspace snapshot from client", {
      workspaceId: ctx.workspaceId,
      boardCount: ctx.snapshot.boards.length,
    });
    return ctx.snapshot;
  }

  logger.warn(
    "No workspace snapshot provided, AI tools may not work correctly",
    {
      workspaceId: ctx.workspaceId,
    }
  );
  return null;
}

export function mapPriority(priority?: string): "low" | "medium" | "high" {
  if (!priority) {
    return "medium";
  }
  if (priority === "urgent") {
    return "high";
  }
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}

/**
 * Get workspace Yjs document for action tools (create, update, delete).
 * This is needed because action tools modify shared state via Yjs.
 * @deprecated For query tools, use getWorkspaceFromSnapshot instead.
 */
export async function getWorkspaceDoc(workspaceId: string) {
  // First try to get existing room (user is connected via WebSocket)
  let room = roomManager.getRoom(workspaceId);

  logger.debug("getWorkspaceDoc called", {
    workspaceId,
    roomExists: !!room,
    roomConnectionCount: room?.connections?.size ?? 0,
  });

  if (room) {
    // Room exists with live data from connected client
    const boardsMap = room.doc.getMap("boards");
    logger.debug("Room found with data", {
      workspaceId,
      boardCount: boardsMap.size,
      connectionCount: room.connections.size,
    });
    return room.doc;
  }

  // No active room - try to load from database
  logger.debug("No active room, loading state from database", { workspaceId });

  try {
    const loaded = await roomManager.loadRoomState(workspaceId);
    if (!loaded) {
      logger.warn("Failed to load workspace state from database", {
        workspaceId,
      });
      return null;
    }

    // Get the room that was created during loadRoomState
    room = roomManager.getRoom(workspaceId);
    return room?.doc ?? null;
  } catch (error) {
    logger.error("Failed to load room state", { workspaceId, error });
    return null;
  }
}
