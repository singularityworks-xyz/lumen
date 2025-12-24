"use client";

import { createLogger } from "@lumen/logger";
import { useCallback, useEffect, useRef } from "react";
import type * as Y from "yjs";
import { useKanbanStore } from "../store";
import type { Board, BoardPosition, Column, Task, Workspace } from "../types";

const logger = createLogger({ name: "collab:yjs-zustand" });

type EntityType = "workspace" | "board" | "column" | "task" | "boardPosition";

/**
 * Creates a bidirectional binding between Yjs Y.Maps and Zustand store.
 *
 * Design principles:
 * - Yjs is source of truth when connected
 * - Zustand actions are intercepted and applied to Y.Doc
 * - Y.Doc changes are batched and applied to Zustand
 * - Local changes work offline via IndexedDB persistence
 */
export function useYjsZustandBinding(doc: Y.Doc | null, isConnected: boolean) {
  const isUpdatingFromYjsRef = useRef(false);
  const _store = useKanbanStore();

  // Get Y.Maps from doc
  const getYMap = useCallback(
    <T>(name: string): Y.Map<T> | null => {
      if (!doc) {
        return null;
      }
      return doc.getMap(name) as Y.Map<T>;
    },
    [doc]
  );

  // Apply Yjs changes to Zustand (batched)
  const applyYjsToZustand = useCallback(() => {
    if (!(doc && isConnected)) {
      return;
    }

    isUpdatingFromYjsRef.current = true;

    try {
      const workspaceMap = getYMap<Workspace>("workspace");
      const boardsMap = getYMap<Board>("boards");
      const columnsMap = getYMap<Column>("columns");
      const tasksMap = getYMap<Task>("tasks");
      const boardPositionsMap = getYMap<BoardPosition>("boardPositions");

      if (
        !(
          workspaceMap &&
          boardsMap &&
          columnsMap &&
          tasksMap &&
          boardPositionsMap
        )
      ) {
        return;
      }

      const boards: Record<string, Board> = {};
      boardsMap.forEach((board, id) => {
        boards[id] = board;
      });

      const columns: Record<string, Column> = {};
      columnsMap.forEach((column, id) => {
        columns[id] = column;
      });

      const tasks: Record<string, Task> = {};
      tasksMap.forEach((task, id) => {
        tasks[id] = task;
      });

      const boardPositions: Record<string, BoardPosition> = {};
      boardPositionsMap.forEach((pos, id) => {
        boardPositions[id] = pos;
      });

      useKanbanStore.setState({
        boards: {
          byId: boards,
          allIds: Object.keys(boards),
        },
        columns: {
          byId: columns,
          allIds: Object.keys(columns),
        },
        tasks: {
          byId: tasks,
          allIds: Object.keys(tasks),
        },
        boardPositions: {
          byId: boardPositions,
          allIds: Object.keys(boardPositions),
        },
      });

      logger.debug("Applied Yjs changes to Zustand", {
        boards: Object.keys(boards).length,
        columns: Object.keys(columns).length,
        tasks: Object.keys(tasks).length,
      });
    } finally {
      isUpdatingFromYjsRef.current = false;
    }
  }, [doc, isConnected, getYMap]);

  const applyZustandToYjs = useCallback(
    (entityType: EntityType, id: string, data: unknown, isDelete = false) => {
      if (!(doc && isConnected) || isUpdatingFromYjsRef.current) {
        return;
      }

      const mapName =
        entityType === "boardPosition" ? "boardPositions" : `${entityType}s`;
      const map = doc.getMap(mapName);

      doc.transact(() => {
        if (isDelete) {
          map.delete(id);
          logger.debug("Deleted from Yjs", { entityType, id });
        } else {
          map.set(id, data);
          logger.debug("Updated in Yjs", { entityType, id });
        }
      });
    },
    [doc, isConnected]
  );

  const initializeYjsFromZustand = useCallback(() => {
    if (!(doc && isConnected)) {
      return;
    }

    const state = useKanbanStore.getState();

    doc.transact(() => {
      // Sync boards
      const boardsMap = doc.getMap("boards");
      if (boardsMap.size === 0) {
        for (const board of Object.values(state.boards.byId)) {
          boardsMap.set(board.id, board);
        }
      }

      // Sync columns
      const columnsMap = doc.getMap("columns");
      if (columnsMap.size === 0) {
        for (const column of Object.values(state.columns.byId)) {
          columnsMap.set(column.id, column);
        }
      }

      // Sync tasks
      const tasksMap = doc.getMap("tasks");
      if (tasksMap.size === 0) {
        for (const task of Object.values(state.tasks.byId)) {
          tasksMap.set(task.id, task);
        }
      }

      // Sync board positions
      const positionsMap = doc.getMap("boardPositions");
      if (positionsMap.size === 0) {
        for (const pos of Object.values(state.boardPositions.byId)) {
          positionsMap.set(pos.id, pos);
        }
      }
    });

    logger.info("Initialized Yjs from Zustand state");
  }, [doc, isConnected]);

  // Set up observers
  useEffect(() => {
    if (!(doc && isConnected)) {
      return;
    }

    // Initialize on connection
    initializeYjsFromZustand();

    // Observe Y.Map changes
    const boardsMap = doc.getMap("boards");
    const columnsMap = doc.getMap("columns");
    const tasksMap = doc.getMap("tasks");
    const boardPositionsMap = doc.getMap("boardPositions");

    const handleChange = () => {
      applyYjsToZustand();
    };

    boardsMap.observe(handleChange);
    columnsMap.observe(handleChange);
    tasksMap.observe(handleChange);
    boardPositionsMap.observe(handleChange);

    return () => {
      boardsMap.unobserve(handleChange);
      columnsMap.unobserve(handleChange);
      tasksMap.unobserve(handleChange);
      boardPositionsMap.unobserve(handleChange);
    };
  }, [doc, isConnected, initializeYjsFromZustand, applyYjsToZustand]);

  return {
    applyZustandToYjs,
    isUpdatingFromYjs: isUpdatingFromYjsRef.current,
  };
}
