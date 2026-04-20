// Must be first - register happy-dom before any imports
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register happy-dom before any imports
if (!(globalThis.document && globalThis.window)) {
  try {
    GlobalRegistrator.register();
  } catch {
    // Already registered, ignore
  }
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

// --- Mock external dependencies ---

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

// Mock auth-client to avoid import errors
mock.module("@/src/lib/auth-client", () => ({
  getCurrentUser: mock(() => Promise.resolve(null)),
  getJwtToken: mock(() => Promise.resolve(null)),
}));

const mockGetViewport = mock(() => ({ x: 0, y: 0, zoom: 1 }));
const mockSetViewport = mock();
const mockScreenToFlowPosition = mock((pos: { x: number; y: number }) => pos);

mock.module("@xyflow/react", () => ({
  useReactFlow: () => ({
    getViewport: mockGetViewport,
    setViewport: mockSetViewport,
    screenToFlowPosition: mockScreenToFlowPosition,
  }),
}));

mock.module("lucide-react", () => ({
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-calendar" {...props}>
      <title>Calendar</title>
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props}>
      <title>Check</title>
    </svg>
  ),
  CheckSquare: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check-square" {...props}>
      <title>CheckSquare</title>
    </svg>
  ),
  GripVertical: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-grip-vertical" {...props}>
      <title>GripVertical</title>
    </svg>
  ),
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-rotate-ccw" {...props}>
      <title>RotateCcw</title>
    </svg>
  ),
  Trash2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-trash" {...props}>
      <title>Trash</title>
    </svg>
  ),
}));

mock.module("@/src/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <span className={className} data-testid="badge">
      {children}
    </span>
  ),
}));

mock.module("@/src/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    className?: string;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      checked={checked}
      className={className}
      data-testid="checkbox"
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      type="checkbox"
    />
  ),
}));

mock.module("@/src/components/tasks/task-drag-presence-indicator", () => ({
  TaskDragPresenceIndicator: () => null,
}));

const mockToggleTaskSelection = mock();
const mockOpenTaskDetailModal = mock(() => ({
  isExisting: false,
  position: { x: 100, y: 100 },
}));
const mockUpdateTask = mock();
const mockDeleteTask = mock();
const mockOpenTaskQuickActions = mock();
const mockSetDraggedTask = mock();

const mockKanbanStore = {
  selectedTaskIds: [] as string[],
  draggedTaskId: null as string | null,
  taskQuickActions: {} as Record<string, unknown>,
  boardPositions: {
    byId: {
      "board-1": { x: 0, y: 0, width: 400 },
    },
  },
  toggleTaskSelection: mockToggleTaskSelection,
  openTaskDetailModal: mockOpenTaskDetailModal,
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
  openTaskQuickActions: mockOpenTaskQuickActions,
  setDraggedTask: mockSetDraggedTask,
};

mock.module("@/src/features/kanban", () => ({
  useKanbanStore: (selector: (state: typeof mockKanbanStore) => unknown) =>
    selector(mockKanbanStore),
}));

const mockGetTaskDragCollaborator = mock(() => null);
const mockStartDragging = mock();
const mockStopDragging = mock();
const mockUpdateDragPosition = mock();

mock.module("@/src/hooks/use-task-drag-presence", () => ({
  useTaskDragPresence: () => ({
    getTaskDragCollaborator: mockGetTaskDragCollaborator,
    startDragging: mockStartDragging,
    stopDragging: mockStopDragging,
    updateDragPosition: mockUpdateDragPosition,
  }),
}));

import type { Task } from "@/src/features/kanban";
import { TaskCard } from "./task-card";

// --- Helper functions ---

let taskCounter = 0;

