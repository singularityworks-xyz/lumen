"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Columns, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";

export interface DeleteColumnDialogNodeData {
  columnId: string;
  dialogId: string;
  [key: string]: unknown;
}

type DeleteColumnDialogNodeProps = NodeProps<Node<DeleteColumnDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const DeleteColumnDialogNodeComponent =
  memo<DeleteColumnDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const columnDialog = useKanbanStore(
      (state) => state.columnDialogs[data.dialogId]
    );
    const columns = useKanbanStore((state) => state.columns);
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

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `delete-column-dialog-${data.dialogId}`;

    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === zIndexDialogId;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(data.dialogId, "column-dialog", data.columnId);

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(zIndexDialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, zIndexDialogId]);

    const column = columnDialog ? columns.byId[columnDialog.columnId] : null;

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!columnDialog || columnDialog.columnId !== data.columnId) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: columnDialog.position.x,
        y: columnDialog.position.y,
      });

      const quickActions = columnQuickActions?.[data.columnId];
      if (quickActions) {
        const sourceScreenPos = flowToScreenPosition({
          x: quickActions.position.x + 200,
          y: quickActions.position.y + 20,
        });
        return {
          start: sourceScreenPos,
          end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
        };
      }

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
        closeColumnDialog(data.dialogId);
        closeColumnQuickActions(columnDialog.columnId);
      }
    }, [
      columnDialog,
      deleteColumn,
      closeColumnDialog,
      closeColumnQuickActions,
      data.dialogId,
    ]);

    const handleClose = useCallback(() => {
      closeColumnDialog(data.dialogId);
    }, [closeColumnDialog, data.dialogId]);

    if (
      !columnDialog ||
      columnDialog.type !== "delete" ||
      columnDialog.columnId !== data.columnId
    ) {
      return null;
    }

    return (
      <div className="relative rounded-lg" style={{ width: DIALOG_WIDTH }}>
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          aria-labelledby={`dialog-title-column-delete-${columnDialog.columnId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card transition-all duration-200",
            selected || isFocused || isTopmost
              ? "scale-[1.02] shadow-xl ring-2 ring-primary/50"
              : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onPointerDown={() => {
            bringDialogToFront(zIndexDialogId);
            handleDialogPointerDown();
          }}
          role="dialog"
        >
          {connectorState &&
            portalTarget &&
            createPortal(
              <ConnectorEdge
                color="destructive"
                customColor={column?.accentColor}
                endX={connectorState.end.x}
                endY={connectorState.end.y}
                hideStartNode
                startX={connectorState.start.x}
                startY={connectorState.start.y}
                zIndex={connectorZIndex}
              />,
              portalTarget
            )}

          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              column?.accentColor
                ? {
                    background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded",
                  !column?.accentColor &&
                    "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                )}
                style={
                  column?.accentColor
                    ? {
                        backgroundColor: `${column.accentColor}25`,
                        color: column.accentColor,
                      }
                    : {}
                }
              >
                {(() => {
                  const IconComponent = column?.icon
                    ? ICON_MAP[column.icon]
                    : null;
                  if (IconComponent) {
                    return <IconComponent className="h-3 w-3" />;
                  }
                  return <Columns className="h-3 w-3" />;
                })()}
              </span>
              <span className="font-semibold text-xs">Remove Column</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                  !column?.accentColor && "bg-destructive/10 text-destructive"
                )}
                style={
                  column?.accentColor
                    ? {
                        backgroundColor: `${column.accentColor}15`,
                        color: column.accentColor,
                      }
                    : {}
                }
              >
                <span className="max-w-20 truncate font-medium">
                  {columnDialog.columnName}
                </span>
              </span>
              <button
                aria-label="Close delete column dialog"
                className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                onClick={handleClose}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
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
              data-testid="column-delete-confirm"
              onClick={handleConfirm}
              type="button"
            >
              Remove
            </Button>
          </div>
        </div>
      </div>
    );
  });

DeleteColumnDialogNodeComponent.displayName = "DeleteColumnDialogNode";
