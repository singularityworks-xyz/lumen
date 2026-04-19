import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const mockSetSelectedBoard = mock();
const mockBringBoardToFront = mock();
const mockToggleBoardSelection = mock();
const mockClearBoardSelection = mock();
const mockRemoveBoard = mock();
const mockOpenCreateTaskModal = mock();
const mockOpenBoardQuickActions = mock();
const mockOpenBoardDialog = mock();
const mockUpdateBoardDimensions = mock();
const mockOpenTaskDetailModal = mock();
const mockTriggerTaskDetailModalShake = mock();
const mockSetCenter = mock();
const mockScreenToFlowPosition = mock(({ x, y }: { x: number; y: number }) => ({
  x,
  y,
}));
const mockGetViewport = mock(() => ({ x: 0, y: 0, zoom: 1 }));
const mockSetViewport = mock();
const mockUpdateCursor = mock();
const mockUpdateSelection = mock();

const mockBoards = {
  byId: {} as Record<
    string,
    {
      id: string;
      name: string;
      description: string;
      workspace_id: string;
      created_by: string;
      created_at: string;
      column_ids: string[];
      accentColor?: string;
      icon?: string;
    }
  >,
  allIds: [] as string[],
};

const mockColumns = {
  byId: {} as Record<
    string,
    {
      id: string;
      board_id: string;
      name: string;
      description?: string;
      position: number;
      task_ids: string[];
      accentColor?: string;
      icon?: string;
      progressValue?: number;
    }
  >,
  allIds: [] as string[],
};

const mockTasks = {
  byId: {} as Record<
    string,
    {
      id: string;
      column_id: string;
      board_id: string;
      title: string;
      status: "todo" | "done" | "trash";
      position: number;
      priority: "low" | "medium" | "high";
      progress: number;
      created_at: string;
      updated_at: string;
      created_by: string;
    }
  >,
  allIds: [] as string[],
};

const mockBoardPositions = {
  byId: {} as Record<
    string,
    {
      id: string;
      x: number;
      y: number;
      zIndex: number;
      width?: number;
      height?: number;
      userResized?: boolean;
      lastUserWidth?: number;
      lastUserHeight?: number;
    }
  >,
  allIds: [] as string[],
};

const mockCollaborators: {
  id: string;
  name: string;
  color: string;
  selection?: string[];
  cursor?: { x: number; y: number };
}[] = [];

const mockStore = {
  setSelectedBoard: mockSetSelectedBoard,
  bringBoardToFront: mockBringBoardToFront,
  interactionMode: "drag" as "drag" | "select",
  selectedBoardIds: [] as string[],
  toggleBoardSelection: mockToggleBoardSelection,
  clearBoardSelection: mockClearBoardSelection,
  openTaskDetailModal: mockOpenTaskDetailModal,
  triggerTaskDetailModalShake: mockTriggerTaskDetailModalShake,
  openCreateTaskModal: mockOpenCreateTaskModal,
  removeBoard: mockRemoveBoard,
  openBoardQuickActions: mockOpenBoardQuickActions,
  openBoardDialog: mockOpenBoardDialog,
  updateBoardDimensions: mockUpdateBoardDimensions,
  boards: mockBoards,
  columns: mockColumns,
  tasks: mockTasks,
  boardPositions: mockBoardPositions,
  columnUi: {},
  selectedTaskIds: [] as string[],
};

const mockUseKanbanStore = mock(
  (selector: (state: typeof mockStore) => unknown) => selector(mockStore)
);

Object.assign(mockUseKanbanStore, { getState: () => mockStore });

const mockUseCollaboration = mock(() => ({
  isCollaborating: false,
  updateCursor: mockUpdateCursor,
  updateSelection: mockUpdateSelection,
  collaborators: mockCollaborators,
  localUser: { id: "local-1", name: "Local User", color: "#3b82f6" },
  awareness: null,
}));

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

