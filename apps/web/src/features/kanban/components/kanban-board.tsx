"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { memo, useMemo } from "react";
import { useColumnDragContext } from "@/src/components/core/canvas";
import type { DenormalizedBoard } from "../types";
import { AddColumnPlaceholder } from "./add-column-placeholder";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  board: DenormalizedBoard;
  onOpenTaskDetail?: (taskId: string, screenX: number, screenY: number) => void;
};

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
            className={`flex flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1 transition-all duration-200 ${
              showDropHighlight
                ? "rounded-lg border-2 border-primary border-dashed bg-primary/5 ring-2 ring-primary/50"
                : ""
            }`}
            ref={setNodeRef}
          >
            {columns.map((column) => (
              <KanbanColumn
                boardId={board.id}
                column={column}
                key={column.id}
                onOpenTaskDetail={onOpenTaskDetail}
              />
            ))}
            <AddColumnPlaceholder boardId={board.id} />
          </div>
        </SortableContext>
      </div>
    );
  }
);

KanbanBoard.displayName = "KanbanBoard";
