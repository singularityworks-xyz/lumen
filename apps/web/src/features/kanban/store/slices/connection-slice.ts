import { createLogger } from "@lumen/logger";
import type { BoardConnection } from "../../types";
import { generateConnectionId } from "../ids";
import type { KanbanStore } from "../types";

const logger = createLogger({ name: "[client] kanban/connection" });

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addConnection"
  | "removeConnection"
  | "updateConnection"
  | "updateConnectionLabel"
  | "toggleConnectionLineStyle"
  | "getConnectionsByBoardId"
>;

export const createConnectionSlice: SliceCreator = (set, get) => ({
  addConnection: (sourceBoardId, targetBoardId, options = {}) => {
    const {
      label,
      lineStyle = "solid",
      sourceHandle = "bottom",
      targetHandle = "top",
      showArrow = true,
    } = options;

    if (sourceBoardId === targetBoardId) {
      logger.warn("Cannot create connection: self-loops not allowed", {
        boardId: sourceBoardId,
      });
      return null;
    }

    const existingConnections = get().boardConnections.allIds;
    const isDuplicate = existingConnections.some((id) => {
      const conn = get().boardConnections.byId[id];
      return (
        conn &&
        conn.source_board_id === sourceBoardId &&
        conn.target_board_id === targetBoardId
      );
    });

    if (isDuplicate) {
      logger.warn("Cannot create connection: duplicate connection exists", {
        sourceBoardId,
        targetBoardId,
      });
      return null;
    }

    const connectionId = generateConnectionId();
    const now = new Date().toISOString();

    const connection: BoardConnection = {
      id: connectionId,
      source_board_id: sourceBoardId,
      target_board_id: targetBoardId,
      label,
      lineStyle,
      sourceHandle,
      targetHandle,
      showArrow,
      created_at: now,
    };

    set((state) => {
      state.boardConnections.byId[connectionId] = connection;
      state.boardConnections.allIds.push(connectionId);
    });

    logger.info("Created board connection", {
      connectionId,
      sourceBoardId,
      targetBoardId,
    });

    return connectionId;
  },

  removeConnection: (connectionId) => {
    const connection = get().boardConnections.byId[connectionId];
    if (!connection) {
      logger.warn("Cannot remove connection: not found", { connectionId });
      return;
    }

    set((state) => {
      delete state.boardConnections.byId[connectionId];
      state.boardConnections.allIds = state.boardConnections.allIds.filter(
        (id) => id !== connectionId
      );
    });

    logger.info("Removed board connection", { connectionId });
  },

  updateConnection: (connectionId, updates) => {
    const connection = get().boardConnections.byId[connectionId];
    if (!connection) {
      logger.warn("Cannot update connection: not found", { connectionId });
      return;
    }

    set((state) => {
      const conn = state.boardConnections.byId[connectionId];
      if (conn) {
        if (updates.label !== undefined) {
          conn.label = updates.label;
        }
        if (updates.lineStyle !== undefined) {
          conn.lineStyle = updates.lineStyle;
        }
        if (updates.sourceHandle !== undefined) {
          conn.sourceHandle = updates.sourceHandle;
        }
        if (updates.targetHandle !== undefined) {
          conn.targetHandle = updates.targetHandle;
        }
        if (updates.showArrow !== undefined) {
          conn.showArrow = updates.showArrow;
        }
      }
    });

    logger.info("Updated connection", { connectionId, updates });
  },

  updateConnectionLabel: (connectionId, label) => {
    const connection = get().boardConnections.byId[connectionId];
    if (!connection) {
      logger.warn("Cannot update connection label: not found", {
        connectionId,
      });
      return;
    }

    set((state) => {
      const conn = state.boardConnections.byId[connectionId];
      if (conn) {
        conn.label = label;
      }
    });

    logger.info("Updated connection label", { connectionId, label });
  },

  toggleConnectionLineStyle: (connectionId) => {
    const connection = get().boardConnections.byId[connectionId];
    if (!connection) {
      logger.warn("Cannot toggle connection line style: not found", {
        connectionId,
      });
      return;
    }

    const newStyle = connection.lineStyle === "solid" ? "dotted" : "solid";

    set((state) => {
      const conn = state.boardConnections.byId[connectionId];
      if (conn) {
        conn.lineStyle = newStyle;
      }
    });

    logger.info("Toggled connection line style", { connectionId, newStyle });
  },

  getConnectionsByBoardId: (boardId) => {
    const allConnections = get().boardConnections.allIds;
    return allConnections
      .map((id) => get().boardConnections.byId[id])
      .filter(
        (conn) =>
          conn &&
          (conn.source_board_id === boardId || conn.target_board_id === boardId)
      )
      .filter((conn): conn is BoardConnection => conn !== undefined);
  },
});
