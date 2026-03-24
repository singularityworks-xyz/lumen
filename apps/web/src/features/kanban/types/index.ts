export type { BoardQuickActionsState, ChatMessage } from "@lumen/yjs-shared";

export interface Profile {
  avatar_url?: string;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  role: "admin" | "employee";
}

export interface Task {
  assigned_to?: string;
  board_id: string;
  checklists?: Checklist[];
  column_id: string;
  created_at: string;
  created_by: string;
  description?: string;
  due_date?: string;
  id: string;
  position: number;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "todo" | "done" | "trash";
  tags?: string[];
  title: string;
  updated_at: string;
}

export interface Checklist {
  completed: boolean;
  id: string;
  position: number;
  task_id: string;
  title: string;
}

export interface Column {
  accentColor?: string;
  board_id: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  position: number;
  progressValue?: number;
  task_ids: string[];
}

export interface Comment {
  authorId: string;
  authorImage?: string;
  authorName?: string;
  content: string;
  createdAt: string;
  id: string;
  lastEditedById?: string;
  lastEditorImage?: string;
  lastEditorName?: string;
  parentId?: string;
  replyCount?: number;
  updatedAt: string;
  workspaceId: string;
  x: number;
  y: number;
}

export interface Board {
  accentColor?: string;
  column_ids: string[];
  created_at: string;
  created_by: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  workspace_id: string;
}

export interface BoardConnection {
  created_at: string;
  id: string;
  label?: string;
  lineStyle: "solid" | "dotted";
  showArrow: boolean;
  source_board_id: string;
  sourceHandle: "top" | "right" | "bottom" | "left";
  target_board_id: string;
  targetHandle: "top" | "right" | "bottom" | "left";
}

export interface WorkspaceDialogState {
  areaDialogs: Record<
    string,
    {
      id: string;
      areaId: string;
      areaName: string;
      position: { x: number; y: number };
      inputValue?: string;
    }
  >;
  boardDialogs: Record<string, BoardDialogState>;
  boardQuickActions: Record<
    string,
    { boardId: string; position: { x: number; y: number } }
  >;
  columnDialogs: Record<
    string,
    {
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
    }
  >;
  columnQuickActions: Record<
    string,
    {
      columnId: string;
      boardId: string;
      showAddTask: boolean;
      position: { x: number; y: number };
    }
  >;
  connectionDialog: {
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
  } | null;
  createTaskModals: Record<string, CreateTaskModalState>;
  dialogFocusStack: string[];
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  taskDetailModals: Record<string, TaskDetailModalState>;
  taskQuickActions: Record<
    string,
    {
      taskId: string;
      boardId: string;
      columnId: string;
      position: { x: number; y: number };
    }
  >;
}

export interface Workspace {
  aiEnabled?: boolean;
  board_ids: string[];
  colorUsage?: Record<string, number>;
  created_at: string;
  customColors?: string[];
  description?: string;
  iconUsage?: Record<string, number>;
  id: string;
  isDeleted?: boolean;
  isShared?: boolean;
  lastFocusedBoardId?: string | null;
  lastViewport?: ViewportState | null;
  name: string;
  ownerId?: string;
  ownerImage?: string;
  ownerName?: string;
  savedDialogState?: WorkspaceDialogState;
  shareToken?: string;
  showMiniMap?: boolean;
}

export interface EntityMap<T> {
  allIds: string[];
  byId: Record<string, T>;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasState {
  focusedBoardId: string | null;
  lastInteractionTime: number;
  viewport: ViewportState;
}

export interface BoardPosition {
  height?: number;
  id: string;
  lastUserHeight?: number;
  lastUserWidth?: number;
  userResized?: boolean;
  width?: number;
  x: number;
  y: number;
  zIndex: number;
}

export interface Area {
  board_ids: string[];
  color: string;
  created_at: string;
  icon?: string;
  id: string;
  name: string;
  workspace_id: string;
}

export interface AreaPosition {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}

export type InteractionMode = "drag" | "select";

export interface CreateTaskModalFormData {
  description: string;
  dueDate: string;
  priority: Task["priority"];
  progress: number;
  tags: string;
  title: string;
}

export interface CreateTaskModalState {
  boardId: string;
  columnId: string;
  formData: CreateTaskModalFormData;
  id: string;
  position: { x: number; y: number };
  sourcePosition?: { x: number; y: number };
  sourceRect?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  };
  sourceType?: "board-menu" | "board-header" | "column-menu" | "column-header";
  zIndex: number;
}

export interface EditBoardModalFormData {
  description: string;
  name: string;
}

export interface EditBoardModalState {
  boardId: string;
  formData: EditBoardModalFormData;
  id: string;
  position: { x: number; y: number };
  sourcePosition?: { x: number; y: number };
  zIndex: number;
}

export interface TaskDetailModalState {
  boardId: string;
  draftChecklists?: Checklist[];
  draftColumnId?: string;
  draftDescription?: string;
  draftDueDate?: string;
  draftLastUpdatedAt?: number;
  draftLastUpdatedBy?: string;
  draftPriority?: "low" | "medium" | "high";
  draftProgress?: number;
  draftTags?: string;
  draftTitle?: string;
  id: string;
  initialIsEditing?: boolean;
  isEditing?: boolean;
  openedFromQuickActions?: boolean;
  position: { x: number; y: number };
  sourceTaskId: string;
  taskId: string;
  zIndex: number;
}

export type BoardDialogType =
  | "rename"
  | "duplicate"
  | "delete"
  | "properties"
  | "color-icon-picker";

export interface BoardDialogState {
  activeTab?: "progress" | "style";
  boardDescription?: string;
  boardId: string;
  boardName: string;
  columnCount?: number;
  columnId?: string;
  columnProgressValues?: Record<string, number>;
  connectionCount?: number;
  copyConnections?: boolean;
  descriptionValue?: string;
  expandedColumnId?: string | null;
  id: string;
  inputValue?: string;
  newName?: string;
  position: { x: number; y: number };
  sourceDialogId?: string;
  targetType?: "board" | "column";
  taskCount?: number;
  type: BoardDialogType;
  zIndex: number;
}

export type ConnectionDialogState = {
  boardId: string;
  position: { x: number; y: number };
} | null;

export interface UIState {
  createTaskModals: Record<string, CreateTaskModalState>;
  draggedTaskId: string | null;
  interactionMode: InteractionMode;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  showCommandPalette: boolean;
  showMiniMap: boolean;
}

export interface PersistedState {
  boardConnections: EntityMap<BoardConnection>;
  boardPositions: EntityMap<BoardPosition>;
  boards: EntityMap<Board>;
  canvas: CanvasState;
  columns: EntityMap<Column>;
  comments: EntityMap<Comment>;
  currentWorkspaceId: string | null;
  tasks: EntityMap<Task>;
  workspaces: EntityMap<Workspace>;
}

export interface BoardNode {
  data: {
    boardId: string;
    isSelected: boolean;
    [key: string]: unknown;
  };
  height?: number;
  id: string;
  position: { x: number; y: number };
  type: "board";
  width?: number;
}

export interface DenormalizedBoard {
  accentColor?: string;
  columns: DenormalizedColumn[];
  created_at: string;
  created_by: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  workspace_id: string;
}

export interface DenormalizedColumn {
  accentColor?: string;
  board_id: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  position: number;
  progressValue?: number;
  tasks: Task[];
}
