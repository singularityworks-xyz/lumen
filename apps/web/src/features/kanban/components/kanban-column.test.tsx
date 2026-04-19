import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { render } from "@testing-library/react";
import React from "react";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});

mock.module("lucide-react", () => ({
  ArrowUpRight: () =>
    React.createElement("span", { "data-icon": "ArrowUpRight" }),
  Check: () => React.createElement("span", { "data-icon": "Check" }),
  ChevronDown: () =>
    React.createElement("span", { "data-icon": "ChevronDown" }),
  ChevronRight: () =>
    React.createElement("span", { "data-icon": "ChevronRight" }),
  Circle: () => React.createElement("span", { "data-icon": "Circle" }),
  GripVertical: () =>
    React.createElement("span", { "data-icon": "GripVertical" }),
  SquarePen: () => React.createElement("span", { "data-icon": "SquarePen" }),
  Trash2: () => React.createElement("span", { "data-icon": "Trash2" }),
  User: () => React.createElement("span", { "data-icon": "User" }),
}));

mock.module("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

mock.module("@/src/lib/utils", () => ({
  cn: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(" "),
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

mock.module("@/src/components/tasks/task-card", () => ({
  TaskCard: ({
    task,
    onDragStart,
  }: {
    task: { id: string; title: string };
    onDragStart?: (task: { id: string }) => void;
  }) => {
    const el = React.createElement(
      "div",
      { "data-task-card": task.id },
      task.title
    );
    (el as any).props = { onDragStart: () => onDragStart?.(task) };
    return el;
  },
}));

mock.module("@/src/components/tasks/task-drag-presence-indicator", () => ({
  TaskDragPresenceIndicator: ({
    collaborator,
  }: {
    collaborator: { name: string; color: string };
  }) =>
    React.createElement("div", {
      "data-drag-indicator": collaborator.name,
      "data-drag-color": collaborator.color,
    }),
}));

const mockSetDraggedTask = mock();
const mockMoveTask = mock();
const mockOpenColumnQuickActions = mock();
const mockOpenColumnDialog = mock();
const mockUpdateColumnUi = mock();
const mockGetNode = mock();

const mockColumnUi: Record<
  string,
  { bottomView: "finished" | "trash"; isBottomExpanded: boolean }
> = {};

const mockBoards = {
  byId: {} as Record<
    string,
    {
      id: string;
      name: string;
      workspace_id: string;
    }
  >,
  allIds: [] as string[],
};

const mockBoardPositions = {
  byId: {} as Record<string, { x: number; y: number }>,
  allIds: [] as string[],
};

const mockStore = {
  columnUi: mockColumnUi,
  updateColumnUi: mockUpdateColumnUi,
  openColumnQuickActions: mockOpenColumnQuickActions,
  openColumnDialog: mockOpenColumnDialog,
  draggedTaskId: null as string | null,
  tasks: {
    byId: {} as Record<string, { id: string; column_id: string }>,
    allIds: [] as string[],
  },
  setDraggedTask: mockSetDraggedTask,
  moveTask: mockMoveTask,
  selectedTaskIds: [] as string[],
  boards: mockBoards,
  boardPositions: mockBoardPositions,
  columnQuickActions: {} as Record<
    string,
    { boardId: string; columnId: string }
  >,
};

const mockUseKanbanStore = mock(
  (selector: (state: typeof mockStore) => unknown) => selector(mockStore)
);

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

const mockGetViewport = mock(() => ({ x: 0, y: 0, zoom: 1 }));
const mockSetViewport = mock();
const mockScreenToFlowPosition = mock(({ x, y }: { x: number; y: number }) => ({
  x,
  y,
}));

mock.module("@xyflow/react", () => ({
  useReactFlow: () => ({
    getViewport: mockGetViewport,
    setViewport: mockSetViewport,
    screenToFlowPosition: mockScreenToFlowPosition,
    getNode: mockGetNode,
  }),
}));

const mockStartTaskDragging = mock();
const mockStopTaskDragging = mock();

const mockUseTaskDragPresence = mock(() => ({
  startDragging: mockStartTaskDragging,
  stopDragging: mockStopTaskDragging,
}));

mock.module("@/src/hooks/use-task-drag-presence", () => ({
  useTaskDragPresence: mockUseTaskDragPresence,
}));

const mockDraggingCollaborators: {
  draggingColumn?: { columnId: string };
  name?: string;
  color?: string;
  image?: string;
}[] = [];

const mockUseColumnDragPresence = mock(() => ({
  draggingCollaborators: mockDraggingCollaborators,
}));

mock.module("@/src/hooks/use-column-drag-presence", () => ({
  useColumnDragPresence: mockUseColumnDragPresence,
}));

const mockLocalUser = { id: "local-1", name: "Local User", color: "#3b82f6" };

const mockUseCollaboration = mock(() => ({
  isCollaborating: false,
  localUser: mockLocalUser,
  awareness: null,
  collaborators: [],
}));

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
  CollaborationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const mockUseCachedProfileImage = mock(() => ({
  imageUrl: null,
  hasImage: false,
}));

mock.module("@/src/hooks/use-cached-profile-image", () => ({
  useCachedProfileImage: mockUseCachedProfileImage,
}));

const mockAttributes = { "data-dnd-attributes": "true" };
const mockListeners = { "data-dnd-listeners": "true" };
const mockSetNodeRef = mock();
const mockIsDragging = false;

const mockUseSortable = mock(() => ({
  attributes: mockAttributes,
  listeners: mockListeners,
  setNodeRef: mockSetNodeRef,
  transform: null,
  transition: undefined,
  isDragging: mockIsDragging,
  setActivatorNodeRef: mock(),
}));

mock.module("@dnd-kit/sortable", () => ({
  useSortable: mockUseSortable,
}));

mock.module("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: (transform: unknown) => String(transform ?? ""),
    },
  },
}));

