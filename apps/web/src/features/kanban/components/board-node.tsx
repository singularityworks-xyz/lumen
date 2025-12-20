"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  NodeResizer as Resizer,
  useReactFlow,
} from "@xyflow/react";
import { GripVertical, Plus, SquarePen, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import type {
  BoardNode,
  DenormalizedBoard,
  DenormalizedColumn,
  Task,
} from "../types";
import { KanbanBoard } from "./kanban-board";
import styles from "./styles/board-node.module.css";

type BoardNodeProps = NodeProps<Node<BoardNode["data"]>>;

export const BoardNodeComponent = memo<BoardNodeProps>(
  ({ id, data, selected }) => {
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

    const boardData = useKanbanStore(
      useShallow((state) => state.boards.byId[data.boardId] ?? null)
    );
    const columnsMap = useKanbanStore(
      useShallow((state) => state.columns.byId)
    );
    const tasksMap = useKanbanStore(useShallow((state) => state.tasks.byId));

    const board = useMemo((): DenormalizedBoard | null => {
      if (!boardData) {
        return null;
      }

      const denormalizedColumns: DenormalizedColumn[] = boardData.column_ids
        .map((colId) => {
          const column = columnsMap[colId];
          if (!column) {
            return null;
          }

          const columnTasks = column.task_ids
            .map((taskId) => tasksMap[taskId])
            .filter((task): task is Task => task !== undefined)
            .sort((a, b) => a.position - b.position);

          return {
            id: column.id,
            board_id: column.board_id,
            name: column.name,
            description: column.description,
            position: column.position,
            tasks: columnTasks,
          } as DenormalizedColumn;
        })
        .filter((col): col is DenormalizedColumn => col !== null)
        .sort((a, b) => a.position - b.position);

      return {
        id: boardData.id,
        name: boardData.name,
        description: boardData.description,
        workspace_id: boardData.workspace_id,
        created_by: boardData.created_by,
        created_at: boardData.created_at,
        columns: denormalizedColumns,
      };
    }, [boardData, columnsMap, tasksMap]);

    const {
      getNode,
      setNodes,
      setCenter,
      screenToFlowPosition,
      getViewport,
      setViewport,
    } = useReactFlow();

    const { boardId, isSelected } = data as BoardNode["data"];

    const triggerTaskDetailModalShake = useKanbanStore(
      (state) => state.triggerTaskDetailModalShake
    );

    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const openBoardQuickActions = useKanbanStore(
      (state) => state.openBoardQuickActions
    );
    const openBoardDialog = useKanbanStore((state) => state.openBoardDialog);

    const headerRef = useRef<HTMLDivElement>(null);

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
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 400 });
        }
      },
      [getViewport, setViewport]
    );

    const handleOpenTaskDetail = useCallback(
      (taskId: string, _screenX: number, _screenY: number) => {
        const result = openTaskDetailModal({ taskId, boardId });
        if (result.isExisting) {
          setCenter(result.position.x + 200, result.position.y + 175, {
            duration: 500,
            zoom: 1,
          });
          setTimeout(() => {
            triggerTaskDetailModalShake(result.id);
          }, 300);
        } else {
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
        setCenter,
        triggerTaskDetailModalShake,
        ensureDialogVisible,
      ]
    );

    const isMultiSelected = selectedBoardIds.includes(id);

    const { minDimensions, maxDimensions, contentDimensions } = useMemo(() => {
      const boardColumns = board?.columns ?? [];
      const numColumns = boardColumns.length;

      const COLUMN_WIDTH = 300;
      const COLUMN_GAP = 12;
      const BOARD_PADDING = 24;
      const HEADER_HEIGHT = 42;
      const TASK_HEIGHT = 120;
      const TASK_GAP = 8;
      const COLUMN_PADDING = 24;
      const COLUMN_HEADER = 56;
      const SKELETON_COLUMN_WIDTH = 225;
      const minWidth = COLUMN_WIDTH + BOARD_PADDING + 20;
      const minHeight = HEADER_HEIGHT + COLUMN_HEADER + 220 + BOARD_PADDING;
      const maxTaskCount = Math.max(
        ...boardColumns.map((c) => c.tasks?.length ?? 0),
        0
      );

      const maxWidth =
        numColumns * COLUMN_WIDTH +
        (numColumns > 0 ? numColumns * COLUMN_GAP : 0) +
        (numColumns > 0 ? COLUMN_GAP : 0) +
        SKELETON_COLUMN_WIDTH +
        BOARD_PADDING * 2;

      const maxHeight =
        HEADER_HEIGHT +
        COLUMN_HEADER +
        (maxTaskCount + 2) * TASK_HEIGHT +
        (maxTaskCount + 2 - 1) * TASK_GAP +
        COLUMN_PADDING +
        BOARD_PADDING;

      const contentWidth =
        numColumns * COLUMN_WIDTH +
        (numColumns - 1) * COLUMN_GAP +
        BOARD_PADDING;

      let maxColumnHeight = 0;
      for (const col of boardColumns) {
        const numTasks = col.tasks?.length ?? 0;
        const columnHeight =
          COLUMN_HEADER +
          (numTasks > 0
            ? numTasks * TASK_HEIGHT + (numTasks - 1) * TASK_GAP
            : 160) +
          COLUMN_PADDING;

        maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
      }

      const contentHeight = maxColumnHeight + HEADER_HEIGHT + BOARD_PADDING;

      return {
        minDimensions: {
          width: minWidth,
          height: minHeight,
        },
        maxDimensions: {
          width: maxWidth,
          height: maxHeight,
        },
        contentDimensions: {
          width: Math.max(contentWidth, minWidth),
          height: Math.max(contentHeight, minHeight),
        },
      };
    }, [board?.columns]);

    useEffect(() => {
      const node = getNode(String(id));
      if (!node) {
        return;
      }

      const currentWidth = node.width || minDimensions.width;
      const currentHeight = node.height || minDimensions.height;

      const shouldGrow =
        contentDimensions.width > currentWidth ||
        contentDimensions.height > currentHeight;

      if (shouldGrow) {
        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === String(id)) {
              const newWidth = Math.min(
                Math.max(currentWidth, contentDimensions.width),
                maxDimensions.width
              );
              const newHeight = Math.min(
                Math.max(currentHeight, contentDimensions.height),
                maxDimensions.height
              );

              return {
                ...n,
                width: newWidth,
                height: newHeight,
                style: {
                  ...n.style,
                  width: newWidth,
                  height: newHeight,
                },
              };
            }
            return n;
          })
        );
        return;
      }

      const shouldShrink =
        contentDimensions.width < currentWidth ||
        contentDimensions.height < currentHeight;

      if (shouldShrink) {
        const shrinkTimeout = setTimeout(() => {
          setNodes((nodes) =>
            nodes.map((n) => {
              if (n.id === String(id)) {
                const newWidth = Math.max(
                  contentDimensions.width,
                  minDimensions.width
                );
                const newHeight = Math.max(
                  contentDimensions.height,
                  minDimensions.height
                );

                return {
                  ...n,
                  width: newWidth,
                  height: newHeight,
                  style: {
                    ...n.style,
                    width: newWidth,
                    height: newHeight,
                  },
                };
              }
              return n;
            })
          );
        }, 250);

        return () => clearTimeout(shrinkTimeout);
      }
    }, [
      id,
      contentDimensions,
      minDimensions,
      maxDimensions,
      getNode,
      setNodes,
    ]);

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      removeBoard(id);
    };

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
          maxWidth={maxDimensions.width}
          minHeight={minDimensions.height}
          minWidth={minDimensions.width}
        />

        {(selected || isSelected || isMultiSelected) && (
          <div className="pointer-events-none absolute right-0 bottom-0 z-10">
            <div className="relative h-8 w-8">
              <div className="absolute right-0 bottom-0 h-3 w-3 animate-pulse rounded-full bg-primary/30" />

              <div className="absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-tl-lg bg-primary/90 shadow-lg transition-all hover:scale-110">
                <svg
                  className="h-3 w-3 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <title>Resize handle</title>
                  <path d="M21 15v6h-6M3 9V3h6M21 3l-7 7M3 21l7-7" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/** biome-ignore lint/a11y/useSemanticElements: skip */}
        <div
          aria-pressed={isSelected || selected || isMultiSelected}
          className={`h-full w-full overflow-hidden rounded bg-card transition-all ${
            isMultiSelected
              ? "border-2 border-gray-500 shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] ring-2 ring-gray-500/20 dark:shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
              : isSelected || selected
                ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
                : "border-2 border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          }
        `}
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
          tabIndex={0}
        >
          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: it's a draggable handle */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: it's a draggable handle */}
          <div
            className="group flex w-full cursor-move items-center justify-between gap-1.5 rounded-t border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-colors hover:bg-muted dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)] dark:hover:bg-secondary"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const headerRect = headerRef.current?.getBoundingClientRect();
              const screenX = headerRect ? headerRect.right + 20 : e.clientX;
              const screenY = headerRect ? headerRect.top : e.clientY;
              const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
              openBoardQuickActions(boardId, flowPos);
              setTimeout(
                () => ensureDialogVisible(flowPos.x, flowPos.y, 220, 280),
                50
              );
            }}
            ref={headerRef}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 items-center gap-1">
                <h3 className="truncate font-semibold text-foreground text-xs">
                  {board.name}
                </h3>
                <button
                  className="nodrag flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all hover:bg-accent group-hover:opacity-100"
                  onClick={handleOpenEdit}
                  title="Edit board"
                  type="button"
                >
                  <SquarePen className="h-3 w-3 text-muted-foreground" />
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
                <Plus className="h-3 w-3" />
                <span className="font-medium text-[10px]">Add Task</span>
              </Button>
              <button
                className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                onClick={handleRemove}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: required */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: required */}
          <div
            className={`nodrag overflow-x-auto overflow-y-auto p-3 ${styles.boardContent}`}
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

        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="top"
          position={Position.Top}
          style={{ top: -6 }}
          type="source"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="top-target"
          position={Position.Top}
          style={{ top: -6 }}
          type="target"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="right"
          position={Position.Right}
          style={{ right: -6 }}
          type="source"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="right-target"
          position={Position.Right}
          style={{ right: -6 }}
          type="target"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="bottom"
          position={Position.Bottom}
          style={{ bottom: -6 }}
          type="source"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="bottom-target"
          position={Position.Bottom}
          style={{ bottom: -6 }}
          type="target"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="left"
          position={Position.Left}
          style={{ left: -6 }}
          type="source"
        />
        <Handle
          className="h-3! w-3! rounded-full! border-2! border-primary! bg-background! opacity-0 transition-opacity hover:opacity-100"
          id="left-target"
          position={Position.Left}
          style={{ left: -6 }}
          type="target"
        />
      </>
    );
  }
);

