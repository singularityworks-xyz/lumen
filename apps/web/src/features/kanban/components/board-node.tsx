"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  NodeResizer as Resizer,
  useReactFlow,
} from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { GripVerticalIcon } from "@/src/components/animated/icons/grip-vertical";
import { PlusIcon } from "@/src/components/animated/icons/plus";
import { SquarePenIcon } from "@/src/components/animated/icons/square-pen";
import { XIcon } from "@/src/components/animated/icons/x";
import { ColumnCreateDialog } from "@/src/components/dialogs/column/column-create-dialog";
import { Button } from "@/src/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { useCollaboration } from "@/src/features/collab";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../store/kanban-store";
import type {
  BoardNode,
  DenormalizedBoard,
  DenormalizedColumn,
  Task,
} from "../types";
import {
  calculateBoardWidth,
  calculateContentDimensions,
  calculateMaxDimensions,
  calculateMinDimensions,
  shouldApplyResize,
} from "../utils/board-resize-rules";
import { ICON_MAP } from "../utils/color-icon-utils";
import { BoardPresenceIndicator } from "./board-presence-indicator";
import { KanbanBoard } from "./kanban-board";
import styles from "./styles/board-node.module.css";

type BoardNodeProps = NodeProps<Node<BoardNode["data"]>>;

