"use client";

import { memo } from "react";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useColumnDragPresence } from "@/src/hooks/use-column-drag-presence";
import { CollaboratorColumnDragOverlay } from "./collaborator-column-drag-overlay";

export const ColumnDragOverlayContainer = memo(() => {
  const { draggedColumns, isCollaborating } = useColumnDragPresence();
  const columns = useKanbanStore((state) => state.columns);

  if (!isCollaborating || draggedColumns.length === 0) {
    return null;
  }

  return (
    <>
      {draggedColumns.map(({ collaborator, dragState }) => {
        const column = columns.byId[dragState.columnId];
        if (!column) {
          return null;
        }

        return (
          <CollaboratorColumnDragOverlay
            collaborator={collaborator}
            columnName={column.name}
            cursorX={dragState.cursorX}
            cursorY={dragState.cursorY}
            key={`drag-overlay-col-${collaborator.id}-${dragState.columnId}`}
            taskCount={column.task_ids.length}
          />
        );
      })}
    </>
  );
});

ColumnDragOverlayContainer.displayName = "ColumnDragOverlayContainer";
