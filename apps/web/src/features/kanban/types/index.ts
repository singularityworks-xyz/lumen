export type Profile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: "admin" | "employee";
  created_at: string;
};

export type Task = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  progress: number;
  position: number;
  due_date?: string;
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  checklists?: Checklist[];
};

export type Checklist = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
};

export type Column = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  task_ids: string[];
};

export type Board = {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  created_by: string;
  created_at: string;
  column_ids: string[];
};

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  board_ids: string[];
};

export type EntityMap<T> = {
  byId: Record<string, T>;
  allIds: string[];
};

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasState = {
  viewport: ViewportState;
  focusedBoardId: string | null;
  lastInteractionTime: number;
};

export type BoardPosition = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex: number;
};

export type InteractionMode = "drag" | "select";

export type UIState = {
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskColumnId: string | null;
  interactionMode: InteractionMode;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  draggedTaskId: string | null;
};

export type PersistedState = {
  workspaces: EntityMap<Workspace>;
  boards: EntityMap<Board>;
  columns: EntityMap<Column>;
  tasks: EntityMap<Task>;
  boardPositions: EntityMap<BoardPosition>;
  currentWorkspaceId: string | null;
  canvas: CanvasState;
};

export type BoardNode = {
  id: string;
  type: "board";
  position: { x: number; y: number };
  data: {
    boardId: string;
    isSelected: boolean;
  };
  width?: number;
  height?: number;
};

export type DenormalizedBoard = {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  created_by: string;
  created_at: string;
  columns: DenormalizedColumn[];
};

export type DenormalizedColumn = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  tasks: Task[];
};