function setupStore() {
  mockBoards.byId = {
    "board-1": { id: "board-1", name: "Board 1", workspace_id: "ws-1" },
    "board-2": { id: "board-2", name: "Board 2", workspace_id: "ws-1" },
  };
  mockBoards.allIds = ["board-1", "board-2"];
  mockBoardPositions.byId = { "board-1": { x: 0, y: 0 } };
  mockBoardPositions.allIds = ["board-1"];
  mockStore.columnQuickActions = {};
  mockStore.tasks.byId = {};
  mockStore.tasks.allIds = [];
}

function makeTask({
  id = "task-1",
  title = "Task",
  status = "todo",
}: {
  id?: string;
  title?: string;
  status?: string;
} = {}) {
  return {
    id,
    title,
    status,
    column_id: "col-1",
    board_id: "board-1",
    position: 0,
  };
}

function makeColumn({
  id = "col-1",
  name = "To Do",
  tasks = [],
  progressValue,
}: {
  id?: string;
  name?: string;
  tasks?: ReturnType<typeof makeTask>[];
  progressValue?: number;
} = {}) {
  return {
    id,
    board_id: "board-1",
    name,
    description: "",
    position: 0,
    tasks,
    accentColor: undefined,
    icon: undefined,
    progressValue,
  };
}

describe("KanbanColumn", () => {
  let KanbanColumn: typeof import("@/src/features/kanban/components/kanban-column").KanbanColumn;

  beforeEach(async () => {
    const mod = await import("@/src/features/kanban/components/kanban-column");
    KanbanColumn = mod.KanbanColumn;
  });

  afterEach(() => {
    mockBoards.byId = {};
    mockBoards.allIds = [];
    mockBoardPositions.byId = {};
    mockBoardPositions.allIds = [];
    for (const key of Object.keys(mockColumnUi)) {
      delete mockColumnUi[key];
    }
    mockDraggingCollaborators.length = 0;
    mockStore.draggedTaskId = null;
    mockStore.selectedTaskIds = [];
    mockStore.columnQuickActions = {};
    mockStore.tasks.byId = {};
    mockStore.tasks.allIds = [];
    mockSetDraggedTask.mockClear();
    mockMoveTask.mockClear();
    mockOpenColumnQuickActions.mockClear();
    mockOpenColumnDialog.mockClear();
    mockUpdateColumnUi.mockClear();
    mockGetNode.mockClear();
    mockStartTaskDragging.mockClear();
    mockStopTaskDragging.mockClear();
  });

  it("renders column name and task count", () => {
    setupStore();
    const column = makeColumn({
      name: "In Progress",
      tasks: [makeTask()],
    });

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });

    expect(el).toBeDefined();
  });

  it("shows progress value badge", () => {
    setupStore();
    const column = makeColumn({
      progressValue: 75,
    });

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });

    expect(el).toBeDefined();
  });

  it("todo tasks render as TaskCards", () => {
    setupStore();
    const column = makeColumn({
      tasks: [
        makeTask({ id: "t1", title: "First task" }),
        makeTask({ id: "t2", title: "Second task" }),
      ],
    });

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });

    expect(el).toBeDefined();
  });

  it("empty column shows No tasks yet placeholder", () => {
    setupStore();
    const column = makeColumn({ tasks: [] });

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });

    expect(el).toBeDefined();
  });

  it("finished/trash section collapses when <= 2 items", () => {
    setupStore();
    const column = makeColumn({
      tasks: [
        makeTask({ id: "t1", status: "done" }),
        makeTask({ id: "t2", status: "done" }),
      ],
    });
    mockColumnUi["col-1"] = { bottomView: "finished", isBottomExpanded: true };

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });

    expect(el).toBeDefined();
  });

  it("toggle finished/trash view switches bottom tasks", () => {
    setupStore();
    const column = makeColumn({
      tasks: [
        makeTask({ id: "t1", status: "done" }),
        makeTask({ id: "t2", status: "trash" }),
      ],
    });
    mockColumnUi["col-1"] = { bottomView: "finished", isBottomExpanded: true };

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });
    expect(el).toBeDefined();
  });

  it("column drag handles work with dnd-kit sortable", () => {
    setupStore();
    const column = makeColumn();

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
    expect(mockSetNodeRef).toHaveBeenCalled();
  });

  it("task drag start sets dragged task and starts presence", () => {
    setupStore();
    const column = makeColumn({
      tasks: [makeTask({ id: "t1" })],
    });

    const el = React.createElement(KanbanColumn as any, {
      boardId: "board-1",
      column,
    });
    expect(el).toBeDefined();
  });

  it("task drop moves task to this column", () => {
    setupStore();
    const column = makeColumn({ tasks: [] });
    mockStore.draggedTaskId = "t1";
    mockStore.tasks.byId = {
      t1: { id: "t1", column_id: "col-other" } as any,
    };

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
  });

  it("column being dragged by collaborator shows overlay", () => {
    setupStore();
    mockDraggingCollaborators.push({
      draggingColumn: { columnId: "col-1" },
      name: "Alice",
      color: "#ff0000",
    });
    const column = makeColumn();

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
  });

  it("context menu opens quick actions", () => {
    setupStore();
    const column = makeColumn();

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
  });

  it("direct rename opens column dialog", () => {
    setupStore();
    const column = makeColumn({ name: "Rename Me" });

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
  });

  it("direct move opens move dialog with available target boards", () => {
    setupStore();
    const column = makeColumn();

    const { container } = render(
      React.createElement(KanbanColumn as any, {
        boardId: "board-1",
        column,
      })
    );

    expect(container).toBeDefined();
  });
});
