import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore - already registered */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type React from "react";

// --- Mock external dependencies ---

const mockSetViewport = mock();
const mockFitView = mock();
const mockScreenToFlowPosition = mock().mockReturnValue({ x: 100, y: 200 });
const mockFlowToScreenPosition = mock().mockReturnValue({ x: 50, y: 60 });

mock.module("@xyflow/react", () => ({
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: "dots" },
  MiniMap: () => <div data-testid="minimap" />,
  ReactFlow: ({
    onPaneClick,
    onMoveEnd: _onMoveEnd,
    onNodesChange: _onNodesChange,
    onEdgesChange: _onEdgesChange,
    onConnect: _onConnect,
    onNodeDrag: _onNodeDrag,
    onNodeDragStop: _onNodeDragStop,
    onSelectionStart: _onSelectionStart,
    onSelectionEnd: _onSelectionEnd,
    onEdgeContextMenu: _onEdgeContextMenu,
    nodes,
    edges,
    defaultViewport: _defaultViewport,
    nodeTypes: _nodeTypes,
    edgeTypes: _edgeTypes,
    ..._rest
  }: Record<string, unknown>) => (
    <div
      className="react-flow"
      data-testid="reactflow"
      onClick={onPaneClick as (() => void) | undefined}
    >
      <div data-testid="nodes-count">{(nodes as unknown[])?.length}</div>
      <div data-testid="edges-count">{(edges as unknown[])?.length}</div>
    </div>
  ),
  SelectionMode: { Partial: "partial", Full: "full" },
  useEdgesState: (initial: unknown) => [
    initial,
    mockSetLocalEdges,
    mockOnEdgesChange,
  ],
  useNodesState: (initial: unknown) => [
    initial,
    mockSetLocalNodes,
    mockOnNodesChange,
  ],
  useReactFlow: () => ({
    screenToFlowPosition: mockScreenToFlowPosition,
    flowToScreenPosition: mockFlowToScreenPosition,
    setViewport: mockSetViewport,
    fitView: mockFitView,
  }),
}));

mock.module("@dnd-kit/core", () => ({
  closestCenter: "closestCenter",
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  KeyboardSensor: "keyboard",
  PointerSensor: "pointer",
  useSensor: () => ({}),
  useSensors: () => [],
}));

mock.module("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: () => ({ x: 0, y: 0 }),
}));

const mockUpdateCursor = mock();
const mockUpdateSelection = mock();
const mockUpdateOpenDialogs = mock();

const mockCollabState = {
  isCollaborating: false,
};

const mockCollaborators = [{ id: "user-1", name: "Alice" }];

mock.module("@/src/features/collab", () => ({
  CursorOverlay: () => <div data-testid="cursor-overlay" />,
  useCollaboration: () => ({
    collaborators: mockCollabState.isCollaborating ? mockCollaborators : [],
    updateCursor: mockUpdateCursor,
    isCollaborating: mockCollabState.isCollaborating,
    updateSelection: mockUpdateSelection,
    updateOpenDialogs: mockUpdateOpenDialogs,
  }),
}));

const mockSetLocalNodes = mock();
const mockSetLocalEdges = mock();
const mockOnNodesChange = mock();
const mockOnEdgesChange = mock();

const mockCanvasNodes = [{ id: "node-1", type: "board" }];
const mockCommentClusters: unknown[] = [];
const mockCanvasEdges = [{ id: "edge-1", source: "a", target: "b" }];

mock.module("./helpers/canvas-nodes", () => ({
  useCanvasNodes: () => ({
    nodes: mockCanvasNodes,
    commentClusters: mockCommentClusters,
  }),
}));

mock.module("./helpers/canvas-edges", () => ({
  useCanvasEdges: () => mockCanvasEdges,
}));

mock.module("./helpers/canvas-handlers", () => ({
  useColumnDragHandlers: () => ({
    activeColumnData: null,
    activeColumnDataRef: { current: null },
    handleColumnDragStart: mock(),
    handleColumnDragEnd: mock(),
    updateColumnDragPosition: mock(),
  }),
  useEdgeHandlers: () => ({
    handleEdgesChange: mockOnEdgesChange,
    handleConnect: mock(),
  }),
  useKeyboardHandlers: () => {
    // returns void - no-op in test mock
  },
  useNodeDragHandlers: () => ({
    handleNodeDrag: mock(),
    handleNodeDragStop: mock(),
  }),
  useSelectionHandlers: () => ({
    selectionBox: null,
    isSelectingRef: { current: false },
    selectionStartRef: { current: null },
    setPresenceSelectionBox: mock(),
    handleSelectionStart: mock(),
    handleCloseSelectionMenu: mock(),
    onSelectionEndWrapper: mock(),
  }),
  useViewportHandlers: () => ({
    handleMoveEnd: mock(),
  }),
}));

