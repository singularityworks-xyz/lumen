import type {
  Area,
  AreaPosition,
  Board,
  BoardConnection,
  BoardDialogState,
  BoardDialogType,
  BoardPosition,
  CanvasState,
  ChatMessage,
  Column,
  Comment,
  CreateTaskModalFormData,
  CreateTaskModalState,
  EntityMap,
  InteractionMode,
  Task,
  TaskDetailModalState,
  TextBoard,
  TextBoardPosition,
  ViewportState,
  Workspace,
} from "../types";

export interface ColumnUiState {
  bottomView: "finished" | "trash";
  isBottomExpanded: boolean;
}

export interface KanbanState {
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
  // Track drag origins for areas - used to offset contained boards during drag
  areaDragOrigins: Record<string, { originX: number; originY: number }>;
  areaPositions: EntityMap<AreaPosition>;
  areas: EntityMap<Area>;
  boardConnections: EntityMap<BoardConnection>;
  boardDialogs: Record<string, BoardDialogState>;
  boardPositions: EntityMap<BoardPosition>;
  boardQuickActions: Record<
    string,
    {
      boardId: string;
      position: { x: number; y: number };
    }
  >;
  boards: EntityMap<Board>;
  canvas: CanvasState;
  chatMessages: EntityMap<ChatMessage>;
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
  columns: EntityMap<Column>;
  columnUi: Record<string, ColumnUiState>;
  comments: EntityMap<Comment>;
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
  createTaskModals: Record<string, CreateTaskModalState>;
  currentWorkspaceId: string | null;
  deletedSharedWorkspaceId: string | null;
  // Z-index management
  dialogFocusStack: string[];
  draggedTaskId: string | null;
  guestToken: string | null;
  interactionMode: InteractionMode;
  isGuestMode: boolean;
  isProfileModalOpen: boolean;
  lastActiveDrawerTab: "comments" | "discussion";
  lastTaskModalPositions: Record<string, { x: number; y: number }>;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  shakingTaskDetailModalId: string | null;
  shareDialog: {
    boardId: string;
    position: { x: number; y: number };
  } | null;
  showCommandPalette: boolean;
  showMiniMap: boolean;
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
  tasks: EntityMap<Task>;
  textBoardPositions: EntityMap<TextBoardPosition>;
  textBoards: EntityMap<TextBoard>;
  welcomeDismissed: boolean;
  workspaceDialog: {
    type: "rename" | "reset" | "delete" | "duplicate";
    workspaceId: string;
    workspaceName: string;
    position?: { x: number; y: number };
    inputValue?: string;
  } | null;
  workspaceQuickActions: {
    workspaceId: string;
    position: { x: number; y: number };
  } | null;
  workspaceShareUrls: Record<string, string>; // workspaceId -> shareUrl
  workspaces: EntityMap<Workspace>;
}

export interface KanbanActions {
  // Area actions
  addArea: (
    name: string,
    position: { x: number; y: number },
    dimensions: { width: number; height: number },
    workspaceId?: string
  ) => string;

  // Board actions
  addBoard: (
    name: string,
    position?: { x: number; y: number },
    description?: string
  ) => string;

  // Column actions
  addColumn: (boardId: string, name: string, position?: number) => string;

