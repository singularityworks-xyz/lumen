"use client";

import { memo } from "react";
import { useKanbanStore } from "@/src/features/kanban";
import { useTaskDragPresence } from "@/src/hooks/use-task-drag-presence";
import { TaskDragOverlay } from "./task-drag-overlay";

/**
 * Container component that renders floating drag overlays for
 * collaborators who are currently dragging tasks.
 * Local user sees native browser drag.
 * Collaborators see the custom TaskDragOverlay with position synced via awareness.
 */
export const TaskDragOverlayContainer = memo(() => {
  const { draggedTasks, isCollaborating } = useTaskDragPresence();
  const tasks = useKanbanStore((state) => state.tasks);
  if (!isCollaborating || draggedTasks.length === 0) {
    return null;
  }

  return (
    <>
      {draggedTasks.map(({ collaborator, dragState }) => {
        const task = tasks.byId[dragState.taskId];
        if (!task) {
          return null;
        }

        return (
          <TaskDragOverlay
            collaborator={collaborator}
            cursorX={dragState.cursorX}
            cursorY={dragState.cursorY}
            key={`drag-overlay-${collaborator.id}-${dragState.taskId}`}
            task={task}
          />
        );
      })}
    </>
  );
});

TaskDragOverlayContainer.displayName = "TaskDragOverlayContainer";