mock.module("@/src/features/kanban/components/board-node", () => ({
  nodeTypes: { board: () => <div>board</div> },
}));

mock.module("@/src/components/core/board-edge", () => ({
  BoardEdgeComponent: () => <div>edge</div>,
}));

mock.module("@/src/components/custom-controls", () => ({
  CustomControls: () => <div data-testid="custom-controls" />,
}));

mock.module("@/src/components/dialogs/welcome-screen", () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />,
}));

mock.module("@/src/components/edge-context-menu", () => ({
  EdgeContextMenu: () => <div data-testid="edge-context-menu" />,
}));

mock.module("@/src/components/right-controls", () => ({
  RightControls: () => <div data-testid="right-controls" />,
}));

mock.module("@/src/components/tasks/task-drag-overlay-container", () => ({
  TaskDragOverlayContainer: () => (
    <div data-testid="task-drag-overlay-container" />
  ),
}));

mock.module("@/src/features/comments/components/comment-cluster-node", () => ({
  CommentClusterNode: () => <div>comment-cluster</div>,
}));

mock.module("@/src/features/kanban/components/bulk-actions-bar", () => ({
  BulkActionsBar: () => <div data-testid="bulk-actions-bar" />,
}));

mock.module(
  "@/src/features/kanban/components/collaborator-selection-overlay-screen",
  () => ({
    CollaboratorSelectionOverlayScreen: () => (
      <div data-testid="collaborator-selection-overlay" />
    ),
  })
);

mock.module(
  "@/src/features/kanban/components/column-drag-overlay-container",
  () => ({
    ColumnDragOverlayContainer: () => (
      <div data-testid="column-drag-overlay-container" />
    ),
  })
);

mock.module("@/src/features/workspace/components/workspace-selector", () => ({
  WorkspaceSelector: () => <div data-testid="workspace-selector" />,
}));

mock.module("./minimap-node", () => ({
  MiniMapNode: () => <div>minimap-node</div>,
}));

mock.module("./selection-context-menu", () => ({
  SelectionContextMenu: () => <div data-testid="selection-context-menu" />,
}));

mock.module("./task-connection-layer", () => ({
  TaskConnectionLayer: () => <div data-testid="task-connection-layer" />,
}));

mock.module("./helpers/canvas-types", () => ({
  ColumnDragContext: {
    Provider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="column-drag-context">{children}</div>
    ),
  },
  ColumnDragOverlay: () => <div>column-drag-overlay</div>,
}));

mock.module("@/src/features/kanban/store/selectors", () => ({
  useShowWelcomeScreen: () => false,
}));

let mockStoreState: Record<string, unknown> = {};

const mockGetState = mock(() => mockStoreState);

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector(mockStoreState),
    {
      getState: mockGetState,
    }
  ),
}));

// --- Import the component under test ---

import { KanbanCanvas } from "./canvas";

// --- Test helpers ---

const TEST_WINDOW_WIDTH = 1920;
const TEST_WINDOW_HEIGHT = 1080;

function setupStoreState(overrides: Record<string, unknown> = {}) {
  mockStoreState = {
    currentWorkspaceId: "ws-1",
    boards: { byId: {}, allIds: [] },
    boardPositions: { byId: {}, allIds: [] },
    workspaces: { byId: {} },
    showMiniMap: false,
    interactionMode: "select",
    setInteractionMode: mock(),
    clearBoardSelection: mock(),
    canvas: { viewport: { x: 0, y: 0, zoom: 1 }, focusedBoardId: null },
    setViewport: mock(),
    updateBoardPosition: mock(),
    updateBoardDimensions: mock(),
    areas: { byId: {}, allIds: [] },
    areaPositions: { byId: {}, allIds: [] },
    updateAreaPosition: mock(),
    updateAreaDimensions: mock(),
    finalizeAreaDrag: mock(),
    finalizeBoardDrag: mock(),
    attachBoardToArea: mock(),
    detachBoardFromArea: mock(),
    updateModalPosition: mock(),
    updateTaskDetailModalPosition: mock(),
    updateComments: mock(),
    finalizeCommentsDrag: mock(),
    moveColumn: mock(),
    moveColumnToBoard: mock(),
    columns: { byId: {}, allIds: [] },
    addConnection: mock(),
    removeConnection: mock(),
    updateBoardQuickActionsPosition: mock(),
    updateBoardDialogPosition: mock(),
    updateConnectionDialogPosition: mock(),
    updateColumnDialogPosition: mock(),
    updateTaskQuickActionsPosition: mock(),
    updateAreaDialogPosition: mock(),
    setFocusedBoard: mock(),
    ...overrides,
  };
  mockGetState.mockReturnValue(mockStoreState);
}

