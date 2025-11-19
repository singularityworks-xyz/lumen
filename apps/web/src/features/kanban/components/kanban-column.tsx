/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { Plus } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import type { Column, Task } from "../types";
import { TaskCard } from "./task-card";

type KanbanColumnProps = {
  column: Column;
  boardId: string;
};

export const KanbanColumn = memo(({ column, boardId }: KanbanColumnProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const draggedTask = useKanbanStore((state) => state.draggedTask);
  const setDraggedTask = useKanbanStore((state) => state.setDraggedTask);
  const moveTask = useKanbanStore((state) => state.moveTask);
  const setCreateTaskColumnId = useKanbanStore(
    (state) => state.setCreateTaskColumnId
  );
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

  const handleAddTask = useCallback(() => {
    setCreateTaskColumnId(column.id);
  }, [column.id, setCreateTaskColumnId]);

  const getDropZoneClassName = () => {
    if (isDragOver) {
      return "scale-[1.01] border-primary/40 bg-primary/8";
    }
    if (isHovered) {
      return "bg-secondary/50";
    }
    return "bg-secondary/20";
  };

  return (
    <section
      aria-label={`Column: ${column.name}`}
      className="flex max-h-full min-w-80 shrink-0 flex-col gap-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Column header */}
      <div className="px-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-card-foreground text-sm">
            {column.name}
          </h3>
          <span className="rounded-full bg-muted/40 px-2 py-1 text-muted-foreground text-xs">
            {taskCount}
          </span>
        </div>
      </div>

      {/* Tasks area */}
      <section
        aria-label="Task drop zone"
        className={`flex-1 space-y-2 overflow-y-auto rounded p-3 transition-all ${getDropZoneClassName()} min-h-40 border border-border/60`}
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
            <p className="text-muted-foreground/60 text-sm">No tasks yet</p>
          </div>
        )}
      </section>

      {/* Add task button */}
      <Button
        className={`w-full justify-start gap-2 rounded transition-all ${isHovered ? "border-primary/30 bg-primary/10" : "border-border/40 hover:bg-muted/20"}text-muted-foreground hover:text-card-foreground`}
        onClick={handleAddTask}
        size="sm"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        <span className="font-medium text-xs">Add Task</span>
      </Button>
    </section>
  );
});

KanbanColumn.displayName = "KanbanColumn";