export const BoardNodeComponent = memo<BoardNodeProps>(
  ({ id, data, selected, isConnectable }) => {
    const setSelectedBoard = useKanbanStore((state) => state.setSelectedBoard);
    const bringBoardToFront = useKanbanStore(
      (state) => state.bringBoardToFront
    );

    const interactionMode = useKanbanStore((state) => state.interactionMode);
    const selectedBoardIds = useKanbanStore((state) => state.selectedBoardIds);
    const toggleBoardSelection = useKanbanStore(
      (state) => state.toggleBoardSelection
    );

    const openTaskDetailModal = useKanbanStore(
      (state) => state.openTaskDetailModal
    );

    // Module-level cache for board denormalization to preserve stable references
    // and prevent re-renders when unrelated store data changes.
    const boardCacheRef = useRef<{
      sig: string;
      board: DenormalizedBoard | null;
    } | null>(null);

    const board = useKanbanStore((state): DenormalizedBoard | null => {
      const boardData = state.boards.byId[data.boardId];
      if (!boardData) {
        boardCacheRef.current = null;
        return null;
      }

      // Build a lightweight content signature for fast comparison
      const colSigs = boardData.column_ids
        .map((colId) => {
          const col = state.columns.byId[colId];
          if (!col) {
            return "";
          }
          const taskSigs = col.task_ids
            .map((tid) => {
              const t = state.tasks.byId[tid];
              return t
                ? `${t.id}:${t.title}:${t.status}:${t.position}:${t.priority}:${t.progress}:${t.due_date ?? ""}:${t.tags?.length ?? 0}`
                : "";
            })
            .join(",");
          return `${col.id}:${col.name}:${col.position}:${col.accentColor ?? ""}:${col.icon ?? ""}:${col.progressValue ?? ""}:${taskSigs}`;
        })
        .join("|");

      const sig = `${boardData.name}|${boardData.description ?? ""}|${boardData.accentColor ?? ""}|${boardData.icon ?? ""}|${colSigs}`;

      const cached = boardCacheRef.current;
      if (cached && cached.sig === sig) {
        return cached.board;
      }

      const denormalizedColumns: DenormalizedColumn[] = boardData.column_ids
        .map((colId) => {
          const column = state.columns.byId[colId];
          if (!column) {
            return null;
          }

          const columnTasks = column.task_ids
            .map((taskId) => state.tasks.byId[taskId])
            .filter((task): task is Task => task !== undefined)
            .sort((a, b) => a.position - b.position);

          return {
            id: column.id,
            board_id: column.board_id,
            name: column.name,
            description: column.description,
            position: column.position,
            tasks: columnTasks,
            progressValue: column.progressValue,
            accentColor: column.accentColor,
            icon: column.icon,
          } as DenormalizedColumn;
        })
        .filter((col): col is DenormalizedColumn => col !== null)
        .sort((a, b) => a.position - b.position);

      const denormalizedBoard: DenormalizedBoard = {
        id: boardData.id,
        name: boardData.name,
        description: boardData.description,
        workspace_id: boardData.workspace_id,
        created_by: boardData.created_by,
        created_at: boardData.created_at,
        columns: denormalizedColumns,
        accentColor: boardData.accentColor,
        icon: boardData.icon,
      };

      boardCacheRef.current = { sig, board: denormalizedBoard };
      return denormalizedBoard;
    });

    const taskCounts = useMemo(() => {
      if (!board) {
        return { done: 0, total: 0 };
      }
      let done = 0;
      let total = 0;
      for (const col of board.columns) {
        for (const task of col.tasks) {
          if (task.status === "todo") {
            total += 1;
          } else if (task.status === "done") {
            done += 1;
            total += 1;
          }
        }
      }
      return { done, total };
    }, [board]);

    const { setCenter, screenToFlowPosition, getViewport, setViewport } =
      useReactFlow();

    const { boardId, isSelected } = data as BoardNode["data"];

    const triggerTaskDetailModalShake = useKanbanStore(
      (state) => state.triggerTaskDetailModalShake
    );

    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const addColumn = useKanbanStore((state) => state.addColumn);
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const openBoardQuickActions = useKanbanStore(
      (state) => state.openBoardQuickActions
    );
    const openBoardDialog = useKanbanStore((state) => state.openBoardDialog);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
    const [createColumnPos, setCreateColumnPos] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const addColumnButtonRef = useRef<HTMLButtonElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    const handleAddColumn = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!board) {
          return;
        }
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const DIALOG_WIDTH = 320;
        const DIALOG_HEIGHT = 200;
        setCreateColumnPos({
          x: (viewportWidth - DIALOG_WIDTH) / 2,
          y: (viewportHeight - DIALOG_HEIGHT) / 2,
        });
        setIsCreateColumnOpen(true);
      },
      [board]
    );

    const handleCloseCreateColumn = useCallback(() => {
      setIsCreateColumnOpen(false);
      setCreateColumnPos(null);
    }, []);

    const handleSubmitCreateColumn = useCallback(
      (columnName: string) => {
        const columnCount = board?.columns.length ?? 0;
        addColumn(boardId, columnName, columnCount);
      },
      [addColumn, boardId, board?.columns.length]
    );

    const VIEWPORT_PADDING = 100;
    const ensureDialogVisible = useCallback(
      (
        dialogX: number,
        dialogY: number,
        dialogWidth: number,
        dialogHeight: number
      ) => {
        const viewport = getViewport();
        const { x: vpX, y: vpY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const dialogScreenX = dialogX * zoom + vpX;
        const dialogScreenY = dialogY * zoom + vpY;
        const dialogScreenRight = (dialogX + dialogWidth) * zoom + vpX;
        const dialogScreenBottom = (dialogY + dialogHeight) * zoom + vpY;

        let newVpX = vpX;
        let newVpY = vpY;
        let needsPan = false;

        if (dialogScreenX < VIEWPORT_PADDING) {
          newVpX = vpX + (VIEWPORT_PADDING - dialogScreenX);
          needsPan = true;
        } else if (dialogScreenRight > screenWidth - VIEWPORT_PADDING) {
          newVpX = vpX - (dialogScreenRight - (screenWidth - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (dialogScreenY < VIEWPORT_PADDING) {
          newVpY = vpY + (VIEWPORT_PADDING - dialogScreenY);
          needsPan = true;
        } else if (dialogScreenBottom > screenHeight - VIEWPORT_PADDING) {
          newVpY =
            vpY - (dialogScreenBottom - (screenHeight - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (needsPan) {
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 0 });
        }
      },
      [getViewport, setViewport]
    );

    const handleOpenTaskDetail = useCallback(
      (taskId: string, _screenX: number, _screenY: number) => {
        const result = openTaskDetailModal({ taskId, boardId });
        if (result.isExisting) {
          // Existing modal — bring to front, shake, and keep it in viewport.
          setTimeout(
            () =>
              ensureDialogVisible(
                result.position.x,
                result.position.y,
                450,
                500
              ),
            50
          );

          setTimeout(() => {
            triggerTaskDetailModalShake(result.id);
          }, 300);
        } else {
          // New modal (including reopen with remembered position):
          // always call ensureDialogVisible so viewport stays consistent.
          setTimeout(
            () =>
              ensureDialogVisible(
                result.position.x,
                result.position.y,
                450,
                500
              ),
            50
          );
        }
      },
      [
        openTaskDetailModal,
        boardId,
        triggerTaskDetailModalShake,
        ensureDialogVisible,
      ]
    );

    const isMultiSelected = selectedBoardIds.includes(id);
    const [isResizing, setIsResizing] = useState(false);

    // Only subscribe to dimension-related fields, NOT x/y position.
    // This prevents re-renders during drag (position is handled by React Flow).
    // useShallow ensures stable references when values haven't changed.
    const boardDimensions = useKanbanStore(
      useShallow((state) => {
        const bp = state.boardPositions.byId[boardId];
        if (!bp) {
          return null;
        }
        return {
          width: bp.width,
          height: bp.height,
          userResized: bp.userResized,
          lastUserWidth: bp.lastUserWidth,
          lastUserHeight: bp.lastUserHeight,
        };
      })
    );

    // Get collaboration context for cursor tracking during resize
    const { isCollaborating, updateCursor, updateSelection, collaborators } =
      useCollaboration();

    // Track cursor position during resize operations
    // NodeResizer uses pointer capture, so we need to listen at the window level
    // with the capture phase to get events even during pointer capture
    useEffect(() => {
      if (!(isResizing && isCollaborating)) {
        return;
      }

      const handlePointerMove = (event: PointerEvent) => {
        const flowPos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        updateCursor({ x: flowPos.x, y: flowPos.y });
      };

      // Use capture phase to get events even when element has pointer capture
      window.addEventListener("pointermove", handlePointerMove, true);

      return () => {
        window.removeEventListener("pointermove", handlePointerMove, true);
      };
    }, [isResizing, isCollaborating, screenToFlowPosition, updateCursor]);

    const activeCollaborator = useMemo(
      () => collaborators.find((c) => c.selection?.includes(id)),
      [collaborators, id]
    );

    const boardColumns = board?.columns ?? [];
    const exactBoardWidth = useMemo(
      () => calculateBoardWidth(boardColumns.length),
      [boardColumns.length]
    );

    const { minDimensions, maxDimensions, contentDimensions } = useMemo(
      () => ({
        minDimensions: calculateMinDimensions(boardColumns.length),
        maxDimensions: calculateMaxDimensions(boardColumns),
        contentDimensions: calculateContentDimensions(boardColumns),
      }),
      [boardColumns]
    );

    const updateBoardDimensions = useKanbanStore(
      (state) => state.updateBoardDimensions
    );

    useEffect(() => {
      if (isResizing) {
        return;
      }

      // Use dimensions from synced store state, not React Flow node
      // This ensures consistent sizing across synced browsers
      const currentWidth = boardDimensions?.width || exactBoardWidth;
      const currentHeight = boardDimensions?.height || minDimensions.height;
      const userResized = boardDimensions?.userResized ?? false;

      const { shouldResize, newDimensions } = shouldApplyResize(
        { width: currentWidth, height: currentHeight },
        contentDimensions,
        userResized,
        {
          width: boardDimensions?.lastUserWidth,
          height: boardDimensions?.lastUserHeight,
        }
      );

      if (shouldResize) {
        const finalWidth = exactBoardWidth;
        const finalHeight = Math.min(
          newDimensions.height,
          maxDimensions.height
        );

        // Update through the store so dimensions sync via Yjs to other browsers
        // Don't mark as user resize - this is auto-resize based on content
        updateBoardDimensions(
          boardId,
          { width: finalWidth, height: finalHeight },
          false
        );
      }
    }, [
      boardId,
      isResizing,
      contentDimensions,
      minDimensions,
      maxDimensions,
      exactBoardWidth,
      boardDimensions?.width,
      boardDimensions?.height,
      boardDimensions?.userResized,
      boardDimensions?.lastUserWidth,
      boardDimensions?.lastUserHeight,
      updateBoardDimensions,
    ]);

    const handleRemove = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (taskCounts.total >= 1) {
          setShowDeleteConfirm(true);
        } else {
          removeBoard(id);
        }
      },
      [id, removeBoard, taskCounts.total]
    );

    const handleConfirmDelete = useCallback(() => {
      setShowDeleteConfirm(false);
      removeBoard(id);
    }, [id, removeBoard]);

    const handleClick = (e: {
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey?: boolean;
      stopPropagation: () => void;
    }) => {
      bringBoardToFront(id);

      if (interactionMode === "select") {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey) {
          toggleBoardSelection(id);
        } else {
          useKanbanStore.getState().clearBoardSelection();
          toggleBoardSelection(id);
        }
      } else {
        setSelectedBoard(id);
        if (isCollaborating) {
          updateSelection([id]);
        }
      }
    };

    const handleAddTask = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!board) {
        return;
      }

      const firstColumn = board.columns?.[0];
      if (!firstColumn) {
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const headerRect = headerRef.current?.getBoundingClientRect();
      const baseRight = headerRect?.right ?? rect.right;
      const quickActionsPos = screenToFlowPosition({
        x: baseRight + 40,
        y: rect.top - 30,
      });
      openBoardQuickActions(boardId, quickActionsPos);

      setTimeout(
        () =>
          ensureDialogVisible(quickActionsPos.x, quickActionsPos.y, 220, 280),
        50
      );

      const QUICK_ACTIONS_WIDTH = 220;
      const dialogPosition = {
        x: quickActionsPos.x + QUICK_ACTIONS_WIDTH + 40,
        y: quickActionsPos.y,
      };

      const result = openCreateTaskModal({
        columnId: firstColumn.id,
        boardId,
        position: dialogPosition,
        sourceRect: rect,
        sourceType: "board-menu",
      });

      if (result.isExisting) {
        setCenter(result.position.x + 200, result.position.y + 150, {
          duration: 500,
          zoom: 1,
        });
      } else {
        setTimeout(
          () =>
            ensureDialogVisible(dialogPosition.x, dialogPosition.y, 400, 300),
          100
        );
      }
    };

    const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
    };

    const handleMouseEnter = () => {
      document.body.style.overflow = "hidden";
    };

    const handleMouseLeave = () => {
      document.body.style.overflow = "";
    };

    const handleOpenEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!board) {
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const headerRect = headerRef.current?.getBoundingClientRect();
      const baseRight = headerRect?.right ?? rect.right;
      const quickActionsPos = screenToFlowPosition({
        x: baseRight + 40,
        y: rect.top - 30,
      });
      openBoardQuickActions(boardId, quickActionsPos);

      setTimeout(
        () =>
          ensureDialogVisible(quickActionsPos.x, quickActionsPos.y, 220, 280),
        50
      );

      const QUICK_ACTIONS_WIDTH = 220;
      const dialogPosition = {
        x: quickActionsPos.x + QUICK_ACTIONS_WIDTH + 40,
        y: quickActionsPos.y,
      };

      openBoardDialog({
        type: "rename",
        boardId,
        boardName: board.name,
        boardDescription: board.description,
        inputValue: board.name,
        descriptionValue: board.description,
        position: dialogPosition,
      });

      setTimeout(
        () => ensureDialogVisible(dialogPosition.x, dialogPosition.y, 320, 280),
        100
      );
    };

    if (!board) {
      return null;
    }

    return (
      <>
        <Resizer
          handleClassName="!w-8 !h-8 !opacity-0"
          isVisible={selected || isSelected || isMultiSelected}
          lineClassName="!border-0"
          lineStyle={{
            borderWidth: 0,
            opacity: 0,
          }}
          maxHeight={maxDimensions.height}
          maxWidth={exactBoardWidth}
          minHeight={minDimensions.height}
          minWidth={exactBoardWidth}
          onResizeEnd={() => setIsResizing(false)}
          onResizeStart={() => setIsResizing(true)}
        />

        {isResizing && (
          <div
            className="pointer-events-none absolute top-0 left-0 z-0 flex items-center justify-center rounded border-2 border-primary/50 border-dashed bg-primary/10 transition-all"
            style={{
              width: exactBoardWidth,
              height: contentDimensions.height,
            }}
          >
            <div className="flex flex-col items-center gap-1 rounded-lg bg-primary/90 px-4 py-2 text-primary-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
              <span className="font-medium text-xs">Drag height to resize</span>
              <span className="text-[10px] opacity-80">
                Height: {Math.round(contentDimensions.height)}px
              </span>
            </div>
          </div>
        )}

        {activeCollaborator && (
          <BoardPresenceIndicator activeCollaborator={activeCollaborator} />
        )}

        {(selected || isSelected || isMultiSelected) && (
          <div className="pointer-events-none absolute right-0 bottom-0 z-10">
            <div className="relative h-8 w-8">
              <div
                className="absolute right-0 bottom-0 h-3 w-3 animate-pulse rounded-full bg-primary/30"
                style={
                  board.accentColor
                    ? { backgroundColor: `${board.accentColor}4D` }
                    : {}
                }
              />

              <div
                className="absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-tl-lg bg-primary/90 shadow-lg transition-all hover:scale-110"
                style={
                  board.accentColor
                    ? { backgroundColor: board.accentColor }
                    : {}
                }
              >
                <svg
                  className="h-3 w-3 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <title>Resize height</title>
                  <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/** biome-ignore lint/a11y/useSemanticElements: skip */}
        <div
          aria-pressed={isSelected || selected || isMultiSelected}
          className={`group/board relative h-full w-full rounded bg-card transition-all ${
            isMultiSelected
              ? "border-2 border-gray-500 shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] ring-2 ring-gray-500/20 dark:shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
              : isSelected || selected
                ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
                : "border-2 border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          }
        `}
          data-selected={isSelected || selected ? "true" : "false"}
          data-testid="board-node"
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleClick({
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                stopPropagation: () => e.stopPropagation(),
              });
            }
          }}
          role="button"
          style={{
            borderColor:
              (isSelected || selected) && board?.accentColor
                ? board.accentColor
                : undefined,
          }}
          tabIndex={0}
        >
          {/* Target Connection Handles */}
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-top-target"
            id="top-target"
            isConnectable={isConnectable}
            position={Position.Top}
            type="target"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-right-target"
            id="right-target"
            isConnectable={isConnectable}
            position={Position.Right}
            type="target"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-bottom-target"
            id="bottom-target"
            isConnectable={isConnectable}
            position={Position.Bottom}
            type="target"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-left-target"
            id="left-target"
            isConnectable={isConnectable}
            position={Position.Left}
            type="target"
          />

          {/* Source Connection Handles */}
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-top"
            id="top"
            isConnectable={isConnectable}
            position={Position.Top}
            type="source"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-right"
            id="right"
            isConnectable={isConnectable}
            position={Position.Right}
            type="source"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-bottom"
            id="bottom"
            isConnectable={isConnectable}
            position={Position.Bottom}
            type="source"
          />
          <Handle
            className="!pointer-events-none !border-0 !bg-transparent !opacity-0"
            data-testid="board-handle-left"
            id="left"
            isConnectable={isConnectable}
            position={Position.Left}
            type="source"
          />
          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: it's a draggable handle */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: it's a draggable handle */}
          <div
            className="group board-drag-handle flex w-full cursor-move items-center justify-between gap-1.5 rounded-t border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-colors hover:bg-muted dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)] dark:hover:bg-secondary"
            data-testid="board-header"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!board) {
                return;
              }
              const headerRect = headerRef.current?.getBoundingClientRect();
              const screenX = headerRect ? headerRect.right + 20 : e.clientX;
              const screenY = headerRect ? headerRect.top : e.clientY;
              const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
              openBoardQuickActions(boardId, flowPos);

              setTimeout(
                () => ensureDialogVisible(flowPos.x, flowPos.y, 220, 280),
                50
              );

              // Also open rename dialog alongside quick-actions so that
              // workspace switch-and-back restores the dialog context.
              const QUICK_ACTIONS_WIDTH = 220;
              const renamePos = {
                x: flowPos.x + QUICK_ACTIONS_WIDTH + 40,
                y: flowPos.y,
              };
              openBoardDialog({
                type: "rename",
                boardId,
                boardName: board.name,
                boardDescription: board.description,
                inputValue: board.name,
                descriptionValue: board.description,
                position: renamePos,
              });
              setTimeout(
                () => ensureDialogVisible(renamePos.x, renamePos.y, 320, 280),
                100
              );
            }}
            ref={headerRef}
            style={
              board.accentColor
                ? {
                    background: `linear-gradient(to right, ${board.accentColor}15, ${board.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripVerticalIcon
                className="shrink-0 text-muted-foreground"
                size={14}
              />
              <div className="flex min-w-0 items-center gap-1">
                {board.icon && (
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground"
                    style={
                      board.accentColor
                        ? {
                            backgroundColor: `${board.accentColor}25`,
                            color: board.accentColor,
                          }
                        : { backgroundColor: "rgba(128,128,128,0.2)" }
                    }
                  >
                    {(() => {
                      const Icon = ICON_MAP[board.icon];
                      return Icon ? <Icon className="h-3 w-3" /> : null;
                    })()}
                  </span>
                )}
                <h3 className="truncate font-semibold text-foreground text-xs">
                  {board.name}
                </h3>
                {taskCounts.total > 0 && (
                  <span
                    className={cn(
                      "relative flex h-5 items-center gap-1 overflow-hidden rounded-full pr-2 pl-1.5 font-medium text-[10px] tabular-nums shadow-[inset_0_1px_3px_rgba(0,0,0,0.15),inset_0_-1px_2px_rgba(255,255,255,0.1)] transition-all dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_-1px_2px_rgba(255,255,255,0.08)]",
                      taskCounts.done === taskCounts.total
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : board.accentColor
                          ? ""
                          : "bg-muted/80 text-muted-foreground"
                    )}
                    style={
                      taskCounts.done !== taskCounts.total && board.accentColor
                        ? {
                            backgroundColor: `${board.accentColor}15`,
                            color: board.accentColor,
                          }
                        : {}
                    }
                    title={`${taskCounts.done} done / ${taskCounts.total} total tasks`}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all",
                        taskCounts.done === taskCounts.total
                          ? "bg-emerald-500/20"
                          : board.accentColor
                            ? ""
                            : "bg-primary/10"
                      )}
                      style={{
                        width: `${(taskCounts.done / taskCounts.total) * 100}%`,
                        ...(taskCounts.done !== taskCounts.total &&
                        board.accentColor
                          ? { backgroundColor: `${board.accentColor}20` }
                          : {}),
                      }}
                    />
                    <span className="relative flex items-center gap-1">
                      {taskCounts.done === taskCounts.total ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <span
                          className={cn(
                            "flex h-3 w-3 items-center justify-center rounded-full text-[8px]",
                            taskCounts.done === taskCounts.total
                              ? "bg-emerald-500/30"
                              : board.accentColor
                                ? ""
                                : "bg-primary/20"
                          )}
                          style={
                            taskCounts.done !== taskCounts.total &&
                            board.accentColor
                              ? { backgroundColor: `${board.accentColor}30` }
                              : {}
                          }
                        >
                          ✓
                        </span>
                      )}
                      <span className="font-semibold">{taskCounts.done}</span>
                      <span className="opacity-50">/</span>
                      <span>{taskCounts.total}</span>
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="nodrag flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all hover:bg-accent group-hover:opacity-100"
                  onClick={handleOpenEdit}
                  title="Edit board"
                  type="button"
                >
                  <SquarePenIcon className="text-muted-foreground" size={10} />
                </button>
              </div>
            </div>
            {board.description && (
              <p className="mr-2 hidden truncate text-[10px] text-muted-foreground md:block">
                {board.description}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                className="nodrag h-6 gap-1 rounded-full bg-primary/90 px-2.5 text-primary-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.4)]"
                onClick={handleAddTask}
                size="sm"
                variant="ghost"
              >
                <PlusIcon size={16} />
                <span className="font-medium text-[10px]">Add Task</span>
              </Button>
              <Button
                className="nodrag h-6 gap-1 rounded-full bg-card/80 px-2.5 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                data-testid="add-column-trigger"
                onClick={handleAddColumn}
                ref={addColumnButtonRef}
                size="sm"
                variant="ghost"
              >
                <PlusIcon size={16} />
                <span className="font-medium text-[10px]">Add Column</span>
              </Button>
              <Popover
                onOpenChange={setShowDeleteConfirm}
                open={showDeleteConfirm}
              >
                <PopoverTrigger asChild>
                  <button
                    className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                    onClick={handleRemove}
                    type="button"
                  >
                    <XIcon size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  className="nodrag w-auto border-border/50 bg-card px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  side="top"
                  sideOffset={8}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      Delete board?
                    </span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/10"
                      onClick={handleConfirmDelete}
                      type="button"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: required */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: required */}
          <div
            className={`nodrag overflow-y-auto overflow-x-hidden p-3 ${styles.boardContent}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onPointerDown={handlePointerDown}
            onWheel={handleWheel}
            onWheelCapture={handleWheel}
            style={{
              height: "calc(100% - 42px)",
            }}
          >
            <KanbanBoard
              board={board}
              onOpenTaskDetail={handleOpenTaskDetail}
            />
          </div>
        </div>

        <ColumnCreateDialog
          boardId={boardId}
          isOpen={isCreateColumnOpen}
          onClose={handleCloseCreateColumn}
          onSubmit={handleSubmitCreateColumn}
          position={createColumnPos ?? undefined}
          sourceElement={addColumnButtonRef.current}
        />
      </>
    );
  }
);

