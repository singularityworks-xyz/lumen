"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type DraggingBoardState,
  useCollaboration,
} from "@/src/features/collab";

interface BoardDragAwarenessState {
  draggingBoard?: DraggingBoardState | null;
}

export function useBoardDragPresence() {
  const { isCollaborating, awareness, collaborators } = useCollaboration();
  const isDraggingRef = useRef(false);
  const lastUpdateRef = useRef(0);

  const startDragging = useCallback(
    (state: DraggingBoardState) => {
      isDraggingRef.current = true;
      if (isCollaborating && awareness) {
        awareness.setLocalStateField("draggingBoard", state);
      }
    },
    [isCollaborating, awareness]
  );

  const updateDragPosition = useCallback(
    (x: number, y: number, cursorX?: number, cursorY?: number) => {
      if (!isDraggingRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastUpdateRef.current < 24) {
        return;
      }
      lastUpdateRef.current = now;
      if (isCollaborating && awareness) {
        const local =
          awareness.getLocalState() as BoardDragAwarenessState | null;
        const prev = local?.draggingBoard;
        if (prev) {
          awareness.setLocalStateField("draggingBoard", {
            ...prev,
            x,
            y,
            cursorX: cursorX ?? prev.cursorX,
            cursorY: cursorY ?? prev.cursorY,
          });
        }
      }
    },
    [isCollaborating, awareness]
  );

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    if (isCollaborating && awareness) {
      awareness.setLocalStateField("draggingBoard", null);
    }
  }, [isCollaborating, awareness]);

  const draggingBoards = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }
    return collaborators.flatMap((c) => {
      if (!c.draggingBoard) {
        return [];
      }
      return [{ collaborator: c, dragState: c.draggingBoard }];
    });
  }, [isCollaborating, collaborators]);

  // Live positions keyed by id for viewport consumers (e.g. guests)
  const livePositions = useMemo(() => {
    const map = new Map<string, DraggingBoardState>();
    for (const { dragState } of draggingBoards) {
      map.set(dragState.id, dragState);
    }
    return map;
  }, [draggingBoards]);

  useEffect(
    () => () => {
      if (isDraggingRef.current && awareness) {
        awareness.setLocalStateField("draggingBoard", null);
      }
    },
    [awareness]
  );

  return {
    startDragging,
    updateDragPosition,
    stopDragging,
    draggingBoards,
    livePositions,
    isCollaborating,
  };
}
