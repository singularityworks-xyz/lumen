import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardDialogState,
  BoardDialogType,
  BoardPosition,
  CanvasState,
  Column,
  Comment,
  CreateTaskModalFormData,
  CreateTaskModalState,
  EntityMap,
  InteractionMode,
  Task,
  TaskDetailModalState,
  ViewportState,
  Workspace,
} from "../types";

export type ColumnUiState = {
  isBottomExpanded: boolean;
  bottomView: "finished" | "trash";
};

export type KanbanState = {
  workspaces: EntityMap<Workspace>;
  boards: EntityMap<Board>;
  columns: EntityMap<Column>;
  tasks: EntityMap<Task>;
  comments: EntityMap<Comment>;
  boardPositions: EntityMap<BoardPosition>;
  boardConnections: EntityMap<BoardConnection>;
  areas: EntityMap<Area>;
  areaPositions: EntityMap<AreaPosition>;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  currentWorkspaceId: string | null;
  canvas: CanvasState;
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskModals: Record<string, CreateTaskModalState>;
  taskDetailModals: Record<string, TaskDetailModalState>;
  interactionMode: InteractionMode;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  workspaceShareUrls: Record<string, string>; // workspaceId -> shareUrl
  selectedTaskIds: string[];
  draggedTaskId: string | null;
  shakingTaskDetailModalId: string | null;
  workspaceQuickActions: {
    workspaceId: string;
    position: { x: number; y: number };
  } | null;
  workspaceDialog: {
    type: "rename" | "reset" | "delete" | "duplicate";
    workspaceId: string;
    workspaceName: string;
    position?: { x: number; y: number };
    inputValue?: string;
  } | null;
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
  boardQuickActions: Record<
    string,
    {
      boardId: string;
      position: { x: number; y: number };
    }
  >;
  boardDialogs: Record<string, BoardDialogState>;
  connectionDialog: {
    boardId: string;
    position: { x: number; y: number };
    // Connection config state - synced across collaborators
    selectedTargetId?: string | null;
    editingConnectionId?: string | null;
    sourceHandle?: "top" | "right" | "bottom" | "left";
    targetHandle?: "top" | "right" | "bottom" | "left";
    lineStyle?: "solid" | "dotted";
    showArrow?: boolean;
    label?: string;
    searchQuery?: string;
  } | null;
  taskQuickActions: Record<
    string,
    {
      taskId: string;
      boardId: string;
      columnId: string;
      position: { x: number; y: number };
    }
  >;
  // Z-index management
  dialogFocusStack: string[];
  columnUi: Record<string, ColumnUiState>;
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
  deletedSharedWorkspaceId: string | null;
  isProfileModalOpen: boolean;
  lastTaskModalPositions: Record<string, { x: number; y: number }>;
  // Track drag origins for areas - used to offset contained boards during drag
  areaDragOrigins: Record<string, { originX: number; originY: number }>;
};