mock.module("@xyflow/react", () => {
  const Handle = ({ id }: { id: string }) =>
    React.createElement("div", { "data-handle-id": id });
  const NodeResizer = ({
    onResizeStart,
    onResizeEnd,
    isVisible,
  }: {
    onResizeStart: () => void;
    onResizeEnd: () => void;
    isVisible: boolean;
  }) =>
    isVisible
      ? React.createElement("div", {
          "data-testid": "node-resizer",
          "data-on-resize-start": onResizeStart,
          "data-on-resize-end": onResizeEnd,
        })
      : null;
  const Position = {
    Top: "top",
    Right: "right",
    Bottom: "bottom",
    Left: "left",
  };
  const useReactFlow = () => ({
    setCenter: mockSetCenter,
    screenToFlowPosition: mockScreenToFlowPosition,
    getViewport: mockGetViewport,
    setViewport: mockSetViewport,
    getNode: mock(),
  });
  const useStoreApi = () => ({
    getState: () => ({ nodeInternals: new Map() }),
  });
  const useViewport = () => ({ x: 0, y: 0, zoom: 1 });
  const useNodes = () => [];
  const useViewportHandlers = () => ({ handleMoveEnd: mock() });
  return {
    Handle,
    NodeResizer,
    Position,
    useReactFlow,
    useStoreApi,
    useViewport,
    useNodes,
    useViewportHandlers,
  };
});

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
  CollaborationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  getColorForUser: () => "#3b82f6",
}));

mock.module("@/src/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }) =>
    React.createElement(
      "button",
      { type: "button", onClick, ...props },
      children
    ),
  buttonVariants: () => "",
}));

mock.module("@/src/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    React.createElement(
      "div",
      { "data-popover-open": open, "data-popover-change": onOpenChange },
      children
    ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-popover-trigger": true }, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-popover-content": true }, children),
}));

mock.module("@/src/components/animated/icons/grip-vertical", () => ({
  GripVerticalIcon: () => React.createElement("span", { "data-icon": "grip" }),
}));

mock.module("@/src/components/animated/icons/plus", () => ({
  PlusIcon: () => React.createElement("span", { "data-icon": "plus" }),
}));

mock.module("@/src/components/animated/icons/square-pen", () => ({
  SquarePenIcon: () => React.createElement("span", { "data-icon": "edit" }),
}));

mock.module("@/src/components/animated/icons/x", () => ({
  XIcon: () => React.createElement("span", { "data-icon": "x" }),
}));

mock.module("@/src/lib/utils", () => ({
  cn: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(" "),
}));

mock.module("@/src/features/kanban/utils/board-resize-rules", () => ({
  calculateContentDimensions: () => ({ width: 400, height: 300 }),
  calculateMaxDimensions: () => ({ width: 1200, height: 900 }),
  calculateMinDimensions: () => ({ width: 200, height: 150 }),
  shouldApplyResize: () => ({
    shouldResize: false,
    newDimensions: { width: 400, height: 300 },
  }),
}));

mock.module("@/src/features/kanban/utils/color-icon-utils", () => ({
  ICON_MAP: {
    folder: () => null,
    star: () => null,
  },
  ACCENT_COLORS: [],
  COLUMN_ICONS: [],
  getAccentColor: () => undefined,
  getIconComponent: () => null,
  isValidHexColor: () => true,
  ColorPicker: () => null,
  IconPicker: () => null,
  DEFAULT_TOP_COLORS: [],
  DEFAULT_TOP_ICONS: [],
  getTopColors: () => [],
  getTopIcons: () => [],
  incrementColorUsage: () => ({}),
  incrementIconUsage: () => ({}),
  QuickColorPicker: () => null,
  QuickIconPicker: () => null,
}));

mock.module(
  "@/src/features/kanban/components/board-presence-indicator",
  () => ({
    BoardPresenceIndicator: ({
      activeCollaborator,
    }: {
      activeCollaborator: { name: string };
    }) =>
      React.createElement("div", { "data-presence": activeCollaborator.name }),
  })
);

mock.module("@/src/features/kanban/components/kanban-board", () => ({
  KanbanBoard: ({ board }: { board: { name: string } }) =>
    React.createElement("div", { "data-kanban-board": board.name }),
}));

mock.module(
  "@/src/features/kanban/components/styles/board-node.module.css",
  () => ({
    default: { boardContent: "board-content" },
    boardContent: "board-content",
  })
);

mock.module("@/src/components/dialogs/area-properties-dialog-node", () => ({
  AreaPropertiesDialogNodeComponent: () => null,
}));

mock.module(
  "@/src/components/dialogs/board/board-properties-dialog-node",
  () => ({
    BoardPropertiesDialogNodeComponent: () => null,
  })
);

mock.module("@/src/components/dialogs/board/board-quick-actions-node", () => ({
  BoardQuickActionsNodeComponent: () => null,
}));

mock.module("@/src/components/dialogs/board/connection-dialog-node", () => ({
  ConnectionDialogNodeComponent: () => null,
}));

mock.module("@/src/components/dialogs/board/delete-board-dialog-node", () => ({
  DeleteBoardDialogNodeComponent: () => null,
}));

