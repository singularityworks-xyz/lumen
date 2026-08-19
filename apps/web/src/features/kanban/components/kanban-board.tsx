"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { memo, useMemo } from "react";
import { useColumnDragContext } from "@/src/components/core/helpers/canvas-types";
import type { DenormalizedBoard } from "../types";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  board: DenormalizedBoard;
  onOpenTaskDetail?: (taskId: string, screenX: number, screenY: number) => void;
}

export const KanbanBoard = memo(
  ({ board, onOpenTaskDetail }: KanbanBoardProps) => {
    const columns = board.columns;

    const columnIds = useMemo(() => columns.map((col) => col.id), [columns]);

    const { setNodeRef, isOver } = useDroppable({
      id: `board-droppable-${board.id}`,
      data: {
        type: "board-droppable",
        boardId: board.id,
      },
    });

    const { activeColumnData } = useColumnDragContext();

    const showDropHighlight =
      isOver &&
      activeColumnData !== null &&
      activeColumnData.sourceBoardId !== board.id;

    return (
      <div className="flex h-full flex-col">
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className={`flex flex-1 gap-3 overflow-hidden pb-1 transition-all duration-200 ${
              showDropHighlight
                ? "relative rounded-lg border-2 border-primary border-dashed bg-primary/5 ring-2 ring-primary/50"
                : ""
            }`}
            ref={setNodeRef}
          >
            {showDropHighlight && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="rounded-md bg-primary/90 px-4 py-2 font-medium text-primary-foreground text-sm shadow-lg">
                  Drop to add column
                </div>
              </div>
            )}
            {columns.map((column) => (
              <KanbanColumn
                boardId={board.id}
                column={column}
                key={column.id}
                onOpenTaskDetail={onOpenTaskDetail}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    );
  }
);

KanbanBoard.displayName = "KanbanBoard";
