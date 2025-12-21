"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Background,
  BackgroundVariant,
  type EdgeTypes,
  MarkerType,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnMove,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/shallow";
// biome-ignore lint/suspicious/noTsIgnore: added because of CSS import & VSCode false positive
// @ts-ignore: False positive due to CSS import
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "../../features/kanban/components/board-node";
import { BulkActionsBar } from "../../features/kanban/components/bulk-actions-bar";
import {
  canRedo,
  canUndo,
  redo,
  undo,
  useKanbanStore,
} from "../../features/kanban/store/kanban-store";
import { useShowWelcomeScreen } from "../../features/kanban/store/selectors";
import type { BoardNode } from "../../features/kanban/types";
import { type BoardEdge, BoardEdgeComponent } from "../core/board-edge";
import { CustomControls } from "../custom-controls";
import { WelcomeScreen } from "../dialogs/welcome-screen";
import { EdgeContextMenu } from "../edge-context-menu";
import { RightControls } from "../right-controls";
import { WorkspaceSelector } from "../workspace-selector";
import { MiniMapNode } from "./minimap-node";

type ColumnDragContextType = {
  activeColumnData: {
    columnId: string;
    sourceBoardId: string;
  } | null;
};

export const ColumnDragContext = createContext<ColumnDragContextType>({
  activeColumnData: null,
});

export const useColumnDragContext = () => useContext(ColumnDragContext);

function ColumnDragOverlay({
  columnName,
  taskCount,
}: {
  columnName: string;
  taskCount: number;
}) {
  return (
    <div className="flex cursor-grabbing items-center gap-3 rounded-lg border border-border/60 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
        <svg
          className="h-4 w-4 text-primary"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Column</title>
          <rect height="18" rx="2" ry="2" width="7" x="3" y="3" />
          <rect height="18" rx="2" ry="2" width="7" x="14" y="3" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="font-medium text-foreground text-sm">
          {columnName}
        </span>
        <span className="text-muted-foreground text-xs">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>
    </div>
  );
}

type KanbanNode = Node<BoardNode["data"]>;
type TaskModalNode = Node<{ modalId: string }>;
type EditBoardModalNode = Node<{ modalId: string }>;
type TaskDetailModalNode = Node<{ modalId: string }>;
type BoardQuickActionsNode = Node<{ boardId: string }>;
type TaskQuickActionsNode = Node<{ taskId: string }>;
type ColumnQuickActionsNode = Node<{ columnId: string }>;
type BoardDialogNode = Node<{ dialogId: string }>;
type ConnectionDialogNode = Node<{ boardId: string }>;
type ColumnDialogNode = Node<{ columnId: string }>;
type CanvasNode =
  | KanbanNode
  | TaskModalNode
  | EditBoardModalNode
  | TaskDetailModalNode
  | BoardQuickActionsNode
  | TaskQuickActionsNode
  | ColumnQuickActionsNode
  | BoardDialogNode
  | ConnectionDialogNode
  | ColumnDialogNode;

