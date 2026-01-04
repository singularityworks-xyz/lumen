export type { BoardQuickActionsState } from "@lumen/yjs-shared";

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
  status: "todo" | "done" | "trash";
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
  description?: string;
  position: number;
  task_ids: string[];
  progressValue?: number;
  accentColor?: string;
  icon?: string;
};

export type Comment = {
  id: string;
  x: number;
  y: number;
  content: string;
  authorId: string;
  authorName?: string;
  authorImage?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastEditedById?: string;
  lastEditorName?: string;
  lastEditorImage?: string;
  parentId?: string;
  replyCount?: number;
};

export type Board = {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  created_by: string;
  created_at: string;
  column_ids: string[];
  accentColor?: string;
  icon?: string;
};

export type BoardConnection = {
  id: string;
  source_board_id: string;
  target_board_id: string;
  label?: string;
  lineStyle: "solid" | "dotted";
  sourceHandle: "top" | "right" | "bottom" | "left";
  targetHandle: "top" | "right" | "bottom" | "left";
  showArrow: boolean;
  created_at: string;
};

export type WorkspaceDialogState = {
  taskDetailModals: Record<string, TaskDetailModalState>;
  createTaskModals: Record<string, CreateTaskModalState>;
  boardQuickActions: Record<
    string,
    { boardId: string; position: { x: number; y: number } }
  >;
  boardDialogs: Record<string, BoardDialogState>;
  columnQuickActions: Record<
    string,
    {
      columnId: string;
      boardId: string;
      showAddTask: boolean;
      position: { x: number; y: number };
    }
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
  taskQuickActions: Record<
    string,
    {
      taskId: string;
      boardId: string;
      columnId: string;
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
  dialogFocusStack: string[];
  selectedTaskIds: string[];
  selectedBoardId: string | null;
  selectedBoardIds: string[];
};

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  board_ids: string[];
  lastFocusedBoardId?: string | null;
  lastViewport?: ViewportState | null;
  showMiniMap?: boolean;
  customColors?: string[];
  colorUsage?: Record<string, number>;
  iconUsage?: Record<string, number>;
  isShared?: boolean;
  isDeleted?: boolean;
  ownerId?: string;
  ownerName?: string;
  ownerImage?: string;
  shareToken?: string;
  savedDialogState?: WorkspaceDialogState;
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
  userResized?: boolean;
  lastUserWidth?: number;
  lastUserHeight?: number;
};

export type Area = {
  id: string;
  name: string;
  workspace_id: string;
  color: string;
  icon?: string;
  board_ids: string[];
  created_at: string;
};

export type AreaPosition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type InteractionMode = "drag" | "select";

export type CreateTaskModalFormData = {
  title: string;
  description: string;
  priority: Task["priority"];
  progress: number;
  dueDate: string;
  tags: string;
};

export type CreateTaskModalState = {
  id: string;
  boardId: string;
  columnId: string;
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
  formData: CreateTaskModalFormData;
  zIndex: number;
};

export type EditBoardModalFormData = {
  name: string;
  description: string;
};

export type EditBoardModalState = {
  id: string;
  boardId: string;
  position: { x: number; y: number };
  sourcePosition?: { x: number; y: number };
  formData: EditBoardModalFormData;
  zIndex: number;
};

export type TaskDetailModalState = {
  id: string;
  taskId: string;
  boardId: string;
  position: { x: number; y: number };
  zIndex: number;
  sourceTaskId: string;
  initialIsEditing?: boolean;
  isEditing?: boolean;
  openedFromQuickActions?: boolean;
  draftTitle?: string;
  draftDescription?: string;
  draftPriority?: "low" | "medium" | "high";
  draftProgress?: number;
  draftDueDate?: string;
  draftTags?: string;
  draftColumnId?: string;
  draftChecklists?: Checklist[];
  draftLastUpdatedBy?: string;
  draftLastUpdatedAt?: number;
};

export type BoardDialogType =
  | "rename"
  | "duplicate"
  | "delete"
  | "properties"
  | "color-icon-picker";

export type BoardDialogState = {
  id: string;
  type: BoardDialogType;
  boardId: string;
  boardName: string;
  boardDescription?: string;
  position: { x: number; y: number };
  zIndex: number;
  inputValue?: string;
  descriptionValue?: string;
  newName?: string;
  copyConnections?: boolean;
  columnCount?: number;
  taskCount?: number;
  connectionCount?: number;
  columnProgressValues?: Record<string, number>;
  columnId?: string;
  targetType?: "board" | "column";
  sourceDialogId?: string;
  expandedColumnId?: string | null;
  activeTab?: "progress" | "style";
};

export type ConnectionDialogState = {
  boardId: string;
  position: { x: number; y: number };
} | null;

export type UIState = {
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskModals: Record<string, CreateTaskModalState>;
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
  comments: EntityMap<Comment>;
  boardPositions: EntityMap<BoardPosition>;
  boardConnections: EntityMap<BoardConnection>;
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
  accentColor?: string;
  icon?: string;
};

export type DenormalizedColumn = {
  id: string;
  board_id: string;
  name: string;
  description?: string;
  position: number;
  tasks: Task[];
  progressValue?: number;
  accentColor?: string;
  icon?: string;
};
