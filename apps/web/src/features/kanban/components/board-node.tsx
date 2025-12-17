"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  NodeResizer as Resizer,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { GripVertical, Plus, SquarePen, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { BoardQuickActions } from "@/src/components/board-quick-actions";
import { CreateConnectionDialog } from "@/src/components/dialogs/create-connection-dialog";
import { DeleteBoardDialog } from "@/src/components/dialogs/delete-board-dialog";
import { DuplicateBoardDialog } from "@/src/components/dialogs/duplicate-board-dialog";
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
            position: column.position,
            tasks: columnTasks,
          };
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

    const { getNode, setNodes, setCenter, screenToFlowPosition } =
      useReactFlow();

    const zoom = useStore((state) => state.transform[2]);

    const { boardId, isSelected } = data as BoardNode["data"];

    const triggerTaskDetailModalShake = useKanbanStore(
      (state) => state.triggerTaskDetailModalShake
    );

    const openEditBoardModal = useKanbanStore(
      (state) => state.openEditBoardModal
    );

    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );

    const duplicateBoard = useKanbanStore((state) => state.duplicateBoard);
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const removeConnection = useKanbanStore((state) => state.removeConnection);

    const columnCount = useKanbanStore((state) => {
      const boardEntity = state.boards.byId[boardId];
      return boardEntity?.column_ids.length ?? 0;
    });

    const taskCount = useKanbanStore((state) => {
      const boardEntity = state.boards.byId[boardId];
      if (!boardEntity) {
        return 0;
      }
      return boardEntity.column_ids.reduce((acc: number, colId: string) => {
        const col = state.columns.byId[colId];
        return acc + (col?.task_ids.length ?? 0);
      }, 0);
    });

    const connectionCount = useKanbanStore(
      (state) =>
        state.boardConnections.allIds.filter((connId) => {
          const conn = state.boardConnections.byId[connId];
          return (
            conn?.source_board_id === boardId ||
            conn?.target_board_id === boardId
          );
        }).length
    );

    const [quickActions, setQuickActions] = useState<{
      x: number;
      y: number;
    } | null>(null);

    const [activeDialog, setActiveDialog] = useState<{
      type: "duplicate" | "connections" | "delete";
      position?: { x: number; y: number };
    } | null>(null);

    const headerRef = useRef<HTMLDivElement>(null);

    const getBoardHeaderRect = useCallback(
      () => headerRef.current?.getBoundingClientRect() ?? null,
      []
    );

    const handleOpenTaskDetail = useCallback(
      (taskId: string, screenX: number, screenY: number) => {
        const canvasPosition = screenToFlowPosition({ x: screenX, y: screenY });
        const result = openTaskDetailModal(taskId, boardId, canvasPosition);
        if (result.isExisting) {
          setCenter(result.position.x + 200, result.position.y + 175, {
            duration: 500,
            zoom: 1,
          });
          setTimeout(() => {
            triggerTaskDetailModalShake(result.id);
          }, 300);
        }
      },
      [
        screenToFlowPosition,
        openTaskDetailModal,
        boardId,
        setCenter,
        triggerTaskDetailModalShake,
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

    const handleClick = (e: React.MouseEvent) => {
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
      const firstColumn = board?.columns?.[0];
      if (firstColumn) {
        const buttonPosition = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const result = openCreateTaskModal(
          firstColumn.id,
          boardId,
          buttonPosition
        );
        if (result.isExisting) {
          setCenter(result.position.x + 200, result.position.y + 150, {
            duration: 500,
            zoom: 1,
          });
        }
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
      const buttonPosition = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const result = openEditBoardModal(boardId, buttonPosition);
      if (result.isExisting) {
        setCenter(result.position.x + 200, result.position.y + 125, {
          duration: 500,
          zoom: 1,
        });
      }
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

        {/** biome-ignore lint/a11y/useSemanticElements: TODO: fl */}
        <div
          aria-pressed={isSelected || selected || isMultiSelected}
          className={`h-full w-full overflow-hidden rounded bg-card transition-all ${
            isMultiSelected
              ? "border-2 border-gray-500 shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] ring-2 ring-gray-500/20 dark:shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
              : // biome-ignore lint/style/noNestedTernary: TODO: fix later
                isSelected || selected
                ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
                : "border-2 border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          }
        `}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              // @ts-expect-error: TODO: fix later
              handleClick();
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
              setQuickActions({
                x: headerRect ? headerRect.right + 20 : e.clientX,
                y: headerRect ? headerRect.top : e.clientY,
              });
              setActiveDialog(null);
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

        {/* Connection handles for all four sides */}
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

        {quickActions && (
          <BoardQuickActions
            boardId={boardId}
            boardName={board.name}
            columnCount={columnCount}
            connectionCount={connectionCount}
            getBoardHeaderRect={getBoardHeaderRect}
            onAddTask={() => {
              if (boardData && boardData.column_ids.length > 0) {
                const firstColId = boardData.column_ids[0];
                const headerRect = getBoardHeaderRect();
                if (firstColId && headerRect && quickActions) {
                  openCreateTaskModal(
                    firstColId,
                    boardId,
                    {
                      x: headerRect.right + 20,
                      y: headerRect.top,
                    },
                    {
                      x: quickActions.x + 220,
                      y: quickActions.y + 24,
                    }
                  );
                }
              }
              // Keep quick actions open - don't call setQuickActions(null)
            }}
            onClose={() => setQuickActions(null)}
            onConnections={() => {
              const currentPos = quickActions;
              // setQuickActions(null); // Keep open
              setActiveDialog({
                type: "connections",
                position: currentPos
                  ? { x: currentPos.x + 240, y: currentPos.y }
                  : undefined,
              });
            }}
            onDelete={() => {
              const currentPos = quickActions;
              // setQuickActions(null); // Keep open
              setActiveDialog({
                type: "delete",
                position: currentPos
                  ? { x: currentPos.x + 240, y: currentPos.y }
                  : undefined,
              });
            }}
            onDuplicate={() => {
              const currentPos = quickActions;
              // setQuickActions(null); // Keep open
              setActiveDialog({
                type: "duplicate",
                position: currentPos
                  ? { x: currentPos.x + 240, y: currentPos.y }
                  : undefined,
              });
            }}
            onPositionChange={setQuickActions}
            onRename={() => {
              const currentPos = quickActions;
              // Keep quick actions open

              if (currentPos) {
                // Offset by 240px to right
                const flowPos = screenToFlowPosition({
                  x: currentPos.x + 240,
                  y: currentPos.y,
                });
                // Pass sourcePosition for connector edge (use screen coordinates)
                const sourcePos = {
                  x: currentPos.x + 220,
                  y: currentPos.y + 24,
                };
                openEditBoardModal(boardId, flowPos, sourcePos);
              } else {
                const headerRect = getBoardHeaderRect();
                if (headerRect) {
                  const flowPos = screenToFlowPosition({
                    x: headerRect.right + 20 + 240,
                    y: headerRect.top,
                  });
                  openEditBoardModal(boardId, flowPos);
                }
              }
            }}
            position={quickActions}
            taskCount={taskCount}
            zoom={zoom}
          />
        )}

        {(() => {
          const anchorPos = quickActions ?? activeDialog?.position;
          const dialogPos = activeDialog?.position;

          if (!(anchorPos && dialogPos)) {
            return null;
          }

          return (
            <>
              {activeDialog?.type === "connections" && (
                <CreateConnectionDialog
                  getBoardHeaderRect={getBoardHeaderRect}
                  onClose={() => setActiveDialog(null)}
                  quickActionsPosition={anchorPos}
                  sourceBoardId={boardId}
                  x={dialogPos.x}
                  y={dialogPos.y}
                />
              )}

              {activeDialog?.type === "duplicate" && (
                <DuplicateBoardDialog
                  boardId={boardId}
                  boardName={board.name}
                  columnCount={columnCount}
                  connectionCount={connectionCount}
                  getSourceButtonRect={getBoardHeaderRect}
                  onClose={() => setActiveDialog(null)}
                  onDuplicate={(newName, options) => {
                    duplicateBoard(boardId, newName, options);
                    setActiveDialog(null);
                  }}
                  onPositionChange={(pos) =>
                    setActiveDialog((prev) =>
                      prev
                        ? { ...prev, position: { ...prev.position, ...pos } }
                        : prev
                    )
                  }
                  position={dialogPos}
                  quickActionsPosition={anchorPos}
                  taskCount={taskCount}
                />
              )}

              {activeDialog?.type === "delete" && (
                <DeleteBoardDialog
                  boardId={boardId}
                  boardName={board.name}
                  columnCount={columnCount}
                  connectionCount={connectionCount}
                  getSourceButtonRect={getBoardHeaderRect}
                  onClose={() => setActiveDialog(null)}
                  onConfirm={() => {
                    const connections =
                      useKanbanStore.getState().boardConnections;
                    const connectionsToRemove = connections.allIds.filter(
                      (connId) => {
                        const conn = connections.byId[connId];
                        return (
                          conn?.source_board_id === boardId ||
                          conn?.target_board_id === boardId
                        );
                      }
                    );
                    for (const connId of connectionsToRemove) {
                      removeConnection(connId);
                    }
                    removeBoard(boardId);
                    setActiveDialog(null);
                  }}
                  onPositionChange={(pos) =>
                    setActiveDialog((prev) =>
                      prev
                        ? { ...prev, position: { ...prev.position, ...pos } }
                        : prev
                    )
                  }
                  position={dialogPos}
                  quickActionsPosition={anchorPos}
                  taskCount={taskCount}
                />
              )}
            </>
          );
        })()}
      </>
    );
  }
);

BoardNodeComponent.displayName = "BoardNode";

import { TaskDetailModalNodeComponent } from "../../../components/tasks/task-detail-modal-node";
import { TaskModalNodeComponent } from "../../../components/tasks/task-modal-node";
import { EditBoardModalNodeComponent } from "./edit-board-modal-node";

export const nodeTypes = {
  board: BoardNodeComponent,
  taskModal: TaskModalNodeComponent,
  taskDetailModal: TaskDetailModalNodeComponent,
  editBoardModal: EditBoardModalNodeComponent,
};