function renderCanvas() {
  return render(<KanbanCanvas />);
}

// --- Tests ---

describe("KanbanCanvas", () => {
  beforeEach(() => {
    mockSetViewport.mockClear();
    mockFitView.mockClear();
    mockScreenToFlowPosition.mockClear().mockReturnValue({ x: 100, y: 200 });
    mockFlowToScreenPosition.mockClear().mockReturnValue({ x: 50, y: 60 });
    mockUpdateCursor.mockClear();
    mockUpdateSelection.mockClear();
    mockUpdateOpenDialogs.mockClear();
    mockSetLocalNodes.mockClear();
    mockSetLocalEdges.mockClear();
    mockOnNodesChange.mockClear();
    mockOnEdgesChange.mockClear();
    mockCollabState.isCollaborating = false;
    setupStoreState();

    Object.defineProperty(globalThis, "innerWidth", {
      value: TEST_WINDOW_WIDTH,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "innerHeight", {
      value: TEST_WINDOW_HEIGHT,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("handlePaneClick", () => {
    it("clears selection and open dialogs when collaborating", () => {
      mockCollabState.isCollaborating = true;
      renderCanvas();

      const reactFlow = screen.getByTestId("reactflow");
      reactFlow.click();

      expect(mockUpdateSelection).toHaveBeenCalledWith([]);
      expect(mockUpdateOpenDialogs).toHaveBeenCalledWith([]);
    });

    it("does not clear selection or dialogs when not collaborating", () => {
      mockCollabState.isCollaborating = false;
      renderCanvas();

      const reactFlow = screen.getByTestId("reactflow");
      reactFlow.click();

      expect(mockUpdateSelection).not.toHaveBeenCalled();
      expect(mockUpdateOpenDialogs).not.toHaveBeenCalled();
    });
  });

  describe("handleCanvasMouseLeave", () => {
    it("clears cursor when collaborating", () => {
      mockCollabState.isCollaborating = true;
      renderCanvas();

      const container = screen.getByTestId("reactflow").parentElement;
      if (container) {
        container.dispatchEvent(
          new MouseEvent("mouseleave", { bubbles: true })
        );
      }

      expect(mockUpdateCursor).toHaveBeenCalledWith(null);
    });

    it("does not clear cursor when not collaborating", () => {
      mockCollabState.isCollaborating = false;
      renderCanvas();

      const container = screen.getByTestId("reactflow").parentElement;
      if (container) {
        container.dispatchEvent(
          new MouseEvent("mouseleave", { bubbles: true })
        );
      }

      expect(mockUpdateCursor).not.toHaveBeenCalled();
    });
  });

  describe("handleCanvasMouseMove", () => {
    it("updates cursor position when collaborating", () => {
      mockCollabState.isCollaborating = true;
      mockScreenToFlowPosition.mockReturnValue({ x: 300, y: 400 });
      renderCanvas();

      const container = screen.getByTestId("reactflow").parentElement;
      if (container) {
        container.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 300,
            clientY: 400,
          })
        );
      }

      expect(mockScreenToFlowPosition).toHaveBeenCalledWith({
        x: 300,
        y: 400,
      });
      expect(mockUpdateCursor).toHaveBeenCalledWith({ x: 300, y: 400 });
    });

    it("does nothing when not collaborating", () => {
      mockCollabState.isCollaborating = false;
      renderCanvas();

      const container = screen.getByTestId("reactflow").parentElement;
      if (container) {
        container.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 100,
            clientY: 200,
          })
        );
      }

      expect(mockScreenToFlowPosition).not.toHaveBeenCalled();
      expect(mockUpdateCursor).not.toHaveBeenCalled();
    });
  });

  describe("handleNavigateToUser", () => {
    it("renders cursor overlay when collaborating", () => {
      mockCollabState.isCollaborating = true;
      renderCanvas();

      const cursorOverlay = screen.queryByTestId("cursor-overlay");
      expect(cursorOverlay).not.toBeNull();
    });

    it("does not render cursor overlay when not collaborating", () => {
      mockCollabState.isCollaborating = false;
      renderCanvas();

      const cursorOverlay = screen.queryByTestId("cursor-overlay");
      expect(cursorOverlay).toBeNull();
    });
  });

  describe("Workspace change effect", () => {
    it("restores viewport from workspace.lastViewport on workspace switch", async () => {
      const lastViewport = { x: 100, y: 200, zoom: 0.8 };
      setupStoreState({
        currentWorkspaceId: "ws-1",
        workspaces: {
          byId: {
            "ws-1": {},
          },
        },
      });

      const { rerender } = renderCanvas();

      mockSetViewport.mockClear();

      setupStoreState({
        currentWorkspaceId: "ws-2",
        workspaces: {
          byId: {
            "ws-2": { lastViewport },
          },
        },
      });

      rerender(<KanbanCanvas />);

      await waitFor(() => {
        expect(mockSetViewport).toHaveBeenCalledWith(lastViewport, {
          duration: 300,
        });
      });
    });

    it("falls back to lastFocusedBoardId when no lastViewport", async () => {
      const boardPos = { x: 500, y: 300, width: 400, height: 300 };
      setupStoreState({
        currentWorkspaceId: "ws-1",
        workspaces: {
          byId: {
            "ws-1": {},
          },
        },
      });

      const { rerender } = renderCanvas();

      mockSetViewport.mockClear();

      setupStoreState({
        currentWorkspaceId: "ws-2",
        workspaces: {
          byId: {
            "ws-2": { lastFocusedBoardId: "board-1" },
          },
        },
        boardPositions: { byId: { "board-1": boardPos }, allIds: ["board-1"] },
      });

      rerender(<KanbanCanvas />);

      const expectedX =
        -(boardPos.x + (boardPos.width ?? 400) / 2) + TEST_WINDOW_WIDTH / 2;
      const expectedY =
        -(boardPos.y + (boardPos.height ?? 300) / 2) + TEST_WINDOW_HEIGHT / 2;

      await waitFor(() => {
        expect(mockSetViewport).toHaveBeenCalledWith(
          {
            x: expectedX,
            y: expectedY,
            zoom: 1,
          },
          { duration: 300 }
        );
      });
    });

    it("calls fitView when no lastViewport or lastFocusedBoardId", async () => {
      setupStoreState({
        currentWorkspaceId: "ws-1",
        workspaces: {
          byId: {
            "ws-1": {},
          },
        },
      });

      const { rerender } = renderCanvas();

      mockFitView.mockClear();

      setupStoreState({
        currentWorkspaceId: "ws-2",
        workspaces: {
          byId: {
            "ws-2": {},
          },
        },
      });

      rerender(<KanbanCanvas />);

      await waitFor(() => {
        expect(mockFitView).toHaveBeenCalledWith({
          padding: 0.3,
          duration: 300,
        });
      });
    });

    it("does nothing when workspace ID has not changed", () => {
      setupStoreState({
        currentWorkspaceId: "ws-1",
        workspaces: {
          byId: {
            "ws-1": { lastViewport: { x: 0, y: 0, zoom: 1 } },
          },
        },
      });

      renderCanvas();

      expect(mockSetViewport).not.toHaveBeenCalled();
      expect(mockFitView).not.toHaveBeenCalled();
    });
  });

  describe("Focused board effect", () => {
    it("animates viewport to focused board then clears it", async () => {
      const boardPos = { x: 600, y: 400, width: 400, height: 300 };
      setupStoreState({
        canvas: {
          viewport: { x: 0, y: 0, zoom: 1 },
          focusedBoardId: "board-2",
        },
        boardPositions: { byId: { "board-2": boardPos }, allIds: ["board-2"] },
      });

      renderCanvas();

      const expectedX =
        -(boardPos.x + (boardPos.width ?? 400) / 2) + TEST_WINDOW_WIDTH / 2;
      const expectedY =
        -(boardPos.y + (boardPos.height ?? 300) / 2) + TEST_WINDOW_HEIGHT / 2;

      await waitFor(() => {
        expect(mockSetViewport).toHaveBeenCalledWith(
          {
            x: expectedX,
            y: expectedY,
            zoom: 1,
          },
          { duration: 800 }
        );
      });
    });

    it("does nothing when focusedBoardId is null", () => {
      setupStoreState({
        canvas: { viewport: { x: 0, y: 0, zoom: 1 }, focusedBoardId: null },
      });

      renderCanvas();

      expect(mockSetViewport).not.toHaveBeenCalled();
    });
  });

  describe("Wheel event handler", () => {
    it("attaches wheel listener with passive false to react-flow element", () => {
      const addEventListenerSpy = mock();
      const removeEventListenerSpy = mock();

      const originalQuerySelector = document.querySelector.bind(document);
      document.querySelector = mock((selector: string) => {
        if (selector === ".react-flow") {
          return {
            addEventListener: addEventListenerSpy,
            removeEventListener: removeEventListenerSpy,
          } as unknown as Element;
        }
        return originalQuerySelector(selector);
      });

      renderCanvas();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        { passive: false }
      );

      document.querySelector = originalQuerySelector;
    });

    it("prevents default on ctrl key", () => {
      let capturedHandler: ((e: Event) => void) | null = null;

      const originalQuerySelector = document.querySelector.bind(document);
      document.querySelector = mock((selector: string) => {
        if (selector === ".react-flow") {
          return {
            addEventListener: mock(
              (event: string, handler: (e: Event) => void) => {
                if (event === "wheel") {
                  capturedHandler = handler;
                }
              }
            ),
            removeEventListener: mock(),
          } as unknown as Element;
        }
        return originalQuerySelector(selector);
      });

      renderCanvas();

      expect(capturedHandler).not.toBeNull();

      const preventDefaultSpy = mock();
      const wheelEvent = {
        ctrlKey: true,
        metaKey: false,
        preventDefault: preventDefaultSpy,
      } as unknown as WheelEvent;
      capturedHandler!(wheelEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();

      document.querySelector = originalQuerySelector;
    });

    it("prevents default on meta key", () => {
      let capturedHandler: ((e: Event) => void) | null = null;

      const originalQuerySelector = document.querySelector.bind(document);
      document.querySelector = mock((selector: string) => {
        if (selector === ".react-flow") {
          return {
            addEventListener: mock(
              (event: string, handler: (e: Event) => void) => {
                if (event === "wheel") {
                  capturedHandler = handler;
                }
              }
            ),
            removeEventListener: mock(),
          } as unknown as Element;
        }
        return originalQuerySelector(selector);
      });

      renderCanvas();

      expect(capturedHandler).not.toBeNull();

      const preventDefaultSpy = mock();
      const wheelEvent = {
        ctrlKey: false,
        metaKey: true,
        preventDefault: preventDefaultSpy,
      } as unknown as WheelEvent;
      capturedHandler!(wheelEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();

      document.querySelector = originalQuerySelector;
    });

    it("does not prevent default without ctrl or meta key", () => {
      let capturedHandler: ((e: Event) => void) | null = null;

      const originalQuerySelector = document.querySelector.bind(document);
      document.querySelector = mock((selector: string) => {
        if (selector === ".react-flow") {
          return {
            addEventListener: mock(
              (event: string, handler: (e: Event) => void) => {
                if (event === "wheel") {
                  capturedHandler = handler;
                }
              }
            ),
            removeEventListener: mock(),
          } as unknown as Element;
        }
        return originalQuerySelector(selector);
      });

      renderCanvas();

      expect(capturedHandler).not.toBeNull();

      const preventDefaultSpy = mock();
      const wheelEvent = {
        ctrlKey: false,
        metaKey: false,
        preventDefault: preventDefaultSpy,
      } as unknown as WheelEvent;
      capturedHandler!(wheelEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();

      document.querySelector = originalQuerySelector;
    });
  });

  describe("Nodes/edges initial render", () => {
    it("initializes local nodes from store nodes", () => {
      renderCanvas();

      expect(screen.getByTestId("nodes-count").textContent).toBe("1");
    });

    it("initializes local edges from store edges", () => {
      renderCanvas();

      expect(screen.getByTestId("edges-count").textContent).toBe("1");
    });
  });
});