mock.module(
  "@/src/components/dialogs/board/duplicate-board-dialog-node",
  () => ({
    DuplicateBoardDialogNodeComponent: () => null,
  })
);

mock.module("@/src/components/dialogs/board/rename-board-dialog-node", () => ({
  RenameBoardDialogNodeComponent: () => null,
}));

mock.module("@/src/components/dialogs/color-icon-picker-dialog-node", () => ({
  ColorIconPickerDialogNodeComponent: () => null,
}));

mock.module(
  "@/src/components/dialogs/column/column-quick-actions-node",
  () => ({
    ColumnQuickActionsNodeComponent: () => null,
  })
);

mock.module(
  "@/src/components/dialogs/column/delete-column-dialog-node",
  () => ({
    DeleteColumnDialogNodeComponent: () => null,
  })
);

mock.module("@/src/components/dialogs/column/move-column-dialog-node", () => ({
  MoveColumnDialogNodeComponent: () => null,
}));

mock.module(
  "@/src/components/dialogs/column/rename-column-dialog-node",
  () => ({
    RenameColumnDialogNodeComponent: () => null,
  })
);

mock.module("@/src/components/tasks/task-detail-modal-node", () => ({
  TaskDetailModalNodeComponent: () => null,
}));

mock.module("@/src/components/tasks/task-modal-node", () => ({
  TaskModalNodeComponent: () => null,
}));

mock.module("@/src/components/tasks/task-quick-actions-node", () => ({
  TaskQuickActionsNodeComponent: () => null,
}));

mock.module("@/src/features/kanban/components/area-node", () => ({
  AreaNodeComponent: () => null,
}));

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

function setupStore({
  boardId = "board-1",
  boardName = "My Board",
  boardDescription = "A test board",
  columnIds = ["col-1"],
  taskIds = [] as string[],
  accentColor = undefined as string | undefined,
  icon = undefined as string | undefined,
  boardPosition = { width: 400, height: 300, userResized: false },
}: {
  boardId?: string;
  boardName?: string;
  boardDescription?: string;
  columnIds?: string[];
  taskIds?: string[];
  accentColor?: string;
  icon?: string;
  boardPosition?: { width?: number; height?: number; userResized?: boolean };
} = {}) {
  mockBoards.byId = {
    [boardId]: {
      id: boardId,
      name: boardName,
      description: boardDescription,
      workspace_id: "ws-1",
      created_by: "user-1",
      created_at: "2024-01-01",
      column_ids: columnIds,
      accentColor,
      icon,
    },
  };
  mockBoards.allIds = [boardId];

  mockColumns.byId = {};
  mockColumns.allIds = [...columnIds];
  for (const colId of columnIds) {
    mockColumns.byId[colId] = {
      id: colId,
      board_id: boardId,
      name: `Column ${colId}`,
      position: 0,
      task_ids: taskIds,
    };
  }

  mockTasks.byId = {};
  mockTasks.allIds = [...taskIds];
  for (const taskId of taskIds) {
    mockTasks.byId[taskId] = {
      id: taskId,
      column_id: "col-1",
      board_id: boardId,
      title: `Task ${taskId}`,
      status: "todo",
      position: 0,
      priority: "medium",
      progress: 0,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      created_by: "user-1",
    };
  }

  mockBoardPositions.byId[boardId] = {
    id: boardId,
    x: 0,
    y: 0,
    zIndex: 1,
    ...boardPosition,
  };
  mockBoardPositions.allIds = [boardId];

  mockStore.boards = mockBoards;
  mockStore.columns = mockColumns;
  mockStore.tasks = mockTasks;
  mockStore.boardPositions = mockBoardPositions;
}

