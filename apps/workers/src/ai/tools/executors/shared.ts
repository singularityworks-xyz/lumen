import { createLogger } from "@lumen/logger";
import { roomManager } from "../../../collab/room-manager";

export const logger = createLogger({ name: "ai:tool-executor" });

export type ToolExecutionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
};

export type ExecutorContext = {
  workspaceId: string;
  userId: string;
};

// Helper to get room doc safely
export async function getWorkspaceDoc(workspaceId: string) {
  let room = roomManager.getRoom(workspaceId);
  if (!room) {
    room = roomManager.getOrCreateRoom(workspaceId);
    try {
      await roomManager.loadRoomState(workspaceId);
    } catch (error) {
      logger.error("Failed to load room state", { workspaceId, error });
      return null;
    }
  }
  return room.doc;
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
