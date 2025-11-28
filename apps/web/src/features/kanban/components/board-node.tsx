"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { NodeResizer as Resizer, useReactFlow } from "@xyflow/react";
import { GripVertical, Plus, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
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
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const setSelectedBoard = useKanbanStore((state) => state.setSelectedBoard);
    const bringBoardToFront = useKanbanStore(
      (state) => state.bringBoardToFront
    );
    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const interactionMode = useKanbanStore((state) => state.interactionMode);
    const selectedBoardIds = useKanbanStore((state) => state.selectedBoardIds);
    const toggleBoardSelection = useKanbanStore(
      (state) => state.toggleBoardSelection
    );
    const updateBoard = useKanbanStore((state) => state.updateBoard);

    // Use stable primitive selectors to extract data
    // This avoids infinite loop from creating new objects in selector
    const boardData = useKanbanStore(
      useShallow((state) => state.boards.byId[data.boardId] ?? null)
    );
    const columnsMap = useKanbanStore(
      useShallow((state) => state.columns.byId)
    );
    const tasksMap = useKanbanStore(useShallow((state) => state.tasks.byId));

    // Memoize the denormalization to create stable object references
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

    const { getNode, setNodes } = useReactFlow();

    const { boardId, isSelected } = data as BoardNode["data"];

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editedName, setEditedName] = useState(board?.name ?? "");
    const [editedDescription, setEditedDescription] = useState(
      board?.description ?? ""
    );

    const isMultiSelected = selectedBoardIds.includes(id);

    const { minDimensions, maxDimensions, contentDimensions } = useMemo(() => {
      const boardColumns = board?.columns ?? [];
      const columnCount = boardColumns.length;

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
        columnCount * COLUMN_WIDTH +
        (columnCount > 0 ? columnCount * COLUMN_GAP : 0) +
        (columnCount > 0 ? COLUMN_GAP : 0) +
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
        columnCount * COLUMN_WIDTH +
        (columnCount - 1) * COLUMN_GAP +
        BOARD_PADDING;

      let maxColumnHeight = 0;
      for (const col of boardColumns) {
        const taskCount = col.tasks?.length ?? 0;
        const columnHeight =
          COLUMN_HEADER +
          (taskCount > 0
            ? taskCount * TASK_HEIGHT + (taskCount - 1) * TASK_GAP
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
        openCreateTaskModal(firstColumn.id, boardId);
      }
    };

    const handleWheel = (e: React.WheelEvent) => {
      // If Ctrl/Meta is pressed, prevent browser zoom but allow canvas zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Don't stop propagation - let it bubble up to ReactFlow for canvas zoom
        return;
      }
      // For normal scrolling, stop propagation to prevent canvas pan
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
      setEditedName(board?.name ?? "");
      setEditedDescription(board?.description ?? "");
      setIsEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
      const name = editedName.trim() || "Untitled Board";
      const description = editedDescription.trim() || undefined;
      updateBoard(boardId, { name, description });
      setIsEditDialogOpen(false);
    };

    // Don't render if board not found
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
          <div className="flex cursor-move items-center justify-between gap-1.5 rounded-t border-border border-b bg-zinc-50/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-colors hover:bg-zinc-100/95 dark:bg-zinc-900/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)] dark:hover:bg-zinc-800/95">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <button
                  className="w-full text-left"
                  onClick={handleOpenEdit}
                  type="button"
                >
                  <h3 className="truncate font-semibold text-foreground text-xs">
                    {board.name}
                  </h3>
                  {board.description && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {board.description}
                    </p>
                  )}
                </button>
              </div>
            </div>
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
              <Button
                className="nodrag h-5 w-5 shrink-0 rounded-full bg-card/50 p-0.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-destructive/20 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
                onClick={handleRemove}
                size="sm"
                variant="ghost"
              >
                <X className="h-3 w-3" />
              </Button>
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
            <KanbanBoard board={board} />
          </div>
        </div>

        <Dialog onOpenChange={setIsEditDialogOpen} open={isEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  className="font-medium text-card-foreground text-sm"
                  htmlFor="board-name"
                >
                  Name
                </label>
                <Input
                  id="board-name"
                  onChange={(e) => setEditedName(e.target.value)}
                  value={editedName}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="font-medium text-card-foreground text-sm"
                  htmlFor="board-description"
                >
                  Description
                </label>
                <Textarea
                  id="board-description"
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Add a short description..."
                  rows={3}
                  value={editedDescription}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setIsEditDialogOpen(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

BoardNodeComponent.displayName = "BoardNode";

export const nodeTypes = {
  board: BoardNodeComponent,
};
