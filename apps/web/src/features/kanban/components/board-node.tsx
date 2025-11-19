"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { NodeResizer as Resizer, useReactFlow } from "@xyflow/react";
import { GripVertical, X } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import type { BoardNode } from "../types";
import { KanbanBoard } from "./kanban-board";

type BoardNodeProps = NodeProps<Node<BoardNode["data"]>>;

export const BoardNodeComponent = memo<BoardNodeProps>(
  ({ id, data, selected }) => {
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const setSelectedBoard = useKanbanStore((state) => state.setSelectedBoard);
    const { getNode, setNodes } = useReactFlow();
    const { board, isSelected } = data as BoardNode["data"];

    const contentDimensions = useMemo(() => {
      const columns = board.columns || [];
      const columnCount = columns.length;

      const COLUMN_WIDTH = 320;
      const COLUMN_GAP = 16;
      const BOARD_PADDING = 32;
      const HEADER_HEIGHT = 54;

      const contentWidth =
        columnCount * COLUMN_WIDTH +
        (columnCount - 1) * COLUMN_GAP +
        BOARD_PADDING;

      let maxColumnHeight = 0;
      for (const column of columns) {
        const taskCount = column.tasks?.length || 0;
        const TASK_HEIGHT = 120;
        const TASK_GAP = 8;
        const COLUMN_PADDING = 24;
        const ADD_BUTTON_HEIGHT = 36;
        const COLUMN_HEADER = 56;

        const columnHeight =
          COLUMN_HEADER +
          (taskCount > 0
            ? taskCount * TASK_HEIGHT + (taskCount - 1) * TASK_GAP
            : 160) +
          COLUMN_PADDING +
          ADD_BUTTON_HEIGHT;

        maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
      }

      const contentHeight = maxColumnHeight + HEADER_HEIGHT + BOARD_PADDING;

      return {
        width: Math.max(contentWidth, 800),
        height: Math.max(contentHeight, 600),
      };
    }, [board.columns]);

    useEffect(() => {
      const node = getNode(String(id));
      if (!node) {
        return;
      }

      const currentWidth = node.width || 800;
      const currentHeight = node.height || 600;

      const shouldGrow =
        contentDimensions.width > currentWidth ||
        contentDimensions.height > currentHeight;

      if (shouldGrow) {
        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === String(id)) {
              return {
                ...n,
                width: Math.max(currentWidth, contentDimensions.width),
                height: Math.max(currentHeight, contentDimensions.height),
                style: {
                  ...n.style,
                  width: Math.max(currentWidth, contentDimensions.width),
                  height: Math.max(currentHeight, contentDimensions.height),
                },
              };
            }
            return n;
          })
        );
      }
    }, [id, contentDimensions, getNode, setNodes]);

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      removeBoard(id);
    };

    const handleClick = () => {
      setSelectedBoard(id);
    };

    return (
      <>
        <Resizer
          handleClassName="!w-8 !h-8 !opacity-0"
          isVisible={selected}
          lineClassName="!border-0"
          lineStyle={{
            borderWidth: 0,
            opacity: 0,
          }}
          minHeight={400}
          minWidth={600}
        />

        {selected && (
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
          aria-pressed={isSelected || selected}
          className={`h-full w-full overflow-hidden rounded bg-card shadow-lg transition-all ${
            isSelected || selected
              ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3)]"
              : "border border-border"
          }
        `}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex cursor-move items-center justify-between gap-2 rounded-t border-border border-b bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/50">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-foreground text-sm">
                  {board.name}
                </h3>
                {board.description && (
                  <p className="truncate text-muted-foreground text-xs">
                    {board.description}
                  </p>
                )}
              </div>
            </div>
            <Button
              className="nodrag h-6 w-6 shrink-0 rounded-full p-1 hover:bg-destructive/20"
              onClick={handleRemove}
              size="sm"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div
            className="nodrag overflow-hidden p-4"
            style={{ height: "calc(100% - 54px)" }}
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
