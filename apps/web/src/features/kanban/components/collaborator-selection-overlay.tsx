"use client";

import { memo } from "react";
import type { Collaborator } from "@/src/features/collab/collab-provider";
import { cn } from "@/src/lib/utils";

type CollaboratorSelectionOverlayProps = {
  // We can optionally pass flowToScreenPosition if we need screen coords,
  // but if we render this inside React Flow viewport, we can use flow coords directly.
  // Assuming this is rendered INSIDE React Flow zoom pane:
  // Coordinates (x, y, width, height) are likely flow coordinates if they came from OnSelectionDrag events.
  // Wait, React Flow's onSelectionDrag usually gives Flow coordinates? No, often screen/client.
  // Canvas.tsx logic must normalize.
  collaborators: Collaborator[];
};

export const CollaboratorSelectionOverlay =
  memo<CollaboratorSelectionOverlayProps>(({ collaborators }) => {
    // Only show collaborators who have a selection box
    const activeSelections = collaborators.filter(
      (c) =>
        c.selectionBox && c.selectionBox.width > 0 && c.selectionBox.height > 0
    );

    if (activeSelections.length === 0) {
      return null;
    }

    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        {activeSelections.map((c) => {
          if (!c.selectionBox) {
            return null;
          }

          return (
            <div
              className={cn("absolute rounded border opacity-50")}
              key={c.id}
              style={{
                left: c.selectionBox.x,
                top: c.selectionBox.y,
                width: c.selectionBox.width,
                height: c.selectionBox.height,
                backgroundColor: `${c.color}20`,
                borderColor: c.color,
                borderWidth: 1,
              }}
            >
              <div
                className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-medium text-[10px] text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </div>
            </div>
          );
        })}
      </div>
    );
  });

CollaboratorSelectionOverlay.displayName = "CollaboratorSelectionOverlay";
