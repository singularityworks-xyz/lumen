import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import type { OnConnect, OnEdgesChange } from "@xyflow/react";
import type { BoardEdge } from "@/src/components/core/board-edge";
import type { CanvasNode } from "@/src/components/core/helpers/canvas-types";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { KanbanStore } from "@/src/features/kanban/store/types";

const mockStartColumnDrag = mock(() => undefined);
const mockStopColumnDrag = mock(() => undefined);
const mockUpdateColumnDragPosition = mock(() => undefined);

mock.module("@/src/hooks/use-column-drag-presence", () => ({
  useColumnDragPresence: () => ({
    startDragging: mockStartColumnDrag,
    stopDragging: mockStopColumnDrag,
    updateDragPosition: mockUpdateColumnDragPosition,
  }),
}));

const mockSetPresenceSelectionBox = mock(() => undefined);

mock.module("@/src/hooks/use-selection-presence", () => ({
  useSelectionPresence: () => ({
    setSelectionBox: mockSetPresenceSelectionBox,
  }),
}));

mock.module("@/src/hooks/use-task-drag-presence", () => ({
  useTaskDragPresence: () => ({
    startDragging: mock(() => undefined),
    stopDragging: mock(() => undefined),
    updateDragPosition: mock(() => undefined),
  }),
}));

let keydownListener: ((e: KeyboardEvent) => void) | null = null;

const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

beforeEach(() => {
  mockStartColumnDrag.mockClear();
  mockStopColumnDrag.mockClear();
  mockUpdateColumnDragPosition.mockClear();
  mockSetPresenceSelectionBox.mockClear();
  keydownListener = null;

  window.addEventListener = mock(
    (event: string, listener: (...args: unknown[]) => void) => {
      if (event === "keydown") {
        keydownListener = listener as (e: KeyboardEvent) => void;
      }
      return originalAddEventListener.call(window, event, listener);
    }
  ) as typeof window.addEventListener;

  window.removeEventListener = mock(
    (event: string, listener: (...args: unknown[]) => void) => {
      if (event === "keydown") {
        keydownListener = null;
      }
      return originalRemoveEventListener.call(window, event, listener);
    }
  ) as typeof window.removeEventListener;

  useKanbanStore.setState({
    selectionBox: null,
  });

  document.body.innerHTML = "";
});

function createDragStartEvent(
  overrides: Partial<DragStartEvent> = {}
): DragStartEvent {
  return {
    active: {
      id: "col-1",
      data: {
        current: {
          type: "column",
          columnId: "col-1",
          boardId: "board-1",
        },
      },
    },
    activatorEvent: new MouseEvent("mousedown", { clientX: 100, clientY: 200 }),
    ...overrides,
  } as DragStartEvent;
}

function createDragEndEvent(
  overrides: Partial<DragEndEvent> = {}
): DragEndEvent {
  return {
    active: {
      id: "col-1",
      data: { current: null },
    } as unknown as DragEndEvent["active"],
    over: null,
    ...overrides,
  } as DragEndEvent;
}

function createOver(
  id: string,
  data: { current: { type: string; boardId: string; columnId?: string } }
): DragEndEvent["over"] {
  return {
    id,
    data,
    rect: {
      current: {
        translated: { x: 0, y: 0 },
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
      },
    },
    disabled: false,
  } as unknown as DragEndEvent["over"];
}

function createOverData(
  type: string,
  boardId: string,
  columnId?: string
): { type: string; boardId: string; columnId?: string } {
  return { type, boardId, columnId };
}