BoardNodeComponent.displayName = "BoardNode";

// Dialog components are rendered as React Flow nodes; they still use portals internally
// for certain elements like connector edges.

import { AreaPropertiesDialogNodeComponent } from "@/src/components/dialogs/area-properties-dialog-node";
import { BoardPropertiesDialogNodeComponent } from "@/src/components/dialogs/board/board-properties-dialog-node";
import { BoardQuickActionsNodeComponent } from "@/src/components/dialogs/board/board-quick-actions-node";
import { ConnectionDialogNodeComponent } from "@/src/components/dialogs/board/connection-dialog-node";
import { DeleteBoardDialogNodeComponent } from "@/src/components/dialogs/board/delete-board-dialog-node";
import { DuplicateBoardDialogNodeComponent } from "@/src/components/dialogs/board/duplicate-board-dialog-node";
import { RenameBoardDialogNodeComponent } from "@/src/components/dialogs/board/rename-board-dialog-node";
import { ColorIconPickerDialogNodeComponent } from "@/src/components/dialogs/color-icon-picker-dialog-node";
import { ColumnQuickActionsNodeComponent } from "@/src/components/dialogs/column/column-quick-actions-node";
import { DeleteColumnDialogNodeComponent } from "@/src/components/dialogs/column/delete-column-dialog-node";
import { MoveColumnDialogNodeComponent } from "@/src/components/dialogs/column/move-column-dialog-node";
import { RenameColumnDialogNodeComponent } from "@/src/components/dialogs/column/rename-column-dialog-node";
import { ShareDialogNodeComponent } from "@/src/components/dialogs/share-dialog-node";
import { TaskDetailModalNodeComponent } from "@/src/components/tasks/task-detail-modal-node";
import { TaskModalNodeComponent } from "@/src/components/tasks/task-modal-node";
import { TaskQuickActionsNodeComponent } from "@/src/components/tasks/task-quick-actions-node";
import { AreaNodeComponent } from "./area-node";

export const nodeTypes = {
  area: AreaNodeComponent,
  areaPropertiesDialog: AreaPropertiesDialogNodeComponent,
  board: BoardNodeComponent,
  taskModal: TaskModalNodeComponent,
  taskDetailModal: TaskDetailModalNodeComponent,
  boardQuickActions: BoardQuickActionsNodeComponent,
  taskQuickActions: TaskQuickActionsNodeComponent,
  columnQuickActions: ColumnQuickActionsNodeComponent,
  boardRenameDialog: RenameBoardDialogNodeComponent,
  boardDuplicateDialog: DuplicateBoardDialogNodeComponent,
  boardDeleteDialog: DeleteBoardDialogNodeComponent,
  connectionDialog: ConnectionDialogNodeComponent,
  columnRenameDialog: RenameColumnDialogNodeComponent,
  columnDeleteDialog: DeleteColumnDialogNodeComponent,
  columnMoveDialog: MoveColumnDialogNodeComponent,
  boardPropertiesDialog: BoardPropertiesDialogNodeComponent,
  colorIconPickerDialog: ColorIconPickerDialogNodeComponent,
  shareDialog: ShareDialogNodeComponent,
};
