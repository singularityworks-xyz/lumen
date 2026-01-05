import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { OnConnect, OnEdgesChange, OnMove } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardEdge } from "@/src/components/core/board-edge";
import {
  canRedo,
  canUndo,
  redo,
  undo,
  useKanbanStore,
} from "@/src/features/kanban/store/kanban-store";
import type { KanbanStore } from "@/src/features/kanban/store/types";
import { useColumnDragPresence } from "@/src/hooks/use-column-drag-presence";
import { useSelectionPresence } from "@/src/hooks/use-selection-presence";
import type { CanvasNode } from "./canvas-types";

type UseColumnDragHandlersProps = {
  columns: KanbanStore["columns"];
  boards: KanbanStore["boards"];
  moveColumn: KanbanStore["moveColumn"];
  moveColumnToBoard: KanbanStore["moveColumnToBoard"];
};

export function useColumnDragHandlers({
  columns,
  boards,
  moveColumn,
  moveColumnToBoard,
}: UseColumnDragHandlersProps) {
  const {
    startDragging: startColumnDrag,
    stopDragging: stopColumnDrag,
    updateDragPosition: updateColumnDragPosition,
  } = useColumnDragPresence();

  const [activeColumnData, setActiveColumnData] = useState<{
    columnId: string;
    sourceBoardId: string;
    columnName: string;
    taskCount: number;
  } | null>(null);

  const activeColumnDataRef = useRef(activeColumnData);

  useEffect(() => {
    activeColumnDataRef.current = activeColumnData;
  }, [activeColumnData]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: safe to omit
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

        const activator = event.activatorEvent;
        const isTouchEvent =
          typeof TouchEvent !== "undefined" && activator instanceof TouchEvent;
        const isMouseEvent =
          typeof MouseEvent !== "undefined" && activator instanceof MouseEvent;
        const isPointerEvent =
          typeof PointerEvent !== "undefined" &&
          activator instanceof PointerEvent;

        if (isMouseEvent || isPointerEvent || isTouchEvent) {
          let clientX = 0;
          let clientY = 0;
          if (
            isTouchEvent &&
            (activator as TouchEvent).touches.length > 0 &&
            (activator as TouchEvent).touches[0]
          ) {
            // @ts-expect-error
            clientX = (activator as TouchEvent).touches[0].clientX;
            // @ts-expect-error
            clientY = (activator as TouchEvent).touches[0].clientY;
          } else if (isMouseEvent || isPointerEvent) {
            clientX = (activator as MouseEvent | PointerEvent).clientX;
            clientY = (activator as MouseEvent | PointerEvent).clientY;
          }
          startColumnDrag(data.columnId, data.boardId, clientX, clientY);
        }
      }
    },
    [columns]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: safe to omit
  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      stopColumnDrag();
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

  return {
    activeColumnData,
    activeColumnDataRef,
    handleColumnDragStart,
    handleColumnDragEnd,
    updateColumnDragPosition,
  };
}

type UseKeyboardHandlersProps = {
  interactionMode: string;
  setInteractionMode: (mode: "drag" | "select") => void;
  clearBoardSelection: () => void;
  localEdges: BoardEdge[];
  removeConnection: (id: string) => void;
  showWelcomeScreen: boolean;
};

export function useKeyboardHandlers({
  interactionMode,
  setInteractionMode,
  clearBoardSelection,
  localEdges,
  removeConnection,
  showWelcomeScreen,
}: UseKeyboardHandlersProps) {
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
}