describe("useColumnDragHandlers", () => {
  function setup(overrides: Partial<KanbanStore> = {}) {
    const boards = {
      byId: {
        "board-1": {
          id: "board-1",
          name: "Board 1",
          column_ids: ["col-1", "col-2", "col-3"],
        },
        "board-2": {
          id: "board-2",
          name: "Board 2",
          column_ids: ["col-4"],
        },
      },
      allIds: ["board-1", "board-2"],
    };

    const columns = {
      byId: {
        "col-1": {
          id: "col-1",
          name: "To Do",
          board_id: "board-1",
          task_ids: ["t1", "t2"],
          position: 0,
        },
        "col-2": {
          id: "col-2",
          name: "In Progress",
          board_id: "board-1",
          task_ids: ["t3"],
          position: 1,
        },
        "col-3": {
          id: "col-3",
          name: "Done",
          board_id: "board-1",
          task_ids: [],
          position: 2,
        },
        "col-4": {
          id: "col-4",
          name: "Backlog",
          board_id: "board-2",
          task_ids: [],
          position: 0,
        },
      },
      allIds: ["col-1", "col-2", "col-3", "col-4"],
    };

    const moveColumn = mock(() => undefined);
    const moveColumnToBoard = mock(() => undefined);

    const props = {
      boards,
      columns,
      moveColumn,
      moveColumnToBoard,
      ...overrides,
    };

    const { result } = renderHook(() => {
      const {
        useColumnDragHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useColumnDragHandlers(props);
    });

    return { result, moveColumn, moveColumnToBoard };
  }

  it("sets active column data on drag start for column type", () => {
    const { result } = setup();
    const event = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(event);
    });

    expect(result.current.activeColumnData).toEqual({
      columnId: "col-1",
      sourceBoardId: "board-1",
      columnName: "To Do",
      taskCount: 2,
    });
    expect(mockStartColumnDrag).toHaveBeenCalledWith(
      "col-1",
      "board-1",
      100,
      200
    );
  });

  it("does not set active data for non-column drag types", () => {
    const { result } = setup();
    const event = createDragStartEvent({
      active: {
        id: "task-1",
        data: { current: { type: "task", taskId: "task-1" } },
      },
    } as unknown as DragStartEvent);

    act(() => {
      result.current.handleColumnDragStart(event);
    });

    expect(result.current.activeColumnData).toBeNull();
    expect(mockStartColumnDrag).not.toHaveBeenCalled();
  });

  it("handles pointer event on drag start", () => {
    const { result } = setup();
    const pointerEvent = new PointerEvent("pointerdown", {
      clientX: 50,
      clientY: 75,
    });

    const event = createDragStartEvent({
      activatorEvent: pointerEvent,
    });

    act(() => {
      result.current.handleColumnDragStart(event);
    });

    expect(mockStartColumnDrag).toHaveBeenCalledWith(
      "col-1",
      "board-1",
      50,
      75
    );
  });

  it("clears active data on drag end with no over target", () => {
    const { result } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    expect(result.current.activeColumnData).not.toBeNull();

    const endEvent = createDragEndEvent({ over: null });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(result.current.activeColumnData).toBeNull();
    expect(mockStopColumnDrag).toHaveBeenCalled();
  });

  it("clears active data on drag end when no active data exists", () => {
    const { result } = setup();
    const endEvent = createDragEndEvent({
      over: createOver("col-2", {
        current: createOverData("column", "board-1", "col-2"),
      }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(result.current.activeColumnData).toBeNull();
  });

  it("reorders column within same board on drag end", () => {
    const { result, moveColumn } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    const endEvent = createDragEndEvent({
      over: createOver("col-3", {
        current: createOverData("column", "board-1", "col-3"),
      }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(moveColumn).toHaveBeenCalledWith("board-1", "col-1", 2);
    expect(result.current.activeColumnData).toBeNull();
  });

  it("moves column to different board on drag end", () => {
    const { result, moveColumnToBoard } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    const endEvent = createDragEndEvent({
      over: createOver("col-4", {
        current: createOverData("column", "board-2", "col-4"),
      }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(moveColumnToBoard).toHaveBeenCalledWith(
      "board-1",
      "col-1",
      "board-2"
    );
    expect(result.current.activeColumnData).toBeNull();
  });

  it("handles board-droppable over data type for cross-board move", () => {
    const { result, moveColumnToBoard } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    const endEvent = createDragEndEvent({
      over: createOver("board-2", {
        current: createOverData("board-droppable", "board-2"),
      }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(moveColumnToBoard).toHaveBeenCalledWith(
      "board-1",
      "col-1",
      "board-2"
    );
  });

  it("does not move when over target has no boardId", () => {
    const { result, moveColumn, moveColumnToBoard } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    const endEvent = createDragEndEvent({
      over: createOver("unknown", { current: { type: "unknown" } as any }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(moveColumn).not.toHaveBeenCalled();
    expect(moveColumnToBoard).not.toHaveBeenCalled();
    expect(result.current.activeColumnData).toBeNull();
  });

  it("does not reorder when oldIndex equals newIndex", () => {
    const { result, moveColumn } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    const endEvent = createDragEndEvent({
      over: createOver("col-1", {
        current: createOverData("column", "board-1", "col-1"),
      }),
    });

    act(() => {
      result.current.handleColumnDragEnd(endEvent);
    });

    expect(moveColumn).not.toHaveBeenCalled();
  });

  it("returns activeColumnDataRef that tracks activeColumnData", () => {
    const { result } = setup();
    const startEvent = createDragStartEvent();

    act(() => {
      result.current.handleColumnDragStart(startEvent);
    });

    expect(result.current.activeColumnDataRef.current).toEqual({
      columnId: "col-1",
      sourceBoardId: "board-1",
      columnName: "To Do",
      taskCount: 2,
    });
  });

  it("returns updateColumnDragPosition function", () => {
    const { result } = setup();
    expect(typeof result.current.updateColumnDragPosition).toBe("function");
  });
});

describe("useKeyboardHandlers", () => {
  function setup(
    overrides: {
      interactionMode?: "drag" | "select";
      localEdges?: BoardEdge[];
      showWelcomeScreen?: boolean;
    } = {}
  ) {
    const {
      interactionMode = "drag",
      localEdges = [],
      showWelcomeScreen = false,
    } = overrides;
    const clearBoardSelection = mock(() => undefined);
    const setInteractionMode = mock(() => undefined);
    const removeConnection = mock(() => undefined);

    const { result } = renderHook(() => {
      const {
        useKeyboardHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useKeyboardHandlers({
        clearBoardSelection,
        interactionMode,
        localEdges,
        removeConnection,
        setInteractionMode,
        showWelcomeScreen,
      });
    });

    return {
      clearBoardSelection,
      setInteractionMode,
      removeConnection,
      result,
    };
  }

  function fireKeydown(
    eventInit: KeyboardEventInit & { target?: EventTarget; repeat?: boolean }
  ) {
    if (keydownListener) {
      const event = new KeyboardEvent("keydown", eventInit);
      Object.defineProperty(event, "key", { value: eventInit.key });
      Object.defineProperty(event, "metaKey", { value: eventInit.metaKey });
      Object.defineProperty(event, "ctrlKey", { value: eventInit.ctrlKey });
      Object.defineProperty(event, "shiftKey", { value: eventInit.shiftKey });
      Object.defineProperty(event, "repeat", { value: eventInit.repeat });
      Object.defineProperty(event, "target", {
        value: (eventInit as any).target || document.body,
      });
      keydownListener(event);
    }
  }

  it("toggles mode from drag to select on V key press", () => {
    const { setInteractionMode } = setup({ interactionMode: "drag" });

    fireKeydown({ key: "v" });

    expect(setInteractionMode).toHaveBeenCalledWith("select");
  });

  it("toggles mode from select to drag on V key press", () => {
    const { setInteractionMode } = setup({ interactionMode: "select" });

    fireKeydown({ key: "v" });

    expect(setInteractionMode).toHaveBeenCalledWith("drag");
  });

  it("ignores V key when meta key is pressed", () => {
    const { setInteractionMode } = setup({ interactionMode: "drag" });

    fireKeydown({ key: "v", metaKey: true });

    expect(setInteractionMode).not.toHaveBeenCalled();
  });

  it("ignores V key when ctrl key is pressed", () => {
    const { setInteractionMode } = setup({ interactionMode: "drag" });

    fireKeydown({ key: "v", ctrlKey: true });

    expect(setInteractionMode).not.toHaveBeenCalled();
  });

  it("ignores repeated V key presses", () => {
    const { setInteractionMode } = setup({ interactionMode: "drag" });

    fireKeydown({ key: "v", repeat: true });

    expect(setInteractionMode).not.toHaveBeenCalled();
  });

  it("clears selection on Escape key when in select mode", () => {
    const { clearBoardSelection } = setup({ interactionMode: "select" });

    fireKeydown({ key: "Escape" });

    expect(clearBoardSelection).toHaveBeenCalled();
  });

  it("does not clear selection on Escape when in drag mode", () => {
    const { clearBoardSelection } = setup({ interactionMode: "drag" });

    fireKeydown({ key: "Escape" });

    expect(clearBoardSelection).not.toHaveBeenCalled();
  });

  it("removes selected edges on Delete key", () => {
    const edges: BoardEdge[] = [
      { id: "e1", source: "n1", target: "n2", selected: true },
      { id: "e2", source: "n2", target: "n3", selected: true },
      { id: "e3", source: "n3", target: "n4", selected: false },
    ] as unknown as BoardEdge[];

    const { removeConnection } = setup({ localEdges: edges });

    fireKeydown({ key: "Delete" });

    expect(removeConnection).toHaveBeenCalledWith("e1");
    expect(removeConnection).toHaveBeenCalledWith("e2");
    expect(removeConnection).not.toHaveBeenCalledWith("e3");
  });

  it("removes selected edges on Backspace key", () => {
    const edges: BoardEdge[] = [
      { id: "e1", source: "n1", target: "n2", selected: true },
    ] as unknown as BoardEdge[];

    const { removeConnection } = setup({ localEdges: edges });

    fireKeydown({ key: "Backspace" });

    expect(removeConnection).toHaveBeenCalledWith("e1");
  });

  it("does nothing on Delete when no edges are selected", () => {
    const edges: BoardEdge[] = [
      { id: "e1", source: "n1", target: "n2", selected: false },
    ] as unknown as BoardEdge[];

    const { removeConnection } = setup({ localEdges: edges });

    fireKeydown({ key: "Delete" });

    expect(removeConnection).not.toHaveBeenCalled();
  });

  it("calls undo on Cmd+Z when canUndo is true", async () => {
    await import("@/src/components/core/helpers/canvas-handlers");
    const { undo, canUndo } = await import(
      "@/src/features/kanban/store/kanban-store"
    );

    const origCanUndo = canUndo();
    const origUndo = undo;

    const canUndoMock = mock(() => true);
    const undoMock = mock(() => undefined);

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: canUndoMock,
      canRedo: mock(() => false),
      undo: undoMock,
      redo: mock(() => undefined),
    }));

    setup({ interactionMode: "drag" });

    fireKeydown({ key: "z", metaKey: true });

    expect(undoMock).toHaveBeenCalled();

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: () => origCanUndo,
      canRedo: mock(() => false),
      undo: origUndo,
      redo: mock(() => undefined),
    }));
  });

  it("calls redo on Cmd+Shift+Z when canRedo is true", async () => {
    await import("@/src/components/core/helpers/canvas-handlers");
    const { redo, canRedo } = await import(
      "@/src/features/kanban/store/kanban-store"
    );

    const origCanRedo = canRedo();
    const origRedo = redo;

    const canRedoMock = mock(() => true);
    const redoMock = mock(() => undefined);

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: mock(() => false),
      canRedo: canRedoMock,
      undo: mock(() => undefined),
      redo: redoMock,
    }));

    setup({ interactionMode: "drag" });

    fireKeydown({ key: "z", metaKey: true, shiftKey: true });

    expect(redoMock).toHaveBeenCalled();

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: mock(() => false),
      canRedo: () => origCanRedo,
      undo: mock(() => undefined),
      redo: origRedo,
    }));
  });

  it("calls redo on Cmd+Y when canRedo is true", async () => {
    const { redo, canRedo } = await import(
      "@/src/features/kanban/store/kanban-store"
    );

    const origCanRedo = canRedo();
    const origRedo = redo;

    const canRedoMock = mock(() => true);
    const redoMock = mock(() => undefined);

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: mock(() => false),
      canRedo: canRedoMock,
      undo: mock(() => undefined),
      redo: redoMock,
    }));

    setup({ interactionMode: "drag" });

    fireKeydown({ key: "y", metaKey: true });

    expect(redoMock).toHaveBeenCalled();

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: mock(() => false),
      canRedo: () => origCanRedo,
      undo: mock(() => undefined),
      redo: origRedo,
    }));
  });

  it("does not call undo when canUndo is false", async () => {
    const { undo, canUndo } = await import(
      "@/src/features/kanban/store/kanban-store"
    );

    const origCanUndo = canUndo();
    const origUndo = undo;

    const canUndoMock = mock(() => false);
    const undoMock = mock(() => undefined);

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: canUndoMock,
      canRedo: mock(() => false),
      undo: undoMock,
      redo: mock(() => undefined),
    }));

    setup({ interactionMode: "drag" });

    fireKeydown({ key: "z", metaKey: true });

    expect(undoMock).not.toHaveBeenCalled();

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: () => origCanUndo,
      canRedo: mock(() => false),
      undo: origUndo,
      redo: mock(() => undefined),
    }));
  });

  it("does nothing on V key when showWelcomeScreen is true", () => {
    const { setInteractionMode } = setup({
      interactionMode: "drag",
      showWelcomeScreen: true,
    });

    fireKeydown({ key: "v" });

    expect(setInteractionMode).not.toHaveBeenCalled();
  });

  it("handles V key in editable elements without toggling mode", () => {
    const { setInteractionMode } = setup({ interactionMode: "drag" });
    const inputEl = {
      tagName: "INPUT",
      isContentEditable: false,
    } as unknown as HTMLElement;

    fireKeydown({ key: "v", target: inputEl });

    expect(setInteractionMode).not.toHaveBeenCalled();
  });

  it("handles Escape in editable elements without clearing selection", () => {
    const { clearBoardSelection } = setup({ interactionMode: "select" });
    const textareaEl = {
      tagName: "TEXTAREA",
      isContentEditable: false,
    } as unknown as HTMLElement;

    fireKeydown({ key: "Escape", target: textareaEl });

    expect(clearBoardSelection).not.toHaveBeenCalled();
  });

  it("handles Delete in editable elements without removing edges", () => {
    const edges: BoardEdge[] = [
      { id: "e1", source: "n1", target: "n2", selected: true },
    ] as unknown as BoardEdge[];

    const { removeConnection } = setup({ localEdges: edges });
    const selectEl = {
      tagName: "SELECT",
      isContentEditable: false,
    } as unknown as HTMLElement;

    fireKeydown({ key: "Delete", target: selectEl });

    expect(removeConnection).not.toHaveBeenCalled();
  });

  it("allows undo/redo in editable elements", async () => {
    const { undo, canUndo } = await import(
      "@/src/features/kanban/store/kanban-store"
    );

    const origCanUndo = canUndo();
    const origUndo = undo;

    const canUndoMock = mock(() => true);
    const undoMock = mock(() => undefined);

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: canUndoMock,
      canRedo: mock(() => false),
      undo: undoMock,
      redo: mock(() => undefined),
    }));

    setup({ interactionMode: "drag" });
    const inputEl = {
      tagName: "INPUT",
      isContentEditable: false,
    } as unknown as HTMLElement;

    fireKeydown({ key: "z", metaKey: true, target: inputEl });

    expect(undoMock).toHaveBeenCalled();

    mock.module("@/src/features/kanban/store/kanban-store", () => ({
      useKanbanStore,
      canUndo: () => origCanUndo,
      canRedo: mock(() => false),
      undo: origUndo,
      redo: mock(() => undefined),
    }));
  });

  it("handles contenteditable elements as editable", () => {
    const { setInteractionMode, clearBoardSelection } = setup({
      interactionMode: "select",
    });
    const editableEl = {
      tagName: "DIV",
      isContentEditable: true,
    } as unknown as HTMLElement;

    fireKeydown({ key: "v", target: editableEl });
    fireKeydown({ key: "Escape", target: editableEl });

    expect(setInteractionMode).not.toHaveBeenCalled();
    expect(clearBoardSelection).not.toHaveBeenCalled();
  });

  it("removes event listener on unmount", () => {
    const { unmount } = renderHook(() => {
      const {
        useKeyboardHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useKeyboardHandlers({
        clearBoardSelection: mock(() => undefined),
        interactionMode: "drag",
        localEdges: [],
        removeConnection: mock(() => undefined),
        setInteractionMode: mock(() => undefined),
        showWelcomeScreen: false,
      });
    });

    expect(keydownListener).not.toBeNull();

    unmount();

    expect(keydownListener).toBeNull();
  });
});

