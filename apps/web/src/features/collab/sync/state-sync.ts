import { createLogger } from "@lumen/logger";
import type * as Y from "yjs";
import {
  needsRepair,
  repairState,
} from "@/src/features/collab/validation/fixer";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { YJS_MAP_NAMES } from "./entity-sync";
import {
  areaPositionSync,
  areaSync,
  boardConnectionSync,
  boardPositionSync,
  boardSync,
  columnSync,
  taskSync,
} from "./syncs";

const logger = createLogger({ name: "collab:state-sync" });

// Apply all Y.Doc data to Zustand state.
// Returns a partial state that can be merged with existing state.
export function applyYjsToState(doc: Y.Doc): Partial<KanbanState> {
  const boards = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));
  const columns = columnSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.COLUMNS));
  const tasks = taskSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.TASKS));
  const boardPositions = boardPositionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS)
  );
  const boardConnections = boardConnectionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS)
  );
  const areas = areaSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.AREAS));
  const areaPositions = areaPositionSync.applyFromYjs(
    doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS)
  );

  logger.debug("Applied Yjs to state", {
    boards: boards.allIds.length,
    columns: columns.allIds.length,
    tasks: tasks.allIds.length,
    boardPositions: boardPositions.allIds.length,
    boardConnections: boardConnections.allIds.length,
    areas: areas.allIds.length,
    areaPositions: areaPositions.allIds.length,
  });

  return {
    boards,
    columns,
    tasks,
    boardPositions,
    boardConnections,
    areas,
    areaPositions,
  };
}

// Apply Yjs data and run fixers if needed.
export function applyYjsToStateWithRepair(
  doc: Y.Doc,
  currentState: KanbanState
): Partial<KanbanState> {
  const yjsState = applyYjsToState(doc);

  // Merge with current state for repair check
  const mergedState = {
    ...currentState,
    ...yjsState,
  };

  // Run fixers if needed
  if (needsRepair(mergedState)) {
    logger.info("Running state repair after Yjs sync");
    const repairedState = repairState(mergedState);

    // Return only the repaired entity maps
    return {
      boards: repairedState.boards,
      columns: repairedState.columns,
      tasks: repairedState.tasks,
      boardPositions: repairedState.boardPositions,
      boardConnections: repairedState.boardConnections,
      areas: repairedState.areas,
      areaPositions: repairedState.areaPositions,
    };
  }

  return yjsState;
}

// Initialize Y.Doc from Zustand state (only if Y.Maps are empty).
export function initializeYjsFromState(doc: Y.Doc, state: KanbanState): void {
  boardSync.initializeYjs(doc, state.boards);
  columnSync.initializeYjs(doc, state.columns);
  taskSync.initializeYjs(doc, state.tasks);
  boardPositionSync.initializeYjs(doc, state.boardPositions);
  boardConnectionSync.initializeYjs(doc, state.boardConnections);
  areaSync.initializeYjs(doc, state.areas);
  areaPositionSync.initializeYjs(doc, state.areaPositions);

  logger.info("Initialized Yjs from Zustand state");
}

// Observe all Y.Maps for changes and call handler.
export function observeYjsChanges(
  doc: Y.Doc,
  onChange: () => void
): () => void {
  const maps = [
    doc.getMap(YJS_MAP_NAMES.BOARDS),
    doc.getMap(YJS_MAP_NAMES.COLUMNS),
    doc.getMap(YJS_MAP_NAMES.TASKS),
    doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS),
    doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS),
    doc.getMap(YJS_MAP_NAMES.AREAS),
    doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS),
  ];

  for (const map of maps) {
    map.observe(onChange);
  }

  return () => {
    for (const map of maps) {
      map.unobserve(onChange);
    }
  };
}