  // Comment actions
  addComment: (
    position: { x: number; y: number },
    content: string,
    author: { id: string; name?: string; image?: string }
  ) => void;

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
  addReply: (
    parentId: string,
    content: string,
    author: { id: string; name?: string; image?: string }
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
  addTextBoard: (
    name: string,
    position?: { x: number; y: number },
    description?: string
  ) => string;
  addWorkspace: (name: string, description?: string) => string;
  attachBoardToArea: (areaId: string, boardId: string) => void;
  bringBoardToFront: (boardId: string) => void;

  // Z-index management
  bringDialogToFront: (dialogId: string) => void;
  bringModalToFront: (modalId: string) => void;
  bringTaskDetailModalToFront: (modalId: string) => void;
  bringTextBoardToFront: (textBoardId: string) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  clearBoardSelection: () => void;
  clearSelectionBox: () => void;
  clearTaskSelection: () => void;
  clearWorkspaceShareUrl: (workspaceId: string) => void;
  closeAreaDialog: (id: string) => void;
  closeBoardDialog: (id: string) => void;
  closeBoardQuickActions: (boardId: string) => void;
  closeColumnDialog: (id: string) => void;
  closeColumnQuickActions: (columnId: string) => void;
  closeConnectionDialog: () => void;
  closeCreateTaskModal: (modalId: string) => void;
  closeProfileModal: () => void;
  closeShareDialog: () => void;
  closeTaskDetailModal: (modalId: string) => void;
  closeTaskQuickActions: (taskId: string) => void;
  closeWorkspaceDialog: () => void;
  closeWorkspaceQuickActions: () => void;
  deleteChatMessage: (id: string) => void;
  deleteColumn: (boardId: string, columnId: string) => void;
  deleteTask: (taskId: string) => void;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  detachBoardFromArea: (areaId: string, boardId: string) => void;
  // Disable AI for a workspace
  disableWorkspaceAi: (workspaceId: string) => void;
  // Hide the welcome card until the next session reset
  dismissWelcome: () => void;
  duplicateBoard: (
    boardId: string,
    newName: string,
    options?: { copyConnections?: boolean }
  ) => string | null;
  duplicateTask: (taskId: string) => string | null;
  duplicateWorkspace: (workspaceId: string, newName: string) => string | null;
  editChatMessage: (
    id: string,
    content: string,
    mentions?: Array<{
      userId: string;
      userName: string;
      startIndex: number;
      endIndex: number;
    }>
  ) => void;
  // Enable AI for a local workspace (requires user consent)
  enableWorkspaceAi: (workspaceId: string) => void;
  // Called on drag end to sync contained board positions with the area
  finalizeAreaDrag: (areaId: string) => void;
  finalizeBoardDrag: (boardId: string) => void;
  finalizeCommentsDrag: (commentIds: string[]) => void;
  finalizeTextBoardDrag: (textBoardId: string) => void;
  getChatMessagesForWorkspace: (workspaceId: string) => ChatMessage[];
  getConnectionsByBoardId: (boardId: string) => BoardConnection[];
  getDenormalizedBoard: (
    boardId: string
  ) => import("../types").DenormalizedBoard | null;
  getDialogZIndex: (dialogId: string) => number;
  getRepliesForComment: (parentId: string) => Comment[];
  markWorkspaceDeleted: (workspaceId: string) => void;
  moveColumn: (boardId: string, columnId: string, newPosition: number) => void;
  moveColumnToBoard: (
    sourceBoardId: string,
    columnId: string,
    targetBoardId: string
  ) => void;
  moveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    targetBoardId: string
  ) => void;
  openAreaDialog: (options: {
    areaId: string;
    areaName: string;
    position: { x: number; y: number };
  }) => string;
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
  openBoardQuickActions: (
    boardId: string,
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

  // Column actions
  openColumnQuickActions: (
    columnId: string,
    boardId: string,
    showAddTask: boolean,
    position: { x: number; y: number }
  ) => void;
  openConnectionDialog: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;

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

  // Profile modal actions
  openProfileModal: () => void;
  openShareDialog: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
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
    usedLastPosition: boolean;
  };

  // Task quick actions
  openTaskQuickActions: (
    taskId: string,
    boardId: string,
    columnId: string,
    position: { x: number; y: number }
  ) => void;
  openWorkspaceDialog: (options: {
    type: "rename" | "reset" | "delete" | "duplicate";
    workspaceId: string;
    workspaceName: string;
    position?: { x: number; y: number };
    inputValue?: string;
  }) => void;
  openWorkspaceQuickActions: (
    workspaceId: string,
    position: { x: number; y: number }
  ) => void;
  registerDialog: (dialogId: string) => void;
  removeArea: (areaId: string) => void;
  removeBoard: (boardId: string) => void;
  removeComment: (id: string) => void;
  removeConnection: (connectionId: string) => void;
  removeTextBoard: (textBoardId: string) => void;
  resetWorkspace: (
    workspaceId: string,
    options?: { clearBoardsAndColumns?: boolean }
  ) => void;

