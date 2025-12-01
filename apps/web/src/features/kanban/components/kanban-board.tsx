"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { memo, useMemo } from "react";
import { useKanbanStore } from "../store/kanban-store";
import type { DenormalizedBoard } from "../types";
import { AddColumnPlaceholder } from "./add-column-placeholder";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  board: DenormalizedBoard;
  onOpenTaskDetail?: (taskId: string, screenX: number, screenY: number) => void;
};

export const KanbanBoard = memo(
  ({ board, onOpenTaskDetail }: KanbanBoardProps) => {
    const moveColumn = useKanbanStore((state) => state.moveColumn);

    const columns = board.columns;

    const columnIds = useMemo(() => columns.map((col) => col.id), [columns]);

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = columns.findIndex((col) => col.id === active.id);
        const newIndex = columns.findIndex((col) => col.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          moveColumn(board.id, active.id as string, newIndex);
        }
      }
    };

    return (
      <div className="flex h-full flex-col">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1">
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
        </DndContext>
      </div>
    );
  }
);

KanbanBoard.displayName = "KanbanBoard";
