"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { type Collaborator, useCollaboration } from "@/src/features/collab";
import type { Task } from "@/src/features/kanban";

export interface DraggingTaskState {
  taskId: string;
  fromColumnId: string;
  fromBoardId: string;
  cursorX?: number;
  cursorY?: number;
}

interface TaskDragAwarenessState {
  draggingTask?: DraggingTaskState;
}

/**
 * Hook to manage task drag presence - broadcasts when local user is dragging
 * and reads when other users are dragging tasks.
 * Local user sees native browser drag.
 * Collaborators see a custom overlay with position synced via Yjs awareness.
 */
export function useTaskDragPresence() {
  const { isCollaborating, awareness, collaborators, localUser } =
    useCollaboration();

  const isDraggingRef = useRef(false);
  // Store current task being dragged for fallback
  const currentDragTaskRef = useRef<Task | null>(null);

  // Start dragging - broadcast to other users
  const startDragging = useCallback(
    (task: Task, cursorX?: number, cursorY?: number) => {
      isDraggingRef.current = true;
      currentDragTaskRef.current = task;
      // Broadcast to collaborators if connected
      if (isCollaborating && awareness) {
        const dragState: DraggingTaskState = {
          taskId: task.id,
          fromColumnId: task.column_id,
          fromBoardId: task.board_id,
          cursorX,
          cursorY,
        };
        awareness.setLocalStateField("draggingTask", dragState);
      }
    },
    [isCollaborating, awareness]
  );

  const lastUpdateRef = useRef(0);

  // Update cursor position while dragging (for collaborators to see)
  const updateDragPosition = useCallback(
    (cursorX: number, cursorY: number) => {
      if (!isDraggingRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastUpdateRef.current < 24) {
        return;
      }
      lastUpdateRef.current = now;

      // Broadcast to collaborators if connected
      if (isCollaborating && awareness) {
        const currentState =
          awareness.getLocalState() as TaskDragAwarenessState | null;
        if (currentState?.draggingTask) {
          // Update existing drag state with new position
          awareness.setLocalStateField("draggingTask", {
            ...currentState.draggingTask,
            cursorX,
            cursorY,
          });
        } else if (currentDragTaskRef.current) {
          // Fallback: re-create drag state if it was lost
          const task = currentDragTaskRef.current;
          awareness.setLocalStateField("draggingTask", {
            taskId: task.id,
            fromColumnId: task.column_id,
            fromBoardId: task.board_id,
            cursorX,
            cursorY,
          });
        }
      }
    },
    [isCollaborating, awareness]
  );

  // Stop dragging - clear awareness state
  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    currentDragTaskRef.current = null;
    if (isCollaborating && awareness) {
      awareness.setLocalStateField("draggingTask", null);
    }
  }, [isCollaborating, awareness]);
  // Get all collaborators who are currently dragging tasks (reactive)
  const draggingCollaborators = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }

    return collaborators.filter(
      (collab) =>
        collab.draggingTask !== undefined && collab.draggingTask !== null
    );
  }, [isCollaborating, collaborators]);

  // Check if a specific task is being dragged by a collaborator (reactive)
  const getTaskDragCollaborator = useCallback(
    (taskId: string): Collaborator | undefined => {
      if (!isCollaborating) {
        return;
      }

      return collaborators.find(
        (collab) => collab.draggingTask?.taskId === taskId
      );
    },
    [isCollaborating, collaborators]
  );

  // Get all tasks currently being dragged by collaborators (reactive)
  const draggedTasks = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }

    return collaborators.flatMap((collab) => {
      if (!collab.draggingTask) {
        return [];
      }
      return [
        {
          collaborator: collab,
          dragState: collab.draggingTask,
        },
      ];
    });
  }, [isCollaborating, collaborators]);

  // Clear drag state on unmount
  useEffect(
    () => () => {
      if (isDraggingRef.current && awareness) {
        awareness.setLocalStateField("draggingTask", null);
      }
    },
    [awareness]
  );

  return {
    startDragging,
    updateDragPosition,
    stopDragging,
    getTaskDragCollaborator,
    draggedTasks,
    draggingCollaborators,
    isCollaborating,
    localUser,
  };
}