describe("useSelectionHandlers", () => {
  function createMouseEvent(
    clientX: number,
    clientY: number
  ): React.MouseEvent {
    return {
      clientX,
      clientY,
    } as unknown as React.MouseEvent;
  }

  function setup() {
    const screenToFlowPosition = mock(({ x, y }: { x: number; y: number }) => ({
      x,
      y,
    }));

    const { result } = renderHook(() => {
      const {
        useSelectionHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useSelectionHandlers(screenToFlowPosition);
    });

    return { result, screenToFlowPosition };
  }

  it("stores selection start ref on selection start", () => {
    const { result, screenToFlowPosition } = setup();
    const event = createMouseEvent(100, 200);

    act(() => {
      result.current.handleSelectionStart(event);
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 100, y: 200 });
    expect(result.current.selectionStartRef.current).toEqual({
      x: 100,
      y: 200,
    });
    expect(result.current.isSelectingRef.current).toBe(true);
  });

  it("clears small selections less than 10px on selection end", () => {
    const { result } = setup();

    const selectionEl = document.createElement("div");
    selectionEl.className = "react-flow__selection";
    selectionEl.style.width = "5px";
    selectionEl.style.height = "5px";
    document.body.appendChild(selectionEl);

    const getBoundingClientRectMock = mock(
      (): DOMRect =>
        ({
          left: 100,
          top: 100,
          right: 105,
          bottom: 105,
          width: 5,
          height: 5,
          x: 100,
          y: 100,
          toJSON: () => ({}),
        }) as DOMRect
    );

    selectionEl.getBoundingClientRect = getBoundingClientRectMock;

    act(() => {
      result.current.onSelectionEndWrapper(createMouseEvent(110, 110));
    });

    expect(useKanbanStore.getState().selectionBox).toBeNull();
    expect(result.current.isSelectingRef.current).toBe(false);

    document.body.removeChild(selectionEl);
  });

  it("stores large selections on selection end via DOM element", () => {
    const { result, screenToFlowPosition } = setup();

    const selectionEl = document.createElement("div");
    selectionEl.className = "react-flow__selection";
    document.body.appendChild(selectionEl);

    const getBoundingClientRectMock = mock(
      (): DOMRect =>
        ({
          left: 100,
          top: 100,
          right: 300,
          bottom: 250,
          width: 200,
          height: 150,
          x: 100,
          y: 100,
          toJSON: () => ({}),
        }) as DOMRect
    );

    selectionEl.getBoundingClientRect = getBoundingClientRectMock;

    act(() => {
      result.current.onSelectionEndWrapper(createMouseEvent(300, 250));
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 100, y: 100 });
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 300, y: 250 });

    const state = useKanbanStore.getState();
    expect(state.selectionBox).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });

    document.body.removeChild(selectionEl);
  });

  it("uses fallback calculation when no selection DOM element exists", () => {
    const { result, screenToFlowPosition } = setup();

    act(() => {
      result.current.handleSelectionStart(createMouseEvent(50, 50));
    });

    act(() => {
      result.current.onSelectionEndWrapper(createMouseEvent(150, 120));
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 150, y: 120 });

    const state = useKanbanStore.getState();
    expect(state.selectionBox).toEqual({
      x: 50,
      y: 50,
      width: 100,
      height: 70,
    });
  });

  it("clears selection on close selection menu", () => {
    const { result } = setup();

    act(() => {
      result.current.handleCloseSelectionMenu();
    });

    expect(useKanbanStore.getState().selectionBox).toBeNull();
    expect(mockSetPresenceSelectionBox).toHaveBeenCalledWith(null);
  });

  it("syncs selection box to presence when store selectionBox changes", () => {
    setup();

    act(() => {
      useKanbanStore.setState({
        selectionBox: { x: 10, y: 20, width: 100, height: 80 },
      });
    });

    expect(mockSetPresenceSelectionBox).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 80,
    });
  });

  it("does not store selection when width or height is zero", () => {
    const { result } = setup();

    const selectionEl = document.createElement("div");
    selectionEl.className = "react-flow__selection";
    document.body.appendChild(selectionEl);

    const getBoundingClientRectMock = mock(
      (): DOMRect =>
        ({
          left: 100,
          top: 100,
          right: 100,
          bottom: 200,
          width: 0,
          height: 100,
          x: 100,
          y: 100,
          toJSON: () => ({}),
        }) as DOMRect
    );

    selectionEl.getBoundingClientRect = getBoundingClientRectMock;

    act(() => {
      result.current.onSelectionEndWrapper(createMouseEvent(100, 200));
    });

    const state = useKanbanStore.getState();
    expect(state.selectionBox).toBeNull();

    document.body.removeChild(selectionEl);
  });

  it("resets refs after selection end", () => {
    const { result } = setup();

    act(() => {
      result.current.handleSelectionStart(createMouseEvent(50, 50));
    });

    act(() => {
      result.current.onSelectionEndWrapper(createMouseEvent(150, 150));
    });

    expect(result.current.isSelectingRef.current).toBe(false);
    expect(result.current.selectionStartRef.current).toBeNull();
  });
});