export function useSelectionHandlers(
  screenToFlowPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  }
) {
  const { setSelectionBox: setPresenceSelectionBox } = useSelectionPresence();
  const selectionBox = useKanbanStore((state) => state.selectionBox);
  const setStoreSelectionBox = useKanbanStore((state) => state.setSelectionBox);
  const clearStoreSelectionBox = useKanbanStore(
    (state) => state.clearSelectionBox
  );

  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleSelectionStart = useCallback(
    (event: React.MouseEvent) => {
      isSelectingRef.current = true;
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      selectionStartRef.current = flowPos;
      clearStoreSelectionBox();
    },
    [screenToFlowPosition, clearStoreSelectionBox]
  );

  const handleCloseSelectionMenu = useCallback(() => {
    clearStoreSelectionBox();
    setPresenceSelectionBox(null);
  }, [clearStoreSelectionBox, setPresenceSelectionBox]);

  const onSelectionEndWrapper = useCallback(
    (event: React.MouseEvent) => {
      const selectionEl = document.querySelector(
        ".react-flow__selection"
      ) as HTMLElement | null;

      if (selectionEl) {
        const rect = selectionEl.getBoundingClientRect();

        // Clear small, accidental selections (less than 10px in either dimension)
        if (rect.width < 10 && rect.height < 10) {
          clearStoreSelectionBox();
          isSelectingRef.current = false;
          selectionStartRef.current = null;
          return;
        }

        const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
        const bottomRight = screenToFlowPosition({
          x: rect.right,
          y: rect.bottom,
        });

        const x = topLeft.x;
        const y = topLeft.y;
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        if (width > 0 && height > 0) {
          setStoreSelectionBox({ x, y, width, height });
        }
      } else if (isSelectingRef.current && selectionStartRef.current) {
        const currentFlowPos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const x = Math.min(selectionStartRef.current.x, currentFlowPos.x);
        const y = Math.min(selectionStartRef.current.y, currentFlowPos.y);
        const width = Math.abs(currentFlowPos.x - selectionStartRef.current.x);
        const height = Math.abs(currentFlowPos.y - selectionStartRef.current.y);

        if (width > 0 && height > 0) {
          setStoreSelectionBox({ x, y, width, height });
        }
      }

      isSelectingRef.current = false;
      selectionStartRef.current = null;
    },
    [screenToFlowPosition, setStoreSelectionBox, clearStoreSelectionBox]
  );

  // Sync persisted selection box to presence
  useEffect(() => {
    if (selectionBox) {
      setPresenceSelectionBox(selectionBox);
    }
  }, [selectionBox, setPresenceSelectionBox]);

  return {
    selectionBox,
    isSelectingRef,
    selectionStartRef,
    setPresenceSelectionBox,
    handleSelectionStart,
    handleCloseSelectionMenu,
    onSelectionEndWrapper,
  };
}

type UseEdgeHandlersProps = {
  onEdgesChange: (changes: Parameters<OnEdgesChange<BoardEdge>>[0]) => void;
  addConnection: KanbanStore["addConnection"];
  removeConnection: KanbanStore["removeConnection"];
};

export function useEdgeHandlers({
  onEdgesChange,
  addConnection,
  removeConnection,
}: UseEdgeHandlersProps) {
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

  return { handleEdgesChange, handleConnect };
}

export function useViewportHandlers(setViewport: KanbanStore["setViewport"]) {
  const handleMoveEnd: OnMove = useCallback(
    (_event, viewportState) => {
      if (!viewportState) {
        return;
      }
      setViewport(viewportState);
    },
    [setViewport]
  );

  return { handleMoveEnd };
}

type CommentCluster = {
  id: string;
  centroid: { x: number; y: number };
  comments: Array<{ id: string; x: number; y: number }>;
  isSingle: boolean;
};

type UseNodeDragHandlersProps = {
  isCollaborating: boolean;
  screenToFlowPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  updateCursor: (pos: { x: number; y: number } | null) => void;
  finalizeAreaDrag: (id: string) => void;
  finalizeBoardDrag: (id: string) => void;
  finalizeCommentsDrag: (ids: string[]) => void;
  commentClusters: CommentCluster[];
};

export function useNodeDragHandlers({
  isCollaborating,
  screenToFlowPosition,
  updateCursor,
  finalizeAreaDrag,
  finalizeBoardDrag,
  finalizeCommentsDrag,
  commentClusters,
}: UseNodeDragHandlersProps) {
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

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: CanvasNode) => {
      if (node.id.startsWith("area_")) {
        finalizeAreaDrag(node.id);
      } else if (node.id.startsWith("board_")) {
        finalizeBoardDrag(node.id);
      } else if (node.id.startsWith("cluster-")) {
        const cluster = commentClusters.find((c) => c.id === node.id);
        if (cluster) {
          finalizeCommentsDrag(cluster.comments.map((c) => c.id));
        }
      }
    },
    [finalizeAreaDrag, finalizeBoardDrag, finalizeCommentsDrag, commentClusters]
  );

  return { handleNodeDrag, handleNodeDragStop };
}
