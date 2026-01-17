import { createLogger } from "@lumen/logger";
import { roomManager } from "../../../collab";

// biome-ignore lint/performance/noBarrelFile: Re-export types and utilities from @lumen/ai for action executors
export {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  mapPriority,
  type ToolExecutionResult,
  type WorkspaceSnapshot,
} from "@lumen/ai/tools";

export const logger = createLogger({ name: "ai:tool-executor" });

/**
 * Get workspace Yjs document for action tools (create, update, delete).
 * This is needed because action tools modify shared state via Yjs.
 *
 * For shared workspaces: Uses Yjs for real-time collaboration
 * For local workspaces: Returns null (action tools are not supported)
 *
 * @deprecated For query tools, use getWorkspaceFromSnapshot from @lumen/ai instead.
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
