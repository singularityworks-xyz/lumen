"use client";

import { memo, type RefObject } from "react";
import type { Collaborator } from "@/src/features/collab/collab-provider";

interface CollaboratorSelectionOverlayScreenProps {
  collaborators: Collaborator[];
  containerRef: RefObject<HTMLDivElement | null>;
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

export const CollaboratorSelectionOverlayScreen =
  memo<CollaboratorSelectionOverlayScreenProps>(
    ({ collaborators, containerRef, flowToScreenPosition }) => {
      const activeSelections = collaborators.filter(
        (c) =>
          c.selectionBox &&
          c.selectionBox.width > 0 &&
          c.selectionBox.height > 0
      );

      if (activeSelections.length === 0 || !containerRef.current) {
        return null;
      }

      const containerRect = containerRef.current.getBoundingClientRect();

      return (
        <div className="pointer-events-none absolute inset-0 z-10">
          {activeSelections.map((c) => {
            if (!c.selectionBox) {
              return null;
            }

            // Convert flow coordinates to screen coordinates
            const screenTopLeft = flowToScreenPosition({
              x: c.selectionBox.x,
              y: c.selectionBox.y,
            });
            const screenBottomRight = flowToScreenPosition({
              x: c.selectionBox.x + c.selectionBox.width,
              y: c.selectionBox.y + c.selectionBox.height,
            });

            // Make relative to container
            const left = screenTopLeft.x - containerRect.left;
            const top = screenTopLeft.y - containerRect.top;
            const width = screenBottomRight.x - screenTopLeft.x;
            const height = screenBottomRight.y - screenTopLeft.y;

            return (
              <div
                className="absolute rounded border-2 border-dashed"
                key={c.id}
                style={{
                  left,
                  top,
                  width,
                  height,
                  backgroundColor: `${c.color}15`,
                  borderColor: c.color,
                }}
              >
                <div
                  className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-medium text-[10px] text-white"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  );

CollaboratorSelectionOverlayScreen.displayName =
  "CollaboratorSelectionOverlayScreen";
