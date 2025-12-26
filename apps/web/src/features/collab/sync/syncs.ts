import {
  AreaPositionSchema,
  AreaSchema,
  BoardConnectionSchema,
  BoardDialogSchema,
  BoardPositionSchema,
  BoardQuickActionsSchema,
  BoardSchema,
  ColumnDialogSchema,
  ColumnQuickActionsSchema,
  ColumnSchema,
  ConnectionDialogSchema,
  CreateTaskModalSchema,
  TaskSchema,
  WorkspaceSchema,
} from "@/src/features/collab/validation/schema";
import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardDialogState,
  BoardPosition,
  BoardQuickActionsState,
  Column,
  CreateTaskModalState,
  Task,
  Workspace,
} from "@/src/features/kanban/types";
import { createEntitySync, YJS_MAP_NAMES } from "./entity-sync";

// Pre-configured sync helpers for all Kanban entity types.
export const boardSync = createEntitySync<Board>({
  mapName: YJS_MAP_NAMES.BOARDS,
  schema: BoardSchema,
  entityName: "board",
});

export const workspaceSync = createEntitySync<Workspace>({
  mapName: YJS_MAP_NAMES.WORKSPACE,
  schema: WorkspaceSchema,
  entityName: "workspace",
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

export const boardQuickActionsSync = createEntitySync<BoardQuickActionsState>({
  mapName: YJS_MAP_NAMES.BOARD_QUICK_ACTIONS,
  schema: BoardQuickActionsSchema,
  entityName: "boardQuickActions",
});

export const boardDialogSync = createEntitySync<BoardDialogState>({
  mapName: YJS_MAP_NAMES.BOARD_DIALOGS,
  schema: BoardDialogSchema,
  entityName: "boardDialog",
});

export const connectionDialogSync = createEntitySync<{
  id: string;
  boardId: string;
  position: { x: number; y: number };
  selectedTargetId?: string | null;
  editingConnectionId?: string | null;
  sourceHandle?: "top" | "right" | "bottom" | "left";
  targetHandle?: "top" | "right" | "bottom" | "left";
  lineStyle?: "solid" | "dotted";
  showArrow?: boolean;
  label?: string;
  searchQuery?: string;
}>({
  mapName: YJS_MAP_NAMES.CONNECTION_DIALOGS,
  schema: ConnectionDialogSchema,
  entityName: "connectionDialog",
});

export const createTaskModalSync = createEntitySync<CreateTaskModalState>({
  mapName: YJS_MAP_NAMES.CREATE_TASK_MODALS,
  schema: CreateTaskModalSchema,
  entityName: "createTaskModal",
});

export const columnQuickActionsSync = createEntitySync<{
  id: string;
  columnId: string;
  boardId: string;
  showAddTask: boolean;
  position: { x: number; y: number };
}>({
  mapName: YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS,
  schema: ColumnQuickActionsSchema,
  entityName: "columnQuickActions",
});

export const columnDialogSync = createEntitySync<{
  id: string;
  type: "rename" | "delete" | "move";
  columnId: string;
  columnName: string;
  columnDescription?: string;
  boardId: string;
  boardName: string;
  inputValue?: string;
  descriptionValue?: string;
  position: { x: number; y: number };
}>({
  mapName: YJS_MAP_NAMES.COLUMN_DIALOGS,
  schema: ColumnDialogSchema,
  entityName: "columnDialog",
});

export const allSyncs = {
  boards: boardSync,
  columns: columnSync,
  tasks: taskSync,
  boardPositions: boardPositionSync,
  boardConnections: boardConnectionSync,
  areas: areaSync,
  areaPositions: areaPositionSync,
  workspace: workspaceSync,
  boardQuickActions: boardQuickActionsSync,
  boardDialogs: boardDialogSync,
  connectionDialogs: connectionDialogSync,
  createTaskModals: createTaskModalSync,
  columnQuickActions: columnQuickActionsSync,
  columnDialogs: columnDialogSync,
} as const;
