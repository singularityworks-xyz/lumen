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
import { TaskDetailModal } from "@/src/components/tasks/task-detail-modal";
import { useKanbanStore } from "../store/kanban-store";
import type { DenormalizedBoard } from "../types";
import { AddColumnPlaceholder } from "./add-column-placeholder";
import { KanbanColumn } from "./kanban-column";

type KanbanBoardProps = {
  board: DenormalizedBoard;
};

export const KanbanBoard = memo(({ board }: KanbanBoardProps) => {
  const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);
  const selectedTask = useMemo(() => {
    if (selectedTaskIds.length === 0) {
      return null;
    }
    for (const column of board.columns) {
      for (const task of column.tasks) {
        if (selectedTaskIds.includes(task.id)) {
          return task;
        }
      }
    }
    return null;
  }, [board.columns, selectedTaskIds]);

  const moveColumn = useKanbanStore((state) => state.moveColumn);

  // Columns are already sorted in denormalized data
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
              />
            ))}
            <AddColumnPlaceholder boardId={board.id} />
          </div>
        </SortableContext>
      </DndContext>

      {selectedTask && (
        <TaskDetailModal boardId={board.id} task={selectedTask} />
      )}
    </div>
  );
});

KanbanBoard.displayName = "KanbanBoard";