export function KanbanCanvas() {
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const boards = useKanbanStore((state) => state.boards);
  const boardPositions = useKanbanStore((state) => state.boardPositions);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const interactionMode = useKanbanStore((state) => state.interactionMode);
  const setInteractionMode = useKanbanStore(
    (state) => state.setInteractionMode
  );
  const clearBoardSelection = useKanbanStore(
    (state) => state.clearBoardSelection
  );
  const canvas = useKanbanStore((state) => state.canvas);
  const setViewport = useKanbanStore((state) => state.setViewport);
  const updateBoardPosition = useKanbanStore(
    (state) => state.updateBoardPosition
  );
  const updateBoardDimensions = useKanbanStore(
    (state) => state.updateBoardDimensions
  );
  const updateModalPosition = useKanbanStore(
    (state) => state.updateModalPosition
  );
  const selectedBoardId = useKanbanStore((state) => state.selectedBoardId);
  // Get modal IDs to track which modals exist (shallow compare will work on string[])
  const modalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.createTaskModals))
  );
  // Get the full createTaskModals to access position data in useMemo
  // This won't cause re-renders by itself since we use modalIds for the dependency
  const createTaskModals = useKanbanStore((state) => state.createTaskModals);
  const taskDetailModalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.taskDetailModals))
  );
  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const updateTaskDetailModalPosition = useKanbanStore(
    (state) => state.updateTaskDetailModalPosition
  );
  const moveColumn = useKanbanStore((state) => state.moveColumn);
  const moveColumnToBoard = useKanbanStore((state) => state.moveColumnToBoard);
  const columns = useKanbanStore((state) => state.columns);
  const showWelcomeScreen = useShowWelcomeScreen();
  const boardConnections = useKanbanStore((state) => state.boardConnections);
  const addConnection = useKanbanStore((state) => state.addConnection);
  const removeConnection = useKanbanStore((state) => state.removeConnection);
  const boardQuickActions = useKanbanStore((state) => state.boardQuickActions);
  const boardDialogs = useKanbanStore((state) => state.boardDialogs);
  const boardDialogIds = useKanbanStore(
    useShallow((state) => Object.keys(state.boardDialogs))
  );
  const connectionDialog = useKanbanStore((state) => state.connectionDialog);
  const columnDialog = useKanbanStore((state) => state.columnDialog);
  const updateBoardQuickActionsPosition = useKanbanStore(
    (state) => state.updateBoardQuickActionsPosition
  );
  const updateBoardDialogPosition = useKanbanStore(
    (state) => state.updateBoardDialogPosition
  );
  const updateConnectionDialogPosition = useKanbanStore(
    (state) => state.updateConnectionDialogPosition
  );
  const updateColumnDialogPosition = useKanbanStore(
    (state) => state.updateColumnDialogPosition
  );
  const columnQuickActions = useKanbanStore(
    (state) => state.columnQuickActions
  );
  const updateColumnQuickActionsPosition = useKanbanStore(
    (state) => state.updateColumnQuickActionsPosition
  );
  const taskQuickActions = useKanbanStore((state) => state.taskQuickActions);
  const updateTaskQuickActionsPosition = useKanbanStore(
    (state) => state.updateTaskQuickActionsPosition
  );
  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      default: BoardEdgeComponent,
    }),
    []
  );

  const [activeColumnData, setActiveColumnData] = useState<{
    columnId: string;
    sourceBoardId: string;
    columnName: string;
    taskCount: number;
  } | null>(null);

  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleColumnDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current as
        | { boardId: string; columnId: string; type: string }
        | undefined;
      if (data?.type === "column") {
        const column = columns.byId[data.columnId];
        setActiveColumnData({
          columnId: data.columnId,
          sourceBoardId: data.boardId,
          columnName: column?.name ?? "Column",
          taskCount: column?.task_ids.length ?? 0,
        });
      }
    },
    [columns]
  );

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;

      if (!activeColumnData) {
        setActiveColumnData(null);
        return;
      }

      const { columnId, sourceBoardId } = activeColumnData;

      if (!over) {
        setActiveColumnData(null);
        return;
      }

      const overData = over.data.current as
        | { boardId?: string; columnId?: string; type?: string }
        | undefined;

      let targetBoardId: string | null = null;

      if (overData?.type === "column" && overData.boardId) {
        targetBoardId = overData.boardId;
      } else if (overData?.type === "board-droppable" && overData.boardId) {
        targetBoardId = overData.boardId;
      }

      if (!targetBoardId) {
        setActiveColumnData(null);
        return;
      }

      if (sourceBoardId === targetBoardId) {
        const board = boards.byId[targetBoardId];
        if (board) {
          const columnIds = board.column_ids;
          const oldIndex = columnIds.indexOf(columnId);
          const overId = over.id as string;

          let newIndex = columnIds.indexOf(overId);
          if (newIndex === -1) {
            newIndex = columnIds.length - 1;
          }

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            moveColumn(targetBoardId, columnId, newIndex);
          }
        }
      } else {
        moveColumnToBoard(sourceBoardId, columnId, targetBoardId);
      }

      setActiveColumnData(null);
    },
    [activeColumnData, boards, moveColumn, moveColumnToBoard]
  );

  const { setViewport: setReactFlowViewport, fitView } = useReactFlow();
  const prevWorkspaceIdRef = useRef(currentWorkspaceId);

  useEffect(() => {
    const prevWorkspaceId = prevWorkspaceIdRef.current;
    if (currentWorkspaceId === prevWorkspaceId) {
      return;
    }
    prevWorkspaceIdRef.current = currentWorkspaceId;

    if (!currentWorkspaceId || prevWorkspaceId === null) {
      return;
    }

    const workspace = workspaces.byId[currentWorkspaceId];
    if (!workspace) {
      return;
    }

    // Priority 1: Restore last viewport if available
    if (workspace.lastViewport) {
      setReactFlowViewport(workspace.lastViewport, { duration: 300 });
      return;
    }

    // Priority 2: Center on last focused board
    if (workspace.lastFocusedBoardId) {
      const boardPos = boardPositions.byId[workspace.lastFocusedBoardId];
      if (boardPos) {
        // Center on board with offset for board dimensions
        const centerX = boardPos.x + (boardPos.width ?? 400) / 2;
        const centerY = boardPos.y + (boardPos.height ?? 300) / 2;
        setReactFlowViewport(
          {
            x: -centerX + window.innerWidth / 2,
            y: -centerY + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 300 }
        );
        return;
      }
    }

    // Priority 3: Fit view to show all boards in workspace
    // Use setTimeout to ensure nodes are rendered before fitting
    setTimeout(() => {
      fitView({ padding: 0.3, duration: 300 });
    }, 50);
  }, [
    currentWorkspaceId,
    workspaces,
    boardPositions,
    setReactFlowViewport,
    fitView,
  ]);

  const nodes: CanvasNode[] = useMemo(() => {
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;

    const boardIds = currentWorkspace?.board_ids ?? boards.allIds;

    const boardNodes: KanbanNode[] = boardIds
      .filter((boardId) => {
        const board = boards.byId[boardId];
        const position = boardPositions.byId[boardId];
        return (
          board &&
          position &&
          (!currentWorkspaceId || board.workspace_id === currentWorkspaceId)
        );
      })
      .map((boardId) => {
        const position = boardPositions.byId[boardId];
        if (!position) {
          return null;
        }
        const node: KanbanNode = {
          id: boardId,
          type: "board",
          position: { x: position.x, y: position.y },
          data: {
            boardId,
            isSelected: boardId === selectedBoardId,
          },
          style: { zIndex: position.zIndex },
          width: position.width,
          height: position.height,
        };

        return node;
      })
      .filter((node): node is KanbanNode => node !== null);

    const modalNodes: TaskModalNode[] = modalIds
      .map((id) => {
        const modal = createTaskModals[id];
        if (!modal) {
          return null;
        }
        const node: TaskModalNode = {
          id: `modal-${modal.id}`,
          type: "taskModal",
          position: { x: modal.position.x, y: modal.position.y },
          data: { modalId: modal.id },
          style: { zIndex: 1000 + modal.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is TaskModalNode => node !== null);

    const taskDetailModalNodes: TaskDetailModalNode[] = taskDetailModalIds
      .map((id) => {
        const modal = taskDetailModals[id];
        if (!modal) {
          return null;
        }
        const node: TaskDetailModalNode = {
          id: `task-detail-modal-${modal.id}`,
          type: "taskDetailModal",
          position: { x: modal.position.x, y: modal.position.y },
          data: { modalId: modal.id },
          style: { zIndex: 1000 + modal.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is TaskDetailModalNode => node !== null);

    const quickActionsNodes: BoardQuickActionsNode[] = Object.values(
      boardQuickActions
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `quick-actions-${qa.boardId}`,
        type: "boardQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { boardId: qa.boardId },
        style: { zIndex: 2000 },
        draggable: true,
      }));

    const dialogNodes: BoardDialogNode[] = boardDialogIds
      .map((id) => {
        const dialog = boardDialogs[id];
        if (!dialog) {
          return null;
        }
        const nodeType =
          dialog.type === "rename"
            ? "boardRenameDialog"
            : dialog.type === "duplicate"
              ? "boardDuplicateDialog"
              : dialog.type === "properties"
                ? "boardPropertiesDialog"
                : "boardDeleteDialog";
        const node: BoardDialogNode = {
          id: `board-dialog-${dialog.id}`,
          type: nodeType,
          position: { x: dialog.position.x, y: dialog.position.y },
          data: { dialogId: dialog.id },
          style: { zIndex: 2000 + dialog.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is BoardDialogNode => node !== null);

    const connectionDialogNodes: ConnectionDialogNode[] = [];
    if (connectionDialog) {
      connectionDialogNodes.push({
        id: `connection-dialog-${connectionDialog.boardId}`,
        type: "connectionDialog",
        position: {
          x: connectionDialog.position.x,
          y: connectionDialog.position.y,
        },
        data: { boardId: connectionDialog.boardId },
        style: { zIndex: 2100 },
        draggable: true,
      });
    }

    const columnDialogNodes: ColumnDialogNode[] = [];
    if (columnDialog) {
      if (columnDialog.type === "rename") {
        columnDialogNodes.push({
          id: `column-dialog-${columnDialog.columnId}`,
          type: "columnRenameDialog",
          position: {
            x: columnDialog.position.x,
            y: columnDialog.position.y,
          },
          data: { columnId: columnDialog.columnId },
          style: { zIndex: 2100 },
          draggable: true,
        });
      } else if (columnDialog.type === "delete") {
        columnDialogNodes.push({
          id: `column-dialog-${columnDialog.columnId}`,
          type: "columnDeleteDialog",
          position: {
            x: columnDialog.position.x,
            y: columnDialog.position.y,
          },
          data: { columnId: columnDialog.columnId },
          style: { zIndex: 2100 },
          draggable: true,
        });
      } else if (columnDialog.type === "move") {
        columnDialogNodes.push({
          id: `column-dialog-${columnDialog.columnId}`,
          type: "columnMoveDialog",
          position: {
            x: columnDialog.position.x,
            y: columnDialog.position.y,
          },
          data: { columnId: columnDialog.columnId },
          style: { zIndex: 2100 },
          draggable: true,
        });
      }
    }

    const taskQuickActionsNodes: TaskQuickActionsNode[] = Object.values(
      taskQuickActions
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `task-quick-actions-${qa.taskId}`,
        type: "taskQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { taskId: qa.taskId },
        style: { zIndex: 2000 },
        draggable: true,
      }));

    const columnQuickActionsNodes: ColumnQuickActionsNode[] = Object.values(
      columnQuickActions ?? {}
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `column-quick-actions-${qa.columnId}`,
        type: "columnQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { columnId: qa.columnId },
        style: { zIndex: 2000 },
        draggable: true,
      }));

    return [
      ...boardNodes,
      ...modalNodes,
      ...taskDetailModalNodes,
      ...quickActionsNodes,
      ...taskQuickActionsNodes,
      ...columnQuickActionsNodes,
      ...dialogNodes,
      ...connectionDialogNodes,
      ...columnDialogNodes,
    ];
  }, [
    boards,
    boardPositions,
    currentWorkspaceId,
    workspaces,
    selectedBoardId,
    modalIds,
    createTaskModals,
    taskDetailModalIds,
    taskDetailModals,
    boardQuickActions,
    boardDialogIds,
    boardDialogs,
    connectionDialog,
    columnDialog,
    taskQuickActions,
    columnQuickActions,
  ]);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const isUpdatingFromStore = useRef(false);
  const edges: BoardEdge[] = useMemo(() => {
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;
    const boardIds = currentWorkspace?.board_ids ?? boards.allIds;

    return boardConnections.allIds
      .map((connectionId) => {
        const connection = boardConnections.byId[connectionId];
        if (!connection) {
          return null;
        }

        const isSourceVisible = boardIds.includes(connection.source_board_id);
        const isTargetVisible = boardIds.includes(connection.target_board_id);
        const bothVisible = isSourceVisible && isTargetVisible;
        if (!bothVisible) {
          return null;
        }

        const edge: BoardEdge = {
          id: connectionId,
          source: connection.source_board_id,
          target: connection.target_board_id,
          sourceHandle: connection.sourceHandle,
          targetHandle: `${connection.targetHandle}-target`,
          type: "default",
          data: {
            label: connection.label,
            lineStyle: connection.lineStyle,
          },
          markerEnd: connection.showArrow
            ? {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: "#71717a",
              }
            : undefined,
        };
        return edge;
      })
      .filter((edge): edge is BoardEdge => edge !== null);
  }, [boardConnections, currentWorkspaceId, workspaces, boards.allIds]);

  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);

  const handleToggleMode = useCallback(
    (event: KeyboardEvent) => {
      const isVKey = event.key.toLowerCase() === "v";
      const hasNoModifiers = !(event.metaKey || event.ctrlKey);
      if (!event.repeat && isVKey && hasNoModifiers) {
        event.preventDefault();
        setInteractionMode(interactionMode === "drag" ? "select" : "drag");
      }
    },
    [interactionMode, setInteractionMode]
  );

  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactionMode === "select") {
        event.preventDefault();
        clearBoardSelection();
      }
    },
    [interactionMode, clearBoardSelection]
  );

  const handleDeleteKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedEdges = localEdges.filter((edge) => edge.selected);
        if (selectedEdges.length > 0) {
          event.preventDefault();
          for (const edge of selectedEdges) {
            removeConnection(edge.id);
          }
        }
      }
    },
    [localEdges, removeConnection]
  );

  const handleUndoRedo = useCallback((event: KeyboardEvent) => {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier) {
      return;
    }
    const key = event.key.toLowerCase();
    const isRedo = (key === "z" && event.shiftKey) || key === "y";
    const isUndo = key === "z" && !event.shiftKey;

    if (isUndo && canUndo()) {
      event.preventDefault();
      undo();
    } else if (isRedo && canRedo()) {
      event.preventDefault();
      redo();
    }
  }, []);

  useEffect(() => {
    if (showWelcomeScreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditableElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isEditableElement) {
        handleUndoRedo(event);
        return;
      }

      handleToggleMode(event);
      handleEscapeKey(event);
      handleDeleteKey(event);
      handleUndoRedo(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showWelcomeScreen,
    handleToggleMode,
    handleEscapeKey,
    handleDeleteKey,
    handleUndoRedo,
  ]);

  const focusedBoardId = useKanbanStore((state) => state.canvas.focusedBoardId);
  const setFocusedBoard = useKanbanStore((state) => state.setFocusedBoard);

  useEffect(() => {
    if (!focusedBoardId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const boardPos = boardPositions.byId[focusedBoardId];
      if (boardPos) {
        const centerX = boardPos.x + (boardPos.width ?? 400) / 2;
        const centerY = boardPos.y + (boardPos.height ?? 300) / 2;

        setReactFlowViewport(
          {
            x: -centerX + window.innerWidth / 2,
            y: -centerY + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 800 }
        );
      }

      // Clear the focus after panning so we can re-trigger if needed,
      // though typically this is a one-off event.
      // However, keeping it in store allows for other components to trigger focus.
      // We might want to clear it to avoid re-panning on minor re-renders,
      // but only if we treat it as an impulse.
      // For now, let's leave it, but if it causes issues, we can clear it:
      setFocusedBoard(null);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [focusedBoardId, boardPositions, setReactFlowViewport, setFocusedBoard]);

  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (change.id.startsWith("modal-")) {
            const modalId = change.id.replace("modal-", "");
            updateModalPosition(modalId, change.position);
          } else if (change.id.startsWith("task-detail-modal-")) {
            const modalId = change.id.replace("task-detail-modal-", "");
            updateTaskDetailModalPosition(modalId, change.position);
          } else if (change.id.startsWith("task-quick-actions-")) {
            const taskId = change.id.replace("task-quick-actions-", "");
            updateTaskQuickActionsPosition(taskId, change.position);
          } else if (change.id.startsWith("column-quick-actions-")) {
            const columnId = change.id.replace("column-quick-actions-", "");
            updateColumnQuickActionsPosition(columnId, change.position);
          } else if (change.id.startsWith("quick-actions-")) {
            const boardId = change.id.replace("quick-actions-", "");
            updateBoardQuickActionsPosition(boardId, change.position);
          } else if (change.id.startsWith("board-dialog-")) {
            const dialogId = change.id.replace("board-dialog-", "");
            updateBoardDialogPosition(dialogId, change.position);
          } else if (change.id.startsWith("connection-dialog-")) {
            updateConnectionDialogPosition(change.position);
          } else if (change.id.startsWith("column-dialog-")) {
            updateColumnDialogPosition(change.position);
          } else {
            updateBoardPosition(change.id, change.position);
          }
        }
        if (change.type === "dimensions" && change.dimensions) {
          updateBoardDimensions(change.id, change.dimensions, true);
        }
      }
    },
    [
      onNodesChange,
      updateBoardPosition,
      updateBoardDimensions,
      updateModalPosition,
      updateTaskDetailModalPosition,
      updateBoardQuickActionsPosition,
      updateTaskQuickActionsPosition,
      updateColumnQuickActionsPosition,
      updateBoardDialogPosition,
      updateConnectionDialogPosition,
      updateColumnDialogPosition,
    ]
  );

  const handleMoveEnd: OnMove = useCallback(
    (_event, viewportState) => {
      if (!viewportState) {
        return;
      }
      setViewport(viewportState);
    },
    [setViewport]
  );

  const handleEdgesChange: OnEdgesChange<BoardEdge> = useCallback(
    (changes) => {
      onEdgesChange(changes);

      for (const change of changes) {
        if (change.type === "remove") {
          removeConnection(change.id);
        }
      }
    },
    [onEdgesChange, removeConnection]
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      if (source && target) {
        addConnection(source, target, {
          sourceHandle:
            (sourceHandle as "top" | "right" | "bottom" | "left") ?? undefined,
          targetHandle:
            (targetHandle as "top" | "right" | "bottom" | "left") ?? undefined,
        });
      }
    },
    [addConnection]
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: BoardEdge) => {
      event.preventDefault();
      setEdgeContextMenu({
        edgeId: edge.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  useEffect(() => {
    isUpdatingFromStore.current = true;
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        e.preventDefault();
      }
    };

    const reactFlowCanvas = document.querySelector(".react-flow");
    if (reactFlowCanvas) {
      reactFlowCanvas.addEventListener("wheel", handleWheel, {
        passive: false,
      });
      return () => {
        reactFlowCanvas.removeEventListener("wheel", handleWheel);
      };
    }
  }, []);

  const columnDragContextValue = useMemo(
    () => ({ activeColumnData }),
    [activeColumnData]
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleColumnDragEnd}
      onDragStart={handleColumnDragStart}
      sensors={sensors}
    >
      <ColumnDragContext.Provider value={columnDragContextValue}>
        <div className="h-full w-full">
          <ReactFlow
            className="bg-background"
            defaultViewport={canvas.viewport}
            edges={localEdges}
            edgeTypes={edgeTypes}
            elementsSelectable={
              !showWelcomeScreen && interactionMode === "select"
            }
            fitView={nodes.length === 0}
            maxZoom={3}
            minZoom={0.1}
            nodeOrigin={[0, 0]}
            nodes={localNodes}
            nodesConnectable={
              !showWelcomeScreen && interactionMode === "select"
            }
            nodesDraggable={!showWelcomeScreen && interactionMode === "drag"}
            nodeTypes={nodeTypes}
            onConnect={handleConnect}
            onEdgeContextMenu={handleEdgeContextMenu}
            onEdgesChange={handleEdgesChange}
            onMoveEnd={handleMoveEnd}
            onNodesChange={handleNodesChange}
            panOnDrag={!showWelcomeScreen && interactionMode === "drag"}
            panOnScroll={!showWelcomeScreen && interactionMode === "drag"}
            proOptions={{ hideAttribution: true }}
            selectionKeyCode={interactionMode === "select" ? null : "Meta"}
            selectionMode={
              interactionMode === "select" ? SelectionMode.Partial : undefined
            }
            selectionOnDrag={!showWelcomeScreen && interactionMode === "select"}
            zoomActivationKeyCode={showWelcomeScreen ? null : "Control"}
            zoomOnScroll={!showWelcomeScreen}
          >
            <Background
              className="opacity-30"
              color="currentColor"
              gap={20}
              variant={BackgroundVariant.Dots}
            />
            <CustomControls />
            {showMiniMap && (
              <MiniMap
                className="rounded-lg! border-2! border-border/50! bg-card/95! shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]! backdrop-blur-md! dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]!"
                maskColor="var(--background)"
                nodeColor={(node) => {
                  if (
                    ("isSelected" in node.data && node.data.isSelected) ||
                    node.selected
                  ) {
                    return "var(--primary)";
                  }
                  return "var(--secondary)";
                }}
                nodeComponent={MiniMapNode}
                pannable
                position="top-right"
                zoomable
              />
            )}
          </ReactFlow>
          <WelcomeScreen />
          <WorkspaceSelector />
          <RightControls />
          <BulkActionsBar />
          {edgeContextMenu && (
            <EdgeContextMenu
              edgeId={edgeContextMenu.edgeId}
              onClose={() => setEdgeContextMenu(null)}
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
            />
          )}
        </div>
      </ColumnDragContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeColumnData && (
          <ColumnDragOverlay
            columnName={activeColumnData.columnName}
            taskCount={activeColumnData.taskCount}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
