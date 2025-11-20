/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { memo, useCallback, useState } from "react";
import { useKanbanStore } from "../store/kanban-store";
import type { Column, Task } from "../types";
import { TaskCard } from "./task-card";

type KanbanColumnProps = {
  column: Column;
  boardId: string;
};

export const KanbanColumn = memo(({ column, boardId }: KanbanColumnProps) => {
  const [_isHovered, setIsHovered] = useState(false);
  const [_isDragOver, setIsDragOver] = useState(false);

  const draggedTask = useKanbanStore((state) => state.draggedTask);
  const setDraggedTask = useKanbanStore((state) => state.setDraggedTask);
  const moveTask = useKanbanStore((state) => state.moveTask);
  const selectedTasks = useKanbanStore((state) => state.selectedTasks);

  const tasks = column.tasks || [];
  const taskCount = tasks.length;

  const handleDragStart = useCallback(
    (task: Task) => {
      setDraggedTask(task);
    },
    [setDraggedTask]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (draggedTask && draggedTask.column_id !== column.id) {
        moveTask(draggedTask.id, draggedTask.column_id, column.id, boardId);
      }
      setDraggedTask(null);
    },
    [draggedTask, column.id, boardId, moveTask, setDraggedTask]
  );

  return (
    <section
      aria-label={`Column: ${column.name}`}
      className="flex max-h-full min-w-[285px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/60"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-zinc-100/90 px-2.5 py-2 dark:bg-zinc-800/90">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-card-foreground text-xs">
            {column.name}
          </h3>
          <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {taskCount}
          </span>
        </div>
      </div>

      <section
        aria-label="Task drop zone"
        className="min-h-40 flex-1 space-y-1.5 overflow-y-auto p-2 transition-all"
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              isSelected={selectedTasks.has(task.id)}
              key={task.id}
              onDragStart={handleDragStart}
              task={task}
            />
          ))
        ) : (
          <div className="flex h-40 items-center justify-center text-center">
            <p className="text-muted-foreground/60 text-xs">No tasks yet</p>
          </div>
        )}
      </section>
    </section>
  );
});

KanbanColumn.displayName = "KanbanColumn";