  // Chat actions (workspace discussion)
  sendChatMessage: (
    content: string,
    author: { id: string; name: string; image?: string },
    options?: {
      replyToId?: string;
      replyToContent?: string;
      replyToAuthorName?: string;
      mentions?: Array<{
        userId: string;
        userName: string;
        startIndex: number;
        endIndex: number;
      }>;
    }
  ) => void;
  // Workspace actions
  setCurrentWorkspace: (workspaceId: string | null) => void;
  setDeletedSharedWorkspace: (workspaceId: string | null) => void;
  setDraggedTask: (taskId: string | null) => void;
  setFocusedBoard: (boardId: string | null) => void;
  setGuestMode: (isGuestMode: boolean, guestToken?: string | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setLastActiveDrawerTab: (tab: "comments" | "discussion") => void;
  setSelectedBoard: (boardId: string | null) => void;
  setSelectionBox: (
    box: { x: number; y: number; width: number; height: number } | null
  ) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setTaskDetailModalEditing: (modalId: string, isEditing: boolean) => void;

  // UI actions
  setViewport: (viewport: ViewportState) => void;
  setWorkspaceShareUrl: (workspaceId: string, url: string) => void;
  syncWorkspace: (workspace: Partial<Workspace> & { id: string }) => void;
  toggleBoardSelection: (boardId: string) => void;
  toggleConnectionLineStyle: (connectionId: string) => void;
  toggleTaskSelection: (taskId: string) => void;
  triggerTaskDetailModalShake: (modalId: string) => void;
  unregisterDialog: (dialogId: string) => void;
  updateArea: (
    areaId: string,
    updates: Partial<Pick<Area, "name" | "color" | "icon">>
  ) => void;
  updateAreaDialogInputValue: (id: string, value: string) => void;
  updateAreaDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateAreaDimensions: (
    areaId: string,
    dimensions: { width: number; height: number }
  ) => void;
  // Updates only the area position (optimized for drag - does NOT update contained boards)
  updateAreaPosition: (
    areaId: string,
    position: { x: number; y: number }
  ) => void;
  updateBoard: (
    boardId: string,
    updates: Partial<
      Pick<Board, "name" | "description" | "accentColor" | "icon">
    >
  ) => void;
  updateBoardDialogColumnProgress: (
    id: string,
    columnId: string,
    value: number
  ) => void;
  updateBoardDialogCopyConnections: (id: string, value: boolean) => void;
  updateBoardDialogDescriptionValue: (id: string, value: string) => void;
  updateBoardDialogInputValue: (id: string, value: string) => void;
  updateBoardDialogNewName: (id: string, value: string) => void;
  updateBoardDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardDialogUIState: (
    id: string,
    state: {
      expandedColumnId?: string | null;
      activeTab?: "progress" | "style";
    }
  ) => void;
  updateBoardDimensions: (
    boardId: string,
    dimensions: { width: number; height: number },
    isUserResize?: boolean
  ) => void;
  updateBoardPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardQuickActionsPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
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
  updateColumnDialogDescriptionValue: (id: string, value: string) => void;
  updateColumnDialogInputValue: (id: string, value: string) => void;
  updateColumnDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateColumnQuickActionsPosition: (
    columnId: string,
    position: { x: number; y: number }
  ) => void;
  updateColumnUi: (columnId: string, updates: Partial<ColumnUiState>) => void;
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
        | "replyCount"
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
          | "replyCount"
        >
      >;
    }[]
  ) => void;
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
  updateConnectionDialogPosition: (position: { x: number; y: number }) => void;
  updateConnectionLabel: (connectionId: string, label?: string) => void;
  updateModalFormData: (
    modalId: string,
    formData: Partial<CreateTaskModalFormData>
  ) => void;
  updateModalPosition: (
    modalId: string,
    position: { x: number; y: number }
  ) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
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
  updateTaskDetailModalPosition: (
    modalId: string,
    position: { x: number; y: number }
  ) => void;
  updateTaskQuickActionsPosition: (
    taskId: string,
    position: { x: number; y: number }
  ) => void;
  updateTextBoard: (
    textBoardId: string,
    updates: Partial<
      Pick<
        TextBoard,
        "name" | "description" | "content" | "accentColor" | "icon"
      >
    >
  ) => void;
  updateTextBoardDimensions: (
    textBoardId: string,
    dimensions: { width: number; height: number },
    isUserResize?: boolean
  ) => void;
  updateTextBoardPosition: (
    textBoardId: string,
    position: { x: number; y: number }
  ) => void;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;
  updateWorkspaceDialogInputValue: (value: string) => void;
  updateWorkspaceDialogPosition: (position: { x: number; y: number }) => void;
  updateWorkspaceQuickActionsPosition: (position: {
    x: number;
    y: number;
  }) => void;
}

export type KanbanStore = KanbanState & KanbanActions;
