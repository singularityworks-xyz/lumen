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

interface UseColumnDragHandlersProps {
  boards: KanbanStore["boards"];
  columns: KanbanStore["columns"];
  moveColumn: KanbanStore["moveColumn"];
  moveColumnToBoard: KanbanStore["moveColumnToBoard"];
}

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

interface UseKeyboardHandlersProps {
  clearBoardSelection: () => void;
  interactionMode: string;
  localEdges: BoardEdge[];
  removeConnection: (id: string) => void;
  setInteractionMode: (mode: "drag" | "select") => void;
  showWelcomeScreen: boolean;
}

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

interface UseEdgeHandlersProps {
  addConnection: KanbanStore["addConnection"];
  onEdgesChange: (changes: Parameters<OnEdgesChange<BoardEdge>>[0]) => void;
  removeConnection: KanbanStore["removeConnection"];
}

const TARGET_HANDLE_SUFFIX = /-target$/;
const SOURCE_HANDLE_SUFFIX = /-source$/;

const normalizeHandlePosition = (
  handle: string | null | undefined
): "top" | "right" | "bottom" | "left" | undefined => {
  if (!handle) {
    return;
  }

  const normalized = handle
    .replace(TARGET_HANDLE_SUFFIX, "")
    .replace(SOURCE_HANDLE_SUFFIX, "");

  if (
    normalized === "top" ||
    normalized === "right" ||
    normalized === "bottom" ||
    normalized === "left"
  ) {
    return normalized;
  }

  return;
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
          sourceHandle: normalizeHandlePosition(sourceHandle),
          targetHandle: normalizeHandlePosition(targetHandle),
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

interface CommentCluster {
  centroid: { x: number; y: number };
  comments: Array<{ id: string; x: number; y: number }>;
  id: string;
  isSingle: boolean;
}

const DRAG_ATTACH_PADDING = 20;

interface UseNodeDragHandlersProps {
  commentClusters: CommentCluster[];
  finalizeAreaDrag: (id: string) => void;
  finalizeBoardDrag: (id: string) => void;
  finalizeCommentsDrag: (ids: string[]) => void;
  isCollaborating: boolean;
  isDraggingRef: React.MutableRefObject<boolean>;
  pendingPositionsRef: React.MutableRefObject<
    Map<string, { x: number; y: number }>
  >;
  screenToFlowPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  updateCursor: (pos: { x: number; y: number } | null) => void;
}

export function useNodeDragHandlers({
  isCollaborating,
  screenToFlowPosition,
  updateCursor,
  finalizeAreaDrag,
  finalizeBoardDrag,
  finalizeCommentsDrag,
  commentClusters,
  pendingPositionsRef,
  isDraggingRef,
}: UseNodeDragHandlersProps) {
  const handleNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, [isDraggingRef]);

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
      isDraggingRef.current = false;

      // Flush all accumulated positions to the store in one go
      const pending = new Map(pendingPositionsRef.current);
      pendingPositionsRef.current.clear();

      if (pending.size > 0) {
        const state = useKanbanStore.getState();

        for (const [nid, pos] of pending) {
          if (nid.startsWith("area_")) {
            state.updateAreaPosition(nid, pos);
          } else if (nid.startsWith("modal-")) {
            state.updateModalPosition(nid.replace("modal-", ""), pos);
          } else if (nid.startsWith("task-detail-modal-")) {
            state.updateTaskDetailModalPosition(
              nid.replace("task-detail-modal-", ""),
              pos
            );
          } else if (nid.startsWith("task-quick-actions-")) {
            state.updateTaskQuickActionsPosition(
              nid.replace("task-quick-actions-", ""),
              pos
            );
          } else if (nid.startsWith("column-quick-actions-")) {
            state.updateColumnQuickActionsPosition(
              nid.replace("column-quick-actions-", ""),
              pos
            );
          } else if (nid.startsWith("quick-actions-")) {
            state.updateBoardQuickActionsPosition(
              nid.replace("quick-actions-", ""),
              pos
            );
          } else if (nid.startsWith("board-dialog-")) {
            state.updateBoardDialogPosition(
              nid.replace("board-dialog-", ""),
              pos
            );
          } else if (nid.startsWith("connection-dialog-")) {
            state.updateConnectionDialogPosition(pos);
          } else if (nid.startsWith("column-dialog-")) {
            state.updateColumnDialogPosition(
              nid.replace("column-dialog-", ""),
              pos
            );
          } else if (nid.startsWith("area-dialog-")) {
            state.updateAreaDialogPosition(
              nid.replace("area-dialog-", ""),
              pos
            );
          } else if (nid.startsWith("cluster-")) {
            // Comment clusters handled separately
          } else {
            // Board nodes: compute absolute position if inside area
            let absPos = pos;
            for (const areaId of state.areas.allIds) {
              const area = state.areas.byId[areaId];
              if (area?.board_ids?.includes(nid)) {
                const areaPos = state.areaPositions.byId[areaId];
                if (areaPos) {
                  absPos = {
                    x: areaPos.x + pos.x,
                    y: areaPos.y + pos.y,
                  };
                }
                break;
              }
            }
            state.updateBoardPosition(nid, absPos);

            // Area attach/detach logic for boards
            if (nid.startsWith("board_")) {
              const boardPos = state.boardPositions.byId[nid];
              if (boardPos) {
                const bw = boardPos.width ?? 300;
                const bh = boardPos.height ?? 200;
                const bcx = absPos.x + bw / 2;
                const bcy = absPos.y + bh / 2;

                let foundAreaId: string | null = null;
                let closestDistance = Number.POSITIVE_INFINITY;
                for (const areaId of state.areaPositions.allIds) {
                  const ap = state.areaPositions.byId[areaId];
                  if (
                    ap &&
                    bcx >= ap.x - DRAG_ATTACH_PADDING &&
                    bcx <= ap.x + ap.width + DRAG_ATTACH_PADDING &&
                    bcy >= ap.y - DRAG_ATTACH_PADDING &&
                    bcy <= ap.y + ap.height + DRAG_ATTACH_PADDING
                  ) {
                    const areaCenterX = ap.x + ap.width / 2;
                    const areaCenterY = ap.y + ap.height / 2;
                    const distanceToAreaCenter = Math.hypot(
                      bcx - areaCenterX,
                      bcy - areaCenterY
                    );
                    if (distanceToAreaCenter < closestDistance) {
                      closestDistance = distanceToAreaCenter;
                      foundAreaId = areaId;
                    }
                  }
                }
                if (foundAreaId) {
                  state.attachBoardToArea(foundAreaId, nid);
                } else {
                  for (const areaId of state.areas.allIds) {
                    if (state.areas.byId[areaId]?.board_ids?.includes(nid)) {
                      state.detachBoardFromArea(areaId, nid);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Call finalize methods for specific node types
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
    [
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      commentClusters,
      pendingPositionsRef,
      isDraggingRef,
    ]
  );

  return { handleNodeDragStart, handleNodeDrag, handleNodeDragStop };
}
