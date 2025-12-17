import type {
  Board,
  BoardConnection,
  BoardDialogState,
  BoardDialogType,
  BoardPosition,
  CanvasState,
  Column,
  CreateTaskModalFormData,
  CreateTaskModalState,
  EntityMap,
  InteractionMode,
  Task,
  TaskDetailModalState,
  ViewportState,
  Workspace,
} from "../types";

export type KanbanState = {
  workspaces: EntityMap<Workspace>;
  boards: EntityMap<Board>;
  columns: EntityMap<Column>;
  tasks: EntityMap<Task>;
  boardPositions: EntityMap<BoardPosition>;
  boardConnections: EntityMap<BoardConnection>;
  currentWorkspaceId: string | null;
  canvas: CanvasState;
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskModals: Record<string, CreateTaskModalState>;
  taskDetailModals: Record<string, TaskDetailModalState>;
  interactionMode: InteractionMode;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
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
  columnQuickActions: {
    columnId: string;
    showAddTask: boolean;
    position: { x: number; y: number };
  } | null;
  columnDialog: {
    type: "rename" | "delete" | "move";
    columnId: string;
    position: { x: number; y: number };
  } | null;
  boardQuickActions: {
    boardId: string;
    position: { x: number; y: number };
  } | null;
  boardDialogs: Record<string, BoardDialogState>;
};

export type KanbanActions = {
  // Workspace actions
  setCurrentWorkspace: (workspaceId: string | null) => void;
  addWorkspace: (name: string, description?: string) => string;
  updateWorkspace: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, "name" | "description">>
  ) => void;
  deleteWorkspace: (workspaceId: string) => void;
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

  // Column actions
  openColumnQuickActions: (
    columnId: string,
    showAddTask: boolean,
    position: { x: number; y: number }
  ) => void;
  closeColumnQuickActions: () => void;
  updateColumnQuickActionsPosition: (position: {
    x: number;
    y: number;
  }) => void;
  openColumnDialog: (options: {
    type: "rename" | "delete" | "move";
    columnId: string;
    position: { x: number; y: number };
  }) => void;
  closeColumnDialog: () => void;
  updateColumnDialogPosition: (position: { x: number; y: number }) => void;

  // Board actions
  addBoard: (
    name: string,
    position: { x: number; y: number },
    description?: string
  ) => string;
  updateBoard: (
    boardId: string,
    updates: Partial<Pick<Board, "name" | "description">>
  ) => void;
  removeBoard: (boardId: string) => void;
  updateBoardPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardDimensions: (
    boardId: string,
    dimensions: { width: number; height: number }
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
  closeBoardQuickActions: () => void;
  updateBoardQuickActionsPosition: (position: { x: number; y: number }) => void;
  openBoardDialog: (options: {
    type: BoardDialogType;
    boardId: string;
    boardName: string;
    position?: { x: number; y: number };
    inputValue?: string;
    newName?: string;
    copyConnections?: boolean;
    columnCount?: number;
    taskCount?: number;
    connectionCount?: number;
  }) => string;
  closeBoardDialog: (id: string) => void;
  updateBoardDialogPosition: (
    id: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardDialogInputValue: (id: string, value: string) => void;
  updateBoardDialogNewName: (id: string, value: string) => void;
  updateBoardDialogCopyConnections: (id: string, value: boolean) => void;

  // Column actions
  addColumn: (boardId: string, name: string, position?: number) => string;
  updateColumn: (
    columnId: string,
    updates: Partial<Pick<Column, "name" | "position">>
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
  openTaskDetailModal: (
    taskId: string,
    boardId: string,
    position?: { x: number; y: number }
  ) => {
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
};

export type KanbanStore = KanbanState & KanbanActions;
