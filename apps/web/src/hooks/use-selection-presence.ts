import { useCallback, useEffect, useRef } from "react";
import { useCollaboration } from "@/src/features/collab";

export function useSelectionPresence() {
  const { isCollaborating, awareness, collaborators } = useCollaboration();
  const lastUpdateRef = useRef(0);

  const setSelectionBox = useCallback(
    (box: { x: number; y: number; width: number; height: number } | null) => {
      const awarenessObj = awareness;
      if (!(isCollaborating && awarenessObj)) {
        return;
      }

      // Throttle updates to ~40-50ms during drag
      const now = Date.now();
      if (box && now - lastUpdateRef.current < 40) {
        return;
      }
      lastUpdateRef.current = now;

      awarenessObj.setLocalStateField("selectionBox", box);
    },
    [isCollaborating, awareness]
  );

  useEffect(() => {
    // Clear selection box on unmount
    return () => {
      if (isCollaborating && awareness) {
        awareness.setLocalStateField("selectionBox", null);
      }
    };
  }, [isCollaborating, awareness]);

  return {
    setSelectionBox,
    collaborators,
  };
}
