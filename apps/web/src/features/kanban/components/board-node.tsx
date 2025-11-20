"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { NodeResizer as Resizer, useReactFlow } from "@xyflow/react";
import { GripVertical, Plus, X } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import type { BoardNode } from "../types";
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
    const setCreateTaskColumnId = useKanbanStore(
      (state) => state.setCreateTaskColumnId
    );
    const interactionMode = useKanbanStore((state) => state.interactionMode);
    const selectedBoardIds = useKanbanStore((state) => state.selectedBoardIds);
    const toggleBoardSelection = useKanbanStore(
      (state) => state.toggleBoardSelection
    );
    const { getNode, setNodes } = useReactFlow();
    const { board, isSelected } = data as BoardNode["data"];

    const isMultiSelected = selectedBoardIds.has(id);

    const { minDimensions, maxDimensions, contentDimensions } = useMemo(() => {
      const columns = board.columns || [];
      const columnCount = columns.length;

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
        ...columns.map((c) => c.tasks?.length || 0),
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
      for (const column of columns) {
        const taskCount = column.tasks?.length || 0;
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
    }, [board.columns]);

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
      const firstColumn = board.columns?.[0];
      if (firstColumn) {
        setCreateTaskColumnId(firstColumn.id);
      }
    };

    const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
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
          className={`h-full w-full overflow-hidden rounded bg-card shadow-lg transition-all ${
            isMultiSelected
              ? "border-2 border-gray-500 shadow-[0_0_20px_rgba(128,128,128,0.4)] ring-2 ring-gray-500/20"
              : // biome-ignore lint/style/noNestedTernary: TODO: fix later
                isSelected || selected
                ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3)]"
                : "border border-border"
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
          <div className="flex cursor-move items-center justify-between gap-1.5 rounded-t border-border border-b bg-zinc-50/95 px-3 py-2 transition-colors hover:bg-zinc-100/95 dark:bg-zinc-900/95 dark:hover:bg-zinc-800/95">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-foreground text-xs">
                  {board.name}
                </h3>
                {board.description && (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {board.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                className="nodrag h-6 gap-1 rounded-full bg-primary/90 px-2.5 text-primary-foreground hover:bg-primary"
                onClick={handleAddTask}
                size="sm"
                variant="ghost"
              >
                <Plus className="h-3 w-3" />
                <span className="font-medium text-[10px]">Add Task</span>
              </Button>
              <Button
                className="nodrag h-5 w-5 shrink-0 rounded-full p-0.5 hover:bg-destructive/20"
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
      </>
    );
  }
);

BoardNodeComponent.displayName = "BoardNode";

export const nodeTypes = {
  board: BoardNodeComponent,
};
