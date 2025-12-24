import {
  AreaPositionSchema,
  AreaSchema,
  BoardConnectionSchema,
  BoardPositionSchema,
  BoardSchema,
  ColumnSchema,
  TaskSchema,
} from "@/src/features/collab/validation/schema";
import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Task,
} from "@/src/features/kanban/types";
import { createEntitySync, YJS_MAP_NAMES } from "./entity-sync";

// Pre-configured sync helpers for all Kanban entity types.
export const boardSync = createEntitySync<Board>({
  mapName: YJS_MAP_NAMES.BOARDS,
  schema: BoardSchema,
  entityName: "board",
});

export const columnSync = createEntitySync<Column>({
  mapName: YJS_MAP_NAMES.COLUMNS,
  schema: ColumnSchema,
  entityName: "column",
});

export const taskSync = createEntitySync<Task>({
  mapName: YJS_MAP_NAMES.TASKS,
  schema: TaskSchema,
  entityName: "task",
});

export const boardPositionSync = createEntitySync<BoardPosition>({
  mapName: YJS_MAP_NAMES.BOARD_POSITIONS,
  schema: BoardPositionSchema,
  entityName: "boardPosition",
});

export const boardConnectionSync = createEntitySync<BoardConnection>({
  mapName: YJS_MAP_NAMES.BOARD_CONNECTIONS,
  schema: BoardConnectionSchema,
  entityName: "boardConnection",
});

export const areaSync = createEntitySync<Area>({
  mapName: YJS_MAP_NAMES.AREAS,
  schema: AreaSchema,
  entityName: "area",
});

export const areaPositionSync = createEntitySync<AreaPosition>({
  mapName: YJS_MAP_NAMES.AREA_POSITIONS,
  schema: AreaPositionSchema,
  entityName: "areaPosition",
});

export const allSyncs = {
  boards: boardSync,
  columns: columnSync,
  tasks: taskSync,
  boardPositions: boardPositionSync,
  boardConnections: boardConnectionSync,
  areas: areaSync,
  areaPositions: areaPositionSync,
} as const;