function createMockTask(overrides?: Partial<Task>): Task {
  taskCounter++;
  return {
    id: `task-${taskCounter}`,
    board_id: "board-1",
    column_id: "column-1",
    title: "Test Task",
    description: "",
    status: "todo",
    priority: "medium",
    progress: 0,
    position: taskCounter,
    tags: [],
    created_by: "user-1",
    due_date: undefined,
    checklists: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Tests ---

describe("TaskCard", () => {
  let mockOnDragStart: ReturnType<typeof mock>;
  let mockOnOpenDetail: ReturnType<typeof mock>;

  beforeEach(() => {
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();

    mockGetViewport.mockReset();
    mockSetViewport.mockReset();
    mockScreenToFlowPosition.mockReset();
    mockToggleTaskSelection.mockReset();
    mockOpenTaskDetailModal.mockReset();
    mockUpdateTask.mockReset();
    mockDeleteTask.mockReset();
    mockOpenTaskQuickActions.mockReset();
    mockSetDraggedTask.mockReset();
    mockGetTaskDragCollaborator.mockReset();
    mockStartDragging.mockReset();
    mockStopDragging.mockReset();
    mockUpdateDragPosition.mockReset();

    mockGetViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });
    mockGetTaskDragCollaborator.mockReturnValue(null);
    mockOpenTaskDetailModal.mockReturnValue({
      isExisting: false,
      position: { x: 100, y: 100 },
    });
    mockScreenToFlowPosition.mockImplementation(
      (pos: { x: number; y: number }) => pos
    );

    mockKanbanStore.selectedTaskIds = [];
    mockKanbanStore.draggedTaskId = null;
    mockKanbanStore.taskQuickActions = {};

    taskCounter = 0;

    mockOnDragStart = mock();
    mockOnOpenDetail = mock();
  });

  describe("Basic rendering", () => {
    it("renders task title", () => {
      const task = createMockTask({ title: "My Important Task" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByText("My Important Task")).toBeDefined();
    });

    it("renders task description when present", () => {
      const task = createMockTask({
        title: "Task with Description",
        description: "This is a detailed description",
      });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByText("This is a detailed description")).toBeDefined();
    });

    it("renders priority badge", () => {
      const task = createMockTask({ priority: "high" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByText("high")).toBeDefined();
    });

    it("renders due date when present", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const task = createMockTask({ due_date: futureDate.toISOString() });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByTestId("icon-calendar")).toBeDefined();
    });

    it("renders tags when present", () => {
      const task = createMockTask({ tags: ["frontend", "urgent"] });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByText("frontend")).toBeDefined();
      expect(screen.getByText("urgent")).toBeDefined();
    });

    it("renders checklist icon", () => {
      const task = createMockTask({
        checklists: [
          {
            id: "cl-1",
            title: "Checklist 1",
            position: 0,
            task_id: "task-1",
            completed: false,
          },
        ],
      });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByTestId("icon-check-square")).toBeDefined();
    });
  });

  describe("Click behavior", () => {
    it("opens task detail on title click", () => {
      const task = createMockTask();
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByText(task.title));
      expect(mockOpenTaskDetailModal).toHaveBeenCalled();
    });

    it("does not open detail when clicking checkbox", () => {
      const task = createMockTask();
      mockKanbanStore.selectedTaskIds = ["other-task"];
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("checkbox"));
      expect(mockOpenTaskDetailModal).not.toHaveBeenCalled();
    });

    it("calls onOpenDetail prop when provided", () => {
      const task = createMockTask();
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          onOpenDetail={mockOnOpenDetail}
          task={task}
        />
      );
      // Click on the title element
      const title = screen.getByText(task.title);
      fireEvent.mouseDown(title, { clientX: 150, clientY: 200 });
      fireEvent.click(title, { clientX: 150, clientY: 200 });
      expect(mockOnOpenDetail).toHaveBeenCalledWith(task.id, 150, 200);
    });
  });

  describe("Selection behavior", () => {
    it("shows checkbox when other tasks are selected", () => {
      const task = createMockTask();
      mockKanbanStore.selectedTaskIds = ["other-task"];
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(screen.getByTestId("checkbox")).toBeDefined();
    });

    it("checks checkbox when task is selected", () => {
      const task = createMockTask();
      mockKanbanStore.selectedTaskIds = [task.id];
      render(
        <TaskCard
          boardId="board-1"
          isSelected={true}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      const checkbox = screen.getByTestId("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("toggles selection when checkbox is clicked", () => {
      const task = createMockTask();
      mockKanbanStore.selectedTaskIds = ["other-task"];
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("checkbox"));
      expect(mockToggleTaskSelection).toHaveBeenCalledWith(task.id);
    });
  });

  describe("Status toggle", () => {
    it("toggles status from todo to done", () => {
      const task = createMockTask({ status: "todo" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("icon-check").closest("button")!);
      expect(mockUpdateTask).toHaveBeenCalledWith(task.id, {
        status: "done",
      });
    });

    it("toggles status from done to todo", () => {
      const task = createMockTask({ status: "done" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("icon-rotate-ccw").closest("button")!);
      expect(mockUpdateTask).toHaveBeenCalledWith(task.id, {
        status: "todo",
      });
    });

    it("restores trash status to todo", () => {
      const task = createMockTask({ status: "trash" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("icon-rotate-ccw").closest("button")!);
      expect(mockUpdateTask).toHaveBeenCalledWith(task.id, {
        status: "todo",
      });
    });

    it("stops propagation on status toggle", () => {
      const task = createMockTask({ status: "todo" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      const checkButton = screen.getByTestId("icon-check").closest("button");
      const stopPropagation = mock();
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, "stopPropagation", {
        value: stopPropagation,
        writable: true,
      });
      fireEvent(checkButton!, clickEvent);
      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe("Delete behavior", () => {
    it("moves task to trash on delete", () => {
      const task = createMockTask({ status: "todo" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("icon-trash").closest("button")!);
      expect(mockUpdateTask).toHaveBeenCalledWith(task.id, {
        status: "trash",
      });
    });

    it("permanently deletes task when already in trash", () => {
      const task = createMockTask({ status: "trash" });
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      fireEvent.click(screen.getByTestId("icon-trash").closest("button")!);
      expect(mockDeleteTask).toHaveBeenCalledWith(task.id);
    });
  });

  describe("Visual states", () => {
    it("applies line-through for done status", () => {
      const task = createMockTask({ status: "done" });
      mockKanbanStore.selectedTaskIds = ["other-task"];
      render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      const taskCard = document.querySelector(`[data-task-id="${task.id}"]`);
      const title = taskCard?.querySelector("h4");
      expect(title?.className).toContain("line-through");
    });

    it("shows overdue styling for past due dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const task = createMockTask({ due_date: pastDate.toISOString() });
      const { container } = render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(container.querySelector(".text-red-400")).toBeDefined();
    });

    it("shows due soon styling for near future dates", () => {
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 2);
      const task = createMockTask({ due_date: nearFutureDate.toISOString() });
      const { container } = render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(container.querySelector(".text-yellow-400")).toBeDefined();
    });
  });

  describe("Priority colors", () => {
    it("applies blue styling for low priority", () => {
      const task = createMockTask({ priority: "low" });
      const { container } = render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(container.querySelector(".bg-blue-500\\/20")).toBeDefined();
    });

    it("applies yellow styling for medium priority", () => {
      const task = createMockTask({ priority: "medium" });
      const { container } = render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(container.querySelector(".bg-yellow-500\\/20")).toBeDefined();
    });

    it("applies red styling for high priority", () => {
      const task = createMockTask({ priority: "high" });
      const { container } = render(
        <TaskCard
          boardId="board-1"
          isSelected={false}
          onDragStart={mockOnDragStart}
          task={task}
        />
      );
      expect(container.querySelector(".bg-red-500\\/20")).toBeDefined();
    });
  });
});