export type KanbanActions = {
  // Workspace actions
  setCurrentWorkspace: (workspaceId: string | null) => void;
  addWorkspace: (name: string, description?: string) => string;
  syncWorkspace: (workspace: Partial<Workspace> & { id: string }) => void;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  resetWorkspace: (
    workspaceId: string,
    options?: { clearBoardsAndColumns?: boolean }
  ) => void;
  duplicateWorkspace: (workspaceId: string, newName: string) => string | null;
  openWorkspaceQuickActions: (
    workspaceId: string,
    position: { x: number; y: number }
  ) => void;
  closeWorkspaceQuickActions: () => void;
  updateWorkspaceQuickActionsPosition: (position: {
    x: number;
    y: number;
  }) => void;
  openWorkspaceDialog: (options: {
    type: "rename" | "reset" | "delete" | "duplicate";
    workspaceId: string;
    workspaceName: string;
    position?: { x: number; y: number };
    inputValue?: string;
  }) => void;
  closeWorkspaceDialog: () => void;
  updateWorkspaceDialogPosition: (position: { x: number; y: number }) => void;
  updateWorkspaceDialogInputValue: (value: string) => void;
  setWorkspaceShareUrl: (workspaceId: string, url: string) => void;
  clearWorkspaceShareUrl: (workspaceId: string) => void;
  markWorkspaceDeleted: (workspaceId: string) => void;
  setDeletedSharedWorkspace: (workspaceId: string | null) => void;

  // Profile modal actions
  openProfileModal: () => void;
  closeProfileModal: () => void;

  // Column actions
  openColumnQuickActions: (
    columnId: string,
    boardId: string,
    showAddTask: boolean,
    position: { x: number; y: number }
  ) => void;
  closeColumnQuickActions: (columnId: string) => void;
  updateColumnQuickActionsPosition: (
    columnId: string,
    position: { x: number; y: number }
  ) => void;
  openColumnDialog: (options: {
    type: "rename" | "delete" | "move";
    columnId: string;
    columnName: string;
    columnDescription?: string;
    boardId: string;
    boardName: string;
    inputValue?: string;
    descriptionValue?: string;
    position: { x: number; y: number };
  }) => string;
  closeColumnDialog: (id: string) => void;
  updateColumnDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateColumnDialogInputValue: (id: string, value: string) => void;
  updateColumnDialogDescriptionValue: (id: string, value: string) => void;

  // Area actions
  addArea: (
    name: string,
    position: { x: number; y: number },
    dimensions: { width: number; height: number },
    workspaceId?: string
  ) => string;
  updateArea: (
    areaId: string,
    updates: Partial<Pick<Area, "name" | "color" | "icon">>
  ) => void;
  removeArea: (areaId: string) => void;
  // Updates only the area position (optimized for drag - does NOT update contained boards)
  updateAreaPosition: (
    areaId: string,
    position: { x: number; y: number }
  ) => void;
  // Called on drag end to sync contained board positions with the area
  finalizeAreaDrag: (areaId: string) => void;
  updateAreaDimensions: (
    areaId: string,
    dimensions: { width: number; height: number }
  ) => void;
  setSelectionBox: (
    box: { x: number; y: number; width: number; height: number } | null
  ) => void;
  clearSelectionBox: () => void;
  attachBoardToArea: (areaId: string, boardId: string) => void;
  detachBoardFromArea: (areaId: string, boardId: string) => void;
  openAreaDialog: (options: {
    areaId: string;
    areaName: string;
    position: { x: number; y: number };
  }) => string;
  closeAreaDialog: (id: string) => void;
  updateAreaDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateAreaDialogInputValue: (id: string, value: string) => void;

  // Board actions
  addBoard: (
    name: string,
    position?: { x: number; y: number },
    description?: string
  ) => string;
  updateBoard: (
    boardId: string,
    updates: Partial<
      Pick<Board, "name" | "description" | "accentColor" | "icon">
    >
  ) => void;
  removeBoard: (boardId: string) => void;
  updateBoardPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  finalizeBoardDrag: (boardId: string) => void;
  updateBoardDimensions: (
    boardId: string,
    dimensions: { width: number; height: number },
    isUserResize?: boolean
  ) => void;
  bringBoardToFront: (boardId: string) => void;
  getDenormalizedBoard: (
    boardId: string
  ) => import("../types").DenormalizedBoard | null;
  duplicateBoard: (
    boardId: string,
    newName: string,
    options?: { copyConnections?: boolean }
  ) => string | null;
  openBoardQuickActions: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  closeBoardQuickActions: (boardId: string) => void;
  updateBoardQuickActionsPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  openBoardDialog: (options: {
    type: BoardDialogType;
    boardId: string;
    boardName: string;
    boardDescription?: string;
    position?: { x: number; y: number };
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
  }) => string;
  closeBoardDialog: (id: string) => void;
  updateBoardDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardDialogInputValue: (id: string, value: string) => void;
  updateBoardDialogDescriptionValue: (id: string, value: string) => void;
  updateBoardDialogNewName: (id: string, value: string) => void;
  updateBoardDialogCopyConnections: (id: string, value: boolean) => void;
  updateBoardDialogColumnProgress: (
    id: string,
    columnId: string,
    value: number
  ) => void;
  updateBoardDialogUIState: (
    id: string,
    state: {
      expandedColumnId?: string | null;
      activeTab?: "progress" | "style";
    }
  ) => void;
  openConnectionDialog: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  closeConnectionDialog: () => void;
  updateConnectionDialogPosition: (position: { x: number; y: number }) => void;
  updateConnectionDialogConfig: (config: {
    selectedTargetId?: string | null;
    editingConnectionId?: string | null;
    sourceHandle?: "top" | "right" | "bottom" | "left";
    targetHandle?: "top" | "right" | "bottom" | "left";
    lineStyle?: "solid" | "dotted";
    showArrow?: boolean;
    label?: string;
    searchQuery?: string;
  }) => void;

  // Task quick actions
  openTaskQuickActions: (
    taskId: string,
    boardId: string,
    columnId: string,
    position: { x: number; y: number }
  ) => void;
  closeTaskQuickActions: (taskId: string) => void;
  updateTaskQuickActionsPosition: (
    taskId: string,
    position: { x: number; y: number }
  ) => void;

  // Column actions
  addColumn: (boardId: string, name: string, position?: number) => string;
  updateColumn: (
    columnId: string,
    updates: Partial<
      Pick<
        Column,
        | "name"
        | "position"
        | "description"
        | "progressValue"
        | "accentColor"
        | "icon"
      >
    >
  ) => void;
  deleteColumn: (boardId: string, columnId: string) => void;
  moveColumn: (boardId: string, columnId: string, newPosition: number) => void;
  moveColumnToBoard: (
    sourceBoardId: string,
    columnId: string,
    targetBoardId: string
  ) => void;

  // Task actions
  addTask: (
    columnId: string,
    boardId: string,
    title: string,
    options?: Partial<
      Pick<Task, "description" | "priority" | "progress" | "due_date" | "tags">
    >
  ) => string;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    targetBoardId: string
  ) => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  setDraggedTask: (taskId: string | null) => void;
  duplicateTask: (taskId: string) => string | null;

  // Connection actions
  addConnection: (
    sourceBoardId: string,
    targetBoardId: string,
    options?: {
      label?: string;
      lineStyle?: "solid" | "dotted";
      sourceHandle?: "top" | "right" | "bottom" | "left";
      targetHandle?: "top" | "right" | "bottom" | "left";
      showArrow?: boolean;
    }
  ) => string | null;
  removeConnection: (connectionId: string) => void;
  updateConnection: (
    connectionId: string,
    updates: {
      label?: string;
      lineStyle?: "solid" | "dotted";
      sourceHandle?: "top" | "right" | "bottom" | "left";
      targetHandle?: "top" | "right" | "bottom" | "left";
      showArrow?: boolean;
    }
  ) => void;
  updateConnectionLabel: (connectionId: string, label?: string) => void;
  toggleConnectionLineStyle: (connectionId: string) => void;
  getConnectionsByBoardId: (boardId: string) => BoardConnection[];

  // Modal actions
  openCreateTaskModal: (options: {
    columnId: string;
    boardId: string;
    position?: { x: number; y: number };
    sourcePosition?: { x: number; y: number };
    sourceRect?: DOMRect;
    sourceType?:
      | "board-menu"
      | "board-header"
      | "column-menu"
      | "column-header";
  }) => { id: string; position: { x: number; y: number }; isExisting: boolean };
  closeCreateTaskModal: (modalId: string) => void;
  updateModalPosition: (
    modalId: string,
    position: { x: number; y: number }
  ) => void;
  updateModalFormData: (
    modalId: string,
    formData: Partial<CreateTaskModalFormData>
  ) => void;
  bringModalToFront: (modalId: string) => void;
  openTaskDetailModal: (options: {
    taskId: string;
    boardId: string;
    position?: { x: number; y: number };
    initialIsEditing?: boolean;
    openedFromQuickActions?: boolean;
  }) => {
    id: string;
    position: { x: number; y: number };
    isExisting: boolean;
  };
  closeTaskDetailModal: (modalId: string) => void;
  updateTaskDetailModalPosition: (
    modalId: string,
    position: { x: number; y: number }
  ) => void;
  bringTaskDetailModalToFront: (modalId: string) => void;
  triggerTaskDetailModalShake: (modalId: string) => void;
  setTaskDetailModalEditing: (modalId: string, isEditing: boolean) => void;
  updateTaskDetailModalDraft: (
    modalId: string,
    draftData: Partial<
      Pick<
        TaskDetailModalState,
        | "draftTitle"
        | "draftDescription"
        | "draftPriority"
        | "draftProgress"
        | "draftDueDate"
        | "draftTags"
        | "draftColumnId"
        | "draftChecklists"
        | "draftLastUpdatedBy"
        | "draftLastUpdatedAt"
      >
    >
  ) => void;

  // UI actions
  setViewport: (viewport: ViewportState) => void;
  setFocusedBoard: (boardId: string | null) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setSelectedBoard: (boardId: string | null) => void;
  toggleBoardSelection: (boardId: string) => void;
  clearBoardSelection: () => void;
  toggleTaskSelection: (taskId: string) => void;
  clearTaskSelection: () => void;
  updateColumnUi: (columnId: string, updates: Partial<ColumnUiState>) => void;

  // Comment actions
  addComment: (
    position: { x: number; y: number },
    content: string,
    author: { id: string; name?: string; image?: string }
  ) => void;
  updateComment: (
    id: string,
    updates: Partial<
      Pick<
        Comment,
        | "content"
        | "x"
        | "y"
        | "lastEditedById"
        | "lastEditorName"
        | "lastEditorImage"
      >
    >
  ) => void;
  updateComments: (
    updates: {
      id: string;
      changes: Partial<
        Pick<
          Comment,
          | "content"
          | "x"
          | "y"
          | "lastEditedById"
          | "lastEditorName"
          | "lastEditorImage"
        >
      >;
    }[]
  ) => void;
  removeComment: (id: string) => void;
  finalizeCommentsDrag: (commentIds: string[]) => void;

  // Z-index management
  bringDialogToFront: (dialogId: string) => void;
  registerDialog: (dialogId: string) => void;
  unregisterDialog: (dialogId: string) => void;
  getDialogZIndex: (dialogId: string) => number;
};

export type KanbanStore = KanbanState & KanbanActions;
