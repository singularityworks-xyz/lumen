// Yjs Document Accessor for AI Action Tools
// This module provides access to Yjs documents for action tools that need to
// mutate shared workspace state. This is ONLY used for shared workspaces -
// local workspaces return ActionInstructions instead.

import { createLogger } from "@lumen/logger";
import type { Doc } from "yjs";
import type { RoomManager } from "../../../collab";
import { roomManager } from "../../../collab";

export const logger = createLogger({ name: "ai:tool-executor" });

// Default room manager instance - can be overridden for testing
let _roomManager: RoomManager = roomManager;

/**
 * Set the room manager instance (for testing purposes)
 * @internal
 */
export function _setRoomManager(manager: RoomManager): void {
  _roomManager = manager;
}

/**
 * Reset the room manager to the default instance (for testing purposes)
 * @internal
 */
export function _resetRoomManager(): void {
  _roomManager = roomManager;
}

// Get workspace Yjs document for action tools (create, update, delete).
// This is needed because action tools modify shared state via Yjs.
// This function should ONLY be called for shared workspaces. For local
// workspaces, the tool-executor returns ActionInstructions instead.
export async function getWorkspaceYjsDoc(
  workspaceId: string
): Promise<Doc | null> {
  // First try to get existing room (user is connected via WebSocket)
  let room = _roomManager.getRoom(workspaceId);

  logger.debug("getWorkspaceYjsDoc called", {
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
    const loaded = await _roomManager.loadRoomState(workspaceId);
    if (!loaded) {
      logger.warn("Failed to load workspace state from database", {
        workspaceId,
      });
      return null;
    }

    // Get the room that was created during loadRoomState
    room = _roomManager.getRoom(workspaceId);

    // Schedule cleanup for rooms loaded from database (zero connections)
    if (room && room.connections.size === 0) {
      _roomManager.scheduleRoomCleanup(workspaceId);
    }

    return room?.doc ?? null;
  } catch (error) {
    logger.error("Failed to load room state", { workspaceId, error });
    return null;
  }
}
