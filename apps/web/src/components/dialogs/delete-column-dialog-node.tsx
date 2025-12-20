"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { AlertTriangle, GripHorizontal } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type DeleteColumnDialogNodeData = {
  columnId: string;
};

type DeleteColumnDialogNodeProps = NodeProps<Node<DeleteColumnDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const DeleteColumnDialogNodeComponent =
  memo<DeleteColumnDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const columnDialog = useKanbanStore((state) => state.columnDialog);
    const deleteColumn = useKanbanStore((state) => state.deleteColumn);
    const closeColumnDialog = useKanbanStore(
      (state) => state.closeColumnDialog
    );
    const closeColumnQuickActions = useKanbanStore(
      (state) => state.closeColumnQuickActions
    );
    const columnQuickActions = useKanbanStore(
      (state) => state.columnQuickActions
    );
    const boardPositions = useKanbanStore((state) => state.boardPositions);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!columnDialog || columnDialog.columnId !== data.columnId) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: columnDialog.position.x,
        y: columnDialog.position.y,
      });

      // Try to connect to column quick actions first
      const quickActions = columnQuickActions?.[data.columnId];
      if (quickActions) {
        const sourceScreenPos = flowToScreenPosition({
          x: quickActions.position.x + 200, // Connect to right side of quick actions (width 200)
          y: quickActions.position.y + 20,
        });
        return {
          start: sourceScreenPos,
          end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
        };
      }

      // Fallback to board connection
      const boardPos = boardPositions.byId[columnDialog.boardId];
      if (!boardPos) {
        return null;
      }

      const sourceScreenPos = flowToScreenPosition({
        x: boardPos.x,
        y: boardPos.y + 100,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
      };
    }, [
      columnDialog,
      data.columnId,
      columnQuickActions,
      boardPositions,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleConfirm = useCallback(() => {
      if (columnDialog && columnDialog.type === "delete") {
        deleteColumn(columnDialog.boardId, columnDialog.columnId);
        closeColumnDialog();
        closeColumnQuickActions(columnDialog.columnId);
      }
    }, [
      columnDialog,
      deleteColumn,
      closeColumnDialog,
      closeColumnQuickActions,
    ]);

    const handleClose = useCallback(() => {
      closeColumnDialog();
    }, [closeColumnDialog]);

    if (
      !columnDialog ||
      columnDialog.type !== "delete" ||
      columnDialog.columnId !== data.columnId
    ) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`dialog-title-column-delete-${columnDialog.columnId}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        role="dialog"
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          createPortal(
            <ConnectorEdge
              color="destructive"
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              hideStartNode
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}

        <div className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-destructive/10 via-destructive/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2 overflow-hidden">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span className="shrink-0 font-semibold text-xs">Remove</span>
            <div className="h-3 w-px bg-border/60" />
            <span className="truncate font-medium text-destructive text-xs">
              {columnDialog.columnName}
            </span>
          </div>
          <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </div>

        <div className="nodrag p-4">
          <p className="text-card-foreground text-xs leading-relaxed">
            Permanently delete{" "}
            <span className="font-semibold">"{columnDialog.columnName}"</span>{" "}
            and all its tasks? This action cannot be undone.
          </p>
        </div>

        <div className="nodrag flex gap-2 border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <Button
            className="h-7 flex-1 rounded-md bg-card/80 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="h-7 flex-1 rounded-md bg-destructive/90 text-destructive-foreground text-xs shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-destructive dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
            onClick={handleConfirm}
            type="button"
          >
            Remove
          </Button>
        </div>
      </div>
    );
  });

DeleteColumnDialogNodeComponent.displayName = "DeleteColumnDialogNode";