describe("BoardNodeComponent", () => {
  let BoardNodeComponent: typeof import("@/src/features/kanban/components/board-node").BoardNodeComponent;

  beforeEach(async () => {
    const mod = await import("@/src/features/kanban/components/board-node");
    BoardNodeComponent = mod.BoardNodeComponent;
  });

  afterEach(() => {
    cleanup();
    mockBoards.byId = {};
    mockBoards.allIds = [];
    mockColumns.byId = {};
    mockColumns.allIds = [];
    mockTasks.byId = {};
    mockTasks.allIds = [];
    mockBoardPositions.byId = {};
    mockBoardPositions.allIds = [];
    mockStore.selectedBoardIds = [];
    mockStore.interactionMode = "drag";
    mockCollaborators.length = 0;
    mockSetSelectedBoard.mockReset();
    mockBringBoardToFront.mockReset();
    mockToggleBoardSelection.mockReset();
    mockClearBoardSelection.mockReset();
    mockRemoveBoard.mockReset();
    mockOpenCreateTaskModal.mockReset();
    mockOpenBoardQuickActions.mockReset();
    mockOpenBoardDialog.mockReset();
    mockUpdateBoardDimensions.mockReset();
    mockOpenTaskDetailModal.mockReset();
    mockUpdateCursor.mockReset();
    mockUpdateSelection.mockReset();
  });

  it("returns null when board data not found in store", () => {
    mockBoards.byId = {};
    mockBoards.allIds = [];

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "missing-board", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders board name and description", () => {
    setupStore({
      boardName: "Sprint Planning",
      boardDescription: "Track sprint tasks",
    });

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    expect(container.textContent).toContain("Sprint Planning");
    expect(container.textContent).toContain("Track sprint tasks");
  });

  it("shows task count badge with done/total", () => {
    setupStore({
      taskIds: ["task-1", "task-2", "task-3"],
    });
    mockTasks.byId["task-1"]!.status = "done";
    mockTasks.byId["task-2"]!.status = "done";
    mockTasks.byId["task-3"]!.status = "todo";

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("/");
  });

  it("shows completed state when all tasks done", () => {
    setupStore({
      taskIds: ["task-1", "task-2"],
    });
    mockTasks.byId["task-1"]!.status = "done";
    mockTasks.byId["task-2"]!.status = "done";

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    expect(container.innerHTML).toContain("emerald");
  });

  it("click selects board and clears other selection", () => {
    setupStore();
    mockStore.selectedBoardIds = ["other-board"];
    mockStore.interactionMode = "select" as const;

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const boardEl = container.querySelector('[role="button"]');
    expect(boardEl).not.toBeNull();
    fireEvent.click(boardEl!, { metaKey: false, ctrlKey: false });

    expect(mockClearBoardSelection).toHaveBeenCalled();
    expect(mockToggleBoardSelection).toHaveBeenCalledWith("node-1");
  });

  it("cmd+click toggles multi-selection", () => {
    setupStore();
    mockStore.selectedBoardIds = ["other-board"];
    mockStore.interactionMode = "select" as const;

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const boardEl = container.querySelector('[role="button"]');
    expect(boardEl).not.toBeNull();
    fireEvent.click(boardEl!, { metaKey: true, ctrlKey: false });

    expect(mockClearBoardSelection).not.toHaveBeenCalled();
    expect(mockToggleBoardSelection).toHaveBeenCalledWith("node-1");
  });

  it("delete button shows confirm popup when tasks exist", () => {
    setupStore({
      taskIds: ["task-1"],
    });

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const deleteBtn = container.querySelector('[data-icon="x"]');
    expect(deleteBtn).not.toBeNull();
    if (deleteBtn?.parentElement) {
      fireEvent.click(deleteBtn.parentElement);
    }

    expect(mockRemoveBoard).not.toHaveBeenCalled();
  });

  it("deletes board immediately when empty", () => {
    setupStore({ taskIds: [] });

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const deleteBtn = container.querySelector('[data-icon="x"]');
    expect(deleteBtn).not.toBeNull();
    if (deleteBtn?.parentElement) {
      fireEvent.click(deleteBtn.parentElement);
    }

    expect(mockRemoveBoard).toHaveBeenCalledWith("node-1");
  });

  it("add task opens create task modal with first column", () => {
    setupStore({
      columnIds: ["col-1", "col-2"],
    });
    mockOpenCreateTaskModal.mockReturnValue({
      id: "modal-1",
      position: { x: 100, y: 100 },
      isExisting: false,
    });

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const addBtn = container.querySelector('[data-icon="plus"]');
    expect(addBtn).not.toBeNull();
    if (addBtn?.parentElement) {
      fireEvent.click(addBtn.parentElement);
    }

    expect(mockOpenBoardQuickActions).toHaveBeenCalled();
    expect(mockOpenCreateTaskModal).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: "col-1",
        boardId: "board-1",
      })
    );
  });

  it("edit button opens board dialog for rename", () => {
    setupStore({
      boardName: "Old Name",
      boardDescription: "Old desc",
    });

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    const editBtn = container.querySelector('[data-icon="edit"]');
    expect(editBtn).not.toBeNull();
    if (editBtn?.parentElement) {
      fireEvent.click(editBtn.parentElement);
    }

    expect(mockOpenBoardQuickActions).toHaveBeenCalled();
    expect(mockOpenBoardDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rename",
        boardId: "board-1",
        boardName: "Old Name",
        inputValue: "Old Name",
      })
    );
  });

  it("resize effect applies auto-resize based on content dimensions", async () => {
    const mockShouldApplyResize = mock(() => ({
      shouldResize: true,
      newDimensions: { width: 500, height: 400 },
    }));

    mock.module("@/src/features/kanban/utils/board-resize-rules", () => ({
      calculateContentDimensions: () => ({ width: 400, height: 300 }),
      calculateMaxDimensions: () => ({ width: 1200, height: 900 }),
      calculateMinDimensions: () => ({ width: 200, height: 150 }),
      shouldApplyResize: mockShouldApplyResize,
    }));

    const { BoardNodeComponent: FreshComponent } = await import(
      "@/src/features/kanban/components/board-node"
    );

    setupStore({
      boardPosition: { width: 400, height: 300, userResized: false },
    });

    render(
      React.createElement(FreshComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    await waitFor(() => {
      expect(mockUpdateBoardDimensions).toHaveBeenCalledWith(
        "board-1",
        { width: 500, height: 400 },
        false
      );
    });
  });

  it("collaborator selection indicator shows when collaborator has this board selected", () => {
    setupStore();
    mockCollaborators.push({
      id: "collab-1",
      name: "Alice",
      color: "#ff0000",
      selection: ["node-1"],
    });

    const mockUseCollabFn = mock(() => ({
      isCollaborating: true,
      updateCursor: mock(),
      updateSelection: mock(),
      collaborators: mockCollaborators,
      localUser: { id: "local-1", name: "Local User", color: "#3b82f6" },
      awareness: null,
    }));

    (mockUseCollaboration as ReturnType<typeof mock>).mockImplementation(
      mockUseCollabFn
    );

    const { container } = render(
      React.createElement(BoardNodeComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: false },
        selected: false,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    expect(container.querySelector('[data-presence="Alice"]')).not.toBeNull();
  });

  it("cursor tracking during resize when collaborating", async () => {
    const updateCursor = mock();
    let capturedOnResizeStart: (() => void) | undefined;

    mock.module("@xyflow/react", () => {
      const Handle = ({ id }: { id: string }) =>
        React.createElement("div", { "data-handle-id": id });
      const NodeResizer = ({
        onResizeStart,
        isVisible,
      }: {
        onResizeStart: () => void;
        isVisible: boolean;
      }) => {
        capturedOnResizeStart = onResizeStart;
        return isVisible
          ? React.createElement("div", { "data-testid": "node-resizer" })
          : null;
      };
      const Position = {
        Top: "top",
        Right: "right",
        Bottom: "bottom",
        Left: "left",
      };
      const useReactFlow = () => ({
        setCenter: mockSetCenter,
        screenToFlowPosition: mockScreenToFlowPosition,
        getViewport: mockGetViewport,
        setViewport: mockSetViewport,
        getNode: mock(),
      });
      const useStoreApi = () => ({
        getState: () => ({ nodeInternals: new Map() }),
      });
      const useViewport = () => ({ x: 0, y: 0, zoom: 1 });
      const useNodes = () => [];
      const useViewportHandlers = () => ({ handleMoveEnd: mock() });
      return {
        Handle,
        NodeResizer,
        Position,
        useReactFlow,
        useStoreApi,
        useViewport,
        useNodes,
        useViewportHandlers,
      };
    });

    const mockUseCollabFn = mock(() => ({
      isCollaborating: true,
      updateCursor,
      updateSelection: mock(),
      collaborators: [],
      localUser: { id: "local-1", name: "Local User", color: "#3b82f6" },
      awareness: null,
    }));

    (mockUseCollaboration as ReturnType<typeof mock>).mockImplementation(
      mockUseCollabFn
    );

    const { BoardNodeComponent: FreshComponent } = await import(
      "@/src/features/kanban/components/board-node"
    );

    setupStore();

    render(
      React.createElement(FreshComponent as any, {
        id: "node-1",
        data: { boardId: "board-1", isSelected: true },
        selected: true,
        dragging: false,
        type: "board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      })
    );

    capturedOnResizeStart?.();

    await new Promise((r) => setTimeout(r, 10));

    const pointerEvent = new PointerEvent("pointermove", {
      clientX: 100,
      clientY: 200,
    });
    window.dispatchEvent(pointerEvent);

    expect(updateCursor).toHaveBeenCalledWith({ x: 100, y: 200 });
  });
});