describe("useEdgeHandlers", () => {
  function setup() {
    const onEdgesChange = mock(() => undefined);
    const addConnection = mock(() => undefined);
    const removeConnection = mock(() => undefined);

    const { result } = renderHook(() => {
      const {
        useEdgeHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useEdgeHandlers({
        onEdgesChange,
        addConnection,
        removeConnection,
      });
    });

    return { result, onEdgesChange, addConnection, removeConnection };
  }

  it("propagates edges change to onEdgesChange callback", () => {
    const { result, onEdgesChange } = setup();
    const changes = [{ type: "select", id: "e1", selected: true }];

    act(() => {
      result.current.handleEdgesChange(changes);
    });

    expect(onEdgesChange).toHaveBeenCalledWith(changes);
  });

  it("removes connection when edge change type is remove", () => {
    const { result, removeConnection } = setup();
    const changes = [{ type: "remove", id: "e1" }];

    act(() => {
      result.current.handleEdgesChange(
        changes as Parameters<OnEdgesChange<BoardEdge>>[0]
      );
    });

    expect(removeConnection).toHaveBeenCalledWith("e1");
  });

  it("does not remove connection for non-remove changes", () => {
    const { result, removeConnection } = setup();
    const changes = [{ type: "select", id: "e1", selected: true }];

    act(() => {
      result.current.handleEdgesChange(changes);
    });

    expect(removeConnection).not.toHaveBeenCalled();
  });

  it("adds connection on connect with source and target", () => {
    const { result, addConnection } = setup();
    const connection = {
      source: "node-1",
      target: "node-2",
      sourceHandle: "right",
      targetHandle: "left",
    };

    act(() => {
      result.current.handleConnect(connection as Parameters<OnConnect>[0]);
    });

    expect(addConnection).toHaveBeenCalledWith("node-1", "node-2", {
      sourceHandle: "right",
      targetHandle: "left",
    });
  });

  it("adds connection with undefined handles when handles are missing", () => {
    const { result, addConnection } = setup();
    const connection = {
      source: "node-1",
      target: "node-2",
    };

    act(() => {
      result.current.handleConnect(connection as Parameters<OnConnect>[0]);
    });

    expect(addConnection).toHaveBeenCalledWith("node-1", "node-2", {
      sourceHandle: undefined,
      targetHandle: undefined,
    });
  });

  it("does not add connection when source is missing", () => {
    const { result, addConnection } = setup();
    const connection = {
      target: "node-2",
    };

    act(() => {
      result.current.handleConnect(connection as Parameters<OnConnect>[0]);
    });

    expect(addConnection).not.toHaveBeenCalled();
  });

  it("does not add connection when target is missing", () => {
    const { result, addConnection } = setup();
    const connection = {
      source: "node-1",
    };

    act(() => {
      result.current.handleConnect(connection as Parameters<OnConnect>[0]);
    });

    expect(addConnection).not.toHaveBeenCalled();
  });

  it("handles multiple remove changes in single call", () => {
    const { result, removeConnection } = setup();
    const changes = [
      { type: "remove", id: "e1" },
      { type: "remove", id: "e2" },
      { type: "remove", id: "e3" },
    ];

    act(() => {
      result.current.handleEdgesChange(
        changes as Parameters<OnEdgesChange<BoardEdge>>[0]
      );
    });

    expect(removeConnection).toHaveBeenCalledWith("e1");
    expect(removeConnection).toHaveBeenCalledWith("e2");
    expect(removeConnection).toHaveBeenCalledWith("e3");
  });
});

describe("useViewportHandlers", () => {
  function setup() {
    const setViewport = mock(() => undefined);

    const { result } = renderHook(() => {
      const {
        useViewportHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useViewportHandlers(setViewport);
    });

    return { result, setViewport };
  }

  it("persists viewport on move end", () => {
    const { result, setViewport } = setup();
    const viewportState = { x: 100, y: 200, zoom: 1.5 };

    act(() => {
      result.current.handleMoveEnd(
        new Event("moveend") as unknown as React.MouseEvent,
        viewportState
      );
    });

    expect(setViewport).toHaveBeenCalledWith(viewportState);
  });

  it("does not persist viewport when viewportState is null", () => {
    const { result, setViewport } = setup();

    act(() => {
      result.current.handleMoveEnd(
        new Event("moveend") as unknown as React.MouseEvent,
        null as unknown as { x: number; y: number; zoom: number }
      );
    });

    expect(setViewport).not.toHaveBeenCalled();
  });

  it("does not persist viewport when viewportState is undefined", () => {
    const { result, setViewport } = setup();

    act(() => {
      result.current.handleMoveEnd(
        new Event("moveend") as unknown as React.MouseEvent,
        undefined as unknown as { x: number; y: number; zoom: number }
      );
    });

    expect(setViewport).not.toHaveBeenCalled();
  });
});

describe("useNodeDragHandlers", () => {
  function setup(overrides: { isCollaborating?: boolean } = {}) {
    const { isCollaborating = false } = overrides;
    const screenToFlowPosition = mock(({ x, y }: { x: number; y: number }) => ({
      x,
      y,
    }));
    const updateCursor = mock(() => undefined);
    const finalizeAreaDrag = mock(() => undefined);
    const finalizeBoardDrag = mock(() => undefined);
    const finalizeCommentsDrag = mock(() => undefined);
    const commentClusters = [
      {
        id: "cluster-1",
        centroid: { x: 100, y: 100 },
        comments: [
          { id: "comment-1", x: 90, y: 90 },
          { id: "comment-2", x: 110, y: 110 },
        ],
        isSingle: false,
      },
    ];
    const isDraggingRef = { current: false };
    const pendingPositionsRef = {
      current: new Map<string, { x: number; y: number }>(),
    };

    const { result } = renderHook(() => {
      const {
        useNodeDragHandlers,
      } = require("@/src/components/core/helpers/canvas-handlers");
      return useNodeDragHandlers({
        isCollaborating,
        screenToFlowPosition,
        updateCursor,
        finalizeAreaDrag,
        finalizeBoardDrag,
        finalizeCommentsDrag,
        commentClusters,
        isDraggingRef,
        pendingPositionsRef,
      });
    });

    return {
      result,
      screenToFlowPosition,
      updateCursor,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      isDraggingRef,
      pendingPositionsRef,
    };
  }

  it("updates cursor position during drag when collaborating", () => {
    const { result, screenToFlowPosition, updateCursor } = setup({
      isCollaborating: true,
    });

    const event = { clientX: 150, clientY: 250 } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDrag(event);
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 150, y: 250 });
    expect(updateCursor).toHaveBeenCalledWith({ x: 150, y: 250 });
  });

  it("does not update cursor when not collaborating", () => {
    const { result, updateCursor } = setup({ isCollaborating: false });

    const event = { clientX: 150, clientY: 250 } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDrag(event);
    });

    expect(updateCursor).not.toHaveBeenCalled();
  });

  it("finalizes area drag on stop for area_ prefixed nodes", () => {
    const {
      result,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      isDraggingRef,
      pendingPositionsRef,
    } = setup();

    const node = { id: "area_123" } as CanvasNode;
    const event = {} as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDragStop(event, node);
    });

    expect(finalizeAreaDrag).toHaveBeenCalledWith("area_123");
    expect(finalizeBoardDrag).not.toHaveBeenCalled();
    expect(finalizeCommentsDrag).not.toHaveBeenCalled();
    expect(isDraggingRef.current).toBe(false);
    expect(pendingPositionsRef.current.size).toBe(0);
  });

  it("finalizes board drag on stop for board_ prefixed nodes", () => {
    const {
      result,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      isDraggingRef,
      pendingPositionsRef,
    } = setup();

    const node = { id: "board_456" } as CanvasNode;
    const event = {} as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDragStop(event, node);
    });

    expect(finalizeBoardDrag).toHaveBeenCalledWith("board_456");
    expect(finalizeAreaDrag).not.toHaveBeenCalled();
    expect(finalizeCommentsDrag).not.toHaveBeenCalled();
    expect(isDraggingRef.current).toBe(false);
    expect(pendingPositionsRef.current.size).toBe(0);
  });

  it("finalizes comments drag on stop for cluster- prefixed nodes", () => {
    const {
      result,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      isDraggingRef,
      pendingPositionsRef,
    } = setup();

    const node = { id: "cluster-1" } as CanvasNode;
    const event = {} as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDragStop(event, node);
    });

    expect(finalizeCommentsDrag).toHaveBeenCalledWith([
      "comment-1",
      "comment-2",
    ]);
    expect(finalizeAreaDrag).not.toHaveBeenCalled();
    expect(finalizeBoardDrag).not.toHaveBeenCalled();
    expect(isDraggingRef.current).toBe(false);
    expect(pendingPositionsRef.current.size).toBe(0);
  });

  it("does nothing on drag stop for unrecognized node id prefix", () => {
    const {
      result,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      isDraggingRef,
      pendingPositionsRef,
    } = setup();

    const node = { id: "task_789" } as CanvasNode;
    const event = {} as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDragStop(event, node);
    });

    expect(finalizeAreaDrag).not.toHaveBeenCalled();
    expect(finalizeBoardDrag).not.toHaveBeenCalled();
    expect(finalizeCommentsDrag).not.toHaveBeenCalled();
    expect(isDraggingRef.current).toBe(false);
    expect(pendingPositionsRef.current.size).toBe(0);
  });

  it("does nothing on drag stop for cluster node not found in clusters", () => {
    const { result, finalizeCommentsDrag, isDraggingRef, pendingPositionsRef } =
      setup();

    const node = { id: "cluster-999" } as CanvasNode;
    const event = {} as unknown as React.MouseEvent;

    act(() => {
      result.current.handleNodeDragStop(event, node);
    });

    expect(finalizeCommentsDrag).not.toHaveBeenCalled();
    expect(isDraggingRef.current).toBe(false);
    expect(pendingPositionsRef.current.size).toBe(0);
  });
});
