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
import type { Board } from "../types";
import { AddColumnPlaceholder } from "./add-column-placeholder";
import { CreateTaskModal } from "./create-task-modal";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailModal } from "./task-detail-modal";

type KanbanBoardProps = {
  board: Board;
};

export const KanbanBoard = memo(({ board }: KanbanBoardProps) => {
  const selectedTask = useKanbanStore((state) => {
    const createColumnId = state.createTaskColumnId;
    if (!createColumnId) {
      return null;
    }

    for (const column of board.columns || []) {
      for (const task of column.tasks || []) {
        if (state.selectedTasks.has(task.id)) {
          return task;
        }
      }
    }
    return null;
  });

  const createColumnId = useKanbanStore((state) => state.createTaskColumnId);
  const setCreateTaskColumnId = useKanbanStore(
    (state) => state.setCreateTaskColumnId
  );
  const moveColumn = useKanbanStore((state) => state.moveColumn);

  // Sort columns by position
  const columns = useMemo(() => {
    const cols = board.columns || [];
    return [...cols].sort((a, b) => a.position - b.position);
  }, [board.columns]);

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

      {createColumnId && (
        <CreateTaskModal
          boardId={board.id}
          columnId={createColumnId}
          onClose={() => setCreateTaskColumnId(null)}
        />
      )}
    </div>
  );
});

KanbanBoard.displayName = "KanbanBoard";
