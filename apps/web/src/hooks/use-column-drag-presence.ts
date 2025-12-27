"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type DraggingColumnState,
  useCollaboration,
} from "@/src/features/collab";

type ColumnDragAwarenessState = {
  draggingColumn?: DraggingColumnState;
};

// Hook to manage column drag presence - broadcasts when local user is dragging and reads when other users are dragging columns.
export function useColumnDragPresence() {
  const { isCollaborating, awareness, collaborators, localUser } =
    useCollaboration();

  const isDraggingRef = useRef(false);
  const lastUpdateRef = useRef(0);

  // Start dragging - broadcast to other users
  const startDragging = useCallback(
    (
      columnId: string,
      sourceBoardId: string,
      cursorX: number,
      cursorY: number
    ) => {
      isDraggingRef.current = true;
      // Broadcast to collaborators if connected
      if (isCollaborating && awareness) {
        const dragState: DraggingColumnState = {
          columnId,
          sourceBoardId,
          cursorX,
          cursorY,
        };
        awareness.setLocalStateField("draggingColumn", dragState);
      }
    },
    [isCollaborating, awareness]
  );

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
          awareness.getLocalState() as ColumnDragAwarenessState | null;
        if (currentState?.draggingColumn) {
          // Update existing drag state with new position
          awareness.setLocalStateField("draggingColumn", {
            ...currentState.draggingColumn,
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
    if (isCollaborating && awareness) {
      awareness.setLocalStateField("draggingColumn", null);
    }
  }, [isCollaborating, awareness]);

  // Get all collaborators who are currently dragging columns (reactive)
  const draggingCollaborators = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }

    return collaborators.filter(
      (collab) =>
        collab.draggingColumn !== undefined && collab.draggingColumn !== null
    );
  }, [isCollaborating, collaborators]);

  // Get all columns currently being dragged by collaborators (reactive)
  const draggedColumns = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }

    return collaborators.flatMap((collab) => {
      if (!collab.draggingColumn) {
        return [];
      }
      return [
        {
          collaborator: collab,
          dragState: collab.draggingColumn,
        },
      ];
    });
  }, [isCollaborating, collaborators]);

  // Clear drag state on unmount
  useEffect(
    () => () => {
      if (isDraggingRef.current && awareness) {
        awareness.setLocalStateField("draggingColumn", null);
      }
    },
    [awareness]
  );

  return {
    startDragging,
    updateDragPosition,
    stopDragging,
    draggedColumns,
    draggingCollaborators,
    isCollaborating,
    localUser,
  };
}