BoardNodeComponent.displayName = "BoardNode";

// refactored the dialogs to not use portals, so they can be used as nodes

import { BoardQuickActionsNodeComponent } from "../../../components/dialogs/board-quick-actions-node";
import { ColumnQuickActionsNodeComponent } from "../../../components/dialogs/column-quick-actions-node";
import { ConnectionDialogNodeComponent } from "../../../components/dialogs/connection-dialog-node";
import { DeleteBoardDialogNodeComponent } from "../../../components/dialogs/delete-board-dialog-node";
import { DeleteColumnDialogNodeComponent } from "../../../components/dialogs/delete-column-dialog-node";
import { DuplicateBoardDialogNodeComponent } from "../../../components/dialogs/duplicate-board-dialog-node";
import { MoveColumnDialogNodeComponent } from "../../../components/dialogs/move-column-dialog-node";
import { RenameBoardDialogNodeComponent } from "../../../components/dialogs/rename-board-dialog-node";
import { RenameColumnDialogNodeComponent } from "../../../components/dialogs/rename-column-dialog-node";
import { TaskQuickActionsNodeComponent } from "../../../components/dialogs/task-quick-actions-node";
import { TaskDetailModalNodeComponent } from "../../../components/tasks/task-detail-modal-node";
import { TaskModalNodeComponent } from "../../../components/tasks/task-modal-node";

export const nodeTypes = {
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
};
