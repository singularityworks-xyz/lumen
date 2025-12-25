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
import { CursorOverlay, useCollaboration } from "../../features/collab";
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
import { Z_INDEX_BASE } from "../../features/kanban/store/slices/z-index-slice";
import type { BoardNode } from "../../features/kanban/types";
import { type BoardEdge, BoardEdgeComponent } from "../core/board-edge";
import { CustomControls } from "../custom-controls";
import { WelcomeScreen } from "../dialogs/welcome-screen";
import { EdgeContextMenu } from "../edge-context-menu";
import { RightControls } from "../right-controls";
import { WorkspaceSelector } from "../workspace-selector";
import { MiniMapNode } from "./minimap-node";
import { SelectionContextMenu } from "./selection-context-menu";

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
type AreaNode = Node<{ areaId: string }>;
type TaskModalNode = Node<{ modalId: string }>;
type EditBoardModalNode = Node<{ modalId: string }>;
type TaskDetailModalNode = Node<{ modalId: string }>;
type BoardQuickActionsNode = Node<{ boardId: string }>;
type TaskQuickActionsNode = Node<{ taskId: string }>;
type ColumnQuickActionsNode = Node<{ columnId: string }>;
type BoardDialogNode = Node<{ dialogId: string }>;
type ConnectionDialogNode = Node<{ boardId: string }>;
type ColumnDialogNode = Node<{ columnId: string; dialogId: string }>;
type CanvasNode =
  | AreaNode
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
  const areas = useKanbanStore((state) => state.areas);
  const areaPositions = useKanbanStore((state) => state.areaPositions);
  const updateAreaPosition = useKanbanStore(
    (state) => state.updateAreaPosition
  );
  const updateAreaDimensions = useKanbanStore(
    (state) => state.updateAreaDimensions
  );
  const attachBoardToArea = useKanbanStore((state) => state.attachBoardToArea);
  const detachBoardFromArea = useKanbanStore(
    (state) => state.detachBoardFromArea
  );
  const updateModalPosition = useKanbanStore(
    (state) => state.updateModalPosition
  );
  const selectedBoardId = useKanbanStore((state) => state.selectedBoardId);
  const modalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.createTaskModals))
  );
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
  const columnDialogs = useKanbanStore((state) => state.columnDialogs);
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
  const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
  const areaDialog = useKanbanStore((state) => state.areaDialog);
  const updateAreaDialogPosition = useKanbanStore(
    (state) => state.updateAreaDialogPosition
  );
  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      default: BoardEdgeComponent,
    }),
    []
  );

  const { collaborators, updateCursor, isCollaborating } = useCollaboration();
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();

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
    const computeZIndex = (dialogId: string) => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.DIALOGS;
      }
      return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
    };

    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;

    const areaNodes: AreaNode[] = areaPositions.allIds
      .filter((areaId) => {
        const area = areas.byId[areaId];
        const position = areaPositions.byId[areaId];
        return (
          area &&
          position &&
          (!currentWorkspaceId || area.workspace_id === currentWorkspaceId)
        );
      })
      .map((areaId) => {
        const position = areaPositions.byId[areaId];
        if (!position) {
          return null;
        }
        const node: AreaNode = {
          id: areaId,
          type: "area",
          position: { x: position.x, y: position.y },
          data: { areaId },
          style: { zIndex: position.zIndex },
          width: position.width,
          height: position.height,
        };
        return node;
      })
      .filter((node): node is AreaNode => node !== null);

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
          style: { zIndex: computeZIndex(`task-modal-${modal.id}`) },
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
          style: { zIndex: computeZIndex(`task-detail-modal-${modal.id}`) },
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
        style: { zIndex: computeZIndex(`board-quick-actions-${qa.boardId}`) },
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
                : dialog.type === "color-icon-picker"
                  ? "colorIconPickerDialog"
                  : "boardDeleteDialog";

        const dialogZIndexId = `${dialog.type}-board-dialog-${dialog.id}`;
        const computedZIndex = computeZIndex(dialogZIndexId);

        const node: BoardDialogNode = {
          id: `board-dialog-${dialog.id}`,
          type: nodeType,
          position: { x: dialog.position.x, y: dialog.position.y },
          data: {
            dialogId: dialog.id,
            ...(dialog.type === "color-icon-picker"
              ? {
                  columnId: dialog.columnId,
                  sourceDialogId: dialog.sourceDialogId,
                  targetType: dialog.targetType,
                }
              : {}),
          },
          style: { zIndex: computedZIndex },
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
        style: {
          zIndex: computeZIndex(
            `connection-dialog-${connectionDialog.boardId}`
          ),
        },
        draggable: true,
      });
    }

    const columnDialogNodes: ColumnDialogNode[] = [];
    if (columnDialogs) {
      // biome-ignore lint/complexity/noForEach: skip
      Object.values(columnDialogs).forEach((dialog) => {
        if (dialog.type === "rename") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnRenameDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`rename-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        } else if (dialog.type === "delete") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnDeleteDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`delete-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        } else if (dialog.type === "move") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnMoveDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`move-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        }
      });
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
        style: {
          zIndex: computeZIndex(`column-quick-actions-${qa.columnId}`),
        },
        draggable: true,
      }));

    const areaDialogNode = areaDialog
      ? [
          {
            id: "area-properties-dialog",
            type: "areaPropertiesDialog" as const,
            position: areaDialog.position,
            data: { dialogId: "area-properties-dialog" },
            style: { zIndex: 3000 },
            draggable: true,
          },
        ]
      : [];

    return [
      ...areaNodes,
      ...boardNodes,
      ...modalNodes,
      ...taskDetailModalNodes,
      ...quickActionsNodes,
      ...taskQuickActionsNodes,
      ...columnQuickActionsNodes,
      ...dialogNodes,
      ...connectionDialogNodes,
      ...columnDialogNodes,
      ...areaDialogNode,
    ];
  }, [
    areas,
    areaPositions,
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
    columnDialogs,
    taskQuickActions,
    columnQuickActions,
    dialogFocusStack,
    areaDialog,
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
      setFocusedBoard(null);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [focusedBoardId, boardPositions, setReactFlowViewport, setFocusedBoard]);

  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (change.id.startsWith("area_")) {
            updateAreaPosition(change.id, change.position);
          } else if (change.id.startsWith("modal-")) {
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
            const dialogId = change.id.replace("column-dialog-", "");
            updateColumnDialogPosition(dialogId, change.position);
          } else if (change.id === "area-properties-dialog") {
            updateAreaDialogPosition(change.position);
          } else {
            updateBoardPosition(change.id, change.position);
          }
        }
        if (change.type === "dimensions" && change.dimensions) {
          if (change.id.startsWith("area_")) {
            updateAreaDimensions(change.id, change.dimensions);
          } else {
            updateBoardDimensions(change.id, change.dimensions, true);
          }
        }

        if (
          change.type === "position" &&
          change.position &&
          change.id.startsWith("board_")
        ) {
          const boardId = change.id;
          const boardPos = boardPositions.byId[boardId];
          if (!boardPos) {
            return;
          }

          const boardWidth = boardPos.width ?? 300;
          const boardHeight = boardPos.height ?? 200;
          const boardCenterX = change.position.x + boardWidth / 2;
          const boardCenterY = change.position.y + boardHeight / 2;

          let foundAreaId: string | null = null;
          for (const areaId of areaPositions.allIds) {
            const areaPos = areaPositions.byId[areaId];
            if (!areaPos) {
              continue;
            }

            if (
              boardCenterX >= areaPos.x &&
              boardCenterX <= areaPos.x + areaPos.width &&
              boardCenterY >= areaPos.y &&
              boardCenterY <= areaPos.y + areaPos.height
            ) {
              foundAreaId = areaId;
              break;
            }
          }

          if (foundAreaId) {
            attachBoardToArea(foundAreaId, boardId);
          } else {
            for (const areaId of areas.allIds) {
              const area = areas.byId[areaId];
              if (area?.board_ids?.includes(boardId)) {
                detachBoardFromArea(areaId, boardId);
              }
            }
          }
        }
      }
    },
    [
      onNodesChange,
      updateAreaPosition,
      updateAreaDimensions,
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
      areas,
      areaPositions,
      boardPositions,
      attachBoardToArea,
      detachBoardFromArea,
      updateAreaDialogPosition,
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

  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  const handleSelectionEnd = useCallback(
    (_event: React.MouseEvent) => {
      const selectionBox = document.querySelector(
        ".react-flow__selection"
      ) as HTMLElement | null;

      if (!selectionBox) {
        return;
      }

      const rect = selectionBox.getBoundingClientRect();

      if (rect.width < 50 || rect.height < 50) {
        return;
      }

      const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
      const bottomRight = screenToFlowPosition({
        x: rect.right,
        y: rect.bottom,
      });

      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      setSelectionMenu({
        x: topLeft.x,
        y: topLeft.y,
        width,
        height,
        screenX: rect.right + 10,
        screenY: rect.top,
      });
    },
    [screenToFlowPosition]
  );

  const handleCloseSelectionMenu = useCallback(() => {
    setSelectionMenu(null);
  }, []);

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

  // Cursor tracking for collaboration
  // Use flow coordinates so cursor position is absolute on the canvas
  // This ensures cursors appear at the correct canvas position regardless of viewport
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isCollaborating) {
        return;
      }
      // Convert screen position to flow (canvas) coordinates
      // Flow coordinates are absolute on the canvas, independent of zoom/pan
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      updateCursor({ x: flowPos.x, y: flowPos.y });
    },
    [isCollaborating, screenToFlowPosition, updateCursor]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    if (isCollaborating) {
      updateCursor(null);
    }
  }, [isCollaborating, updateCursor]);

  // Track cursor during node dragging (board, dialog, etc.)
  // This fixes the issue where cursor doesn't update when dragging boards by header
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent) => {
      if (!isCollaborating) {
        return;
      }
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      updateCursor({ x: flowPos.x, y: flowPos.y });
    },
    [isCollaborating, screenToFlowPosition, updateCursor]
  );

  // Navigate to a collaborator's cursor position (when clicking edge indicator)
  const handleNavigateToUser = useCallback(
    (position: { x: number; y: number }) => {
      // Center the viewport on the collaborator's cursor position
      setReactFlowViewport(
        {
          x: -position.x + window.innerWidth / 2,
          y: -position.y + window.innerHeight / 2,
          zoom: 1,
        },
        { duration: 500 }
      );
    },
    [setReactFlowViewport]
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleColumnDragEnd}
      onDragStart={handleColumnDragStart}
      sensors={sensors}
    >
      <ColumnDragContext.Provider value={columnDragContextValue}>
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: cursor tracking goes brr */}
        {/** biome-ignore lint/a11y/noStaticElementInteractions: cursor tracking goes brr */}
        <div
          className="h-full w-full"
          onMouseLeave={handleCanvasMouseLeave}
          onMouseMove={handleCanvasMouseMove}
        >
          {/* Layer 1: Fixed Background */}
          <div className="fixed inset-0 -z-10 bg-background" />

          {/* Layer 3: React Flow (Top Layer, Transparent) */}
          <ReactFlow
            className="relative bg-transparent"
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
            onNodeDrag={handleNodeDrag}
            onNodesChange={handleNodesChange}
            onSelectionEnd={handleSelectionEnd}
            panOnDrag={!showWelcomeScreen && interactionMode === "drag"}
            panOnScroll={!showWelcomeScreen && interactionMode === "drag"}
            proOptions={{ hideAttribution: true }}
            selectionKeyCode={interactionMode === "select" ? null : "Meta"}
            selectionMode={
              interactionMode === "select" ? SelectionMode.Partial : undefined
            }
            selectionOnDrag={!showWelcomeScreen && interactionMode === "select"}
            style={{ zIndex: 2000 }}
            zoomActivationKeyCode={showWelcomeScreen ? null : "Control"}
            zoomOnScroll={!showWelcomeScreen}
          >
            <div
              className="pointer-events-none fixed inset-0"
              id="board-connector-layer"
              style={{ zIndex: 0 }}
            />
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
          {/* Collaboration cursor overlay */}

          {isCollaborating && collaborators.length > 0 && (
            <CursorOverlay
              collaborators={collaborators}
              flowToScreenPosition={flowToScreenPosition}
              onNavigateToUser={handleNavigateToUser}
            />
          )}
          {edgeContextMenu && (
            <EdgeContextMenu
              edgeId={edgeContextMenu.edgeId}
              onClose={() => setEdgeContextMenu(null)}
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
            />
          )}
          {selectionMenu && (
            <SelectionContextMenu
              height={selectionMenu.height}
              onClose={handleCloseSelectionMenu}
              screenX={selectionMenu.screenX}
              screenY={selectionMenu.screenY}
              width={selectionMenu.width}
              x={selectionMenu.x}
              y={selectionMenu.y}
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
