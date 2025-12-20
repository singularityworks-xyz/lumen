"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Copy, GripHorizontal, Link2, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type DuplicateBoardDialogNodeData = {
  dialogId: string;
};

type DuplicateBoardDialogNodeProps = NodeProps<
  Node<DuplicateBoardDialogNodeData>
>;

const DIALOG_WIDTH = 320;

export const DuplicateBoardDialogNodeComponent =
  memo<DuplicateBoardDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const duplicateBoard = useKanbanStore((state) => state.duplicateBoard);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);

    const updateBoardDialogNewName = useKanbanStore(
      (state) => state.updateBoardDialogNewName
    );
    const updateBoardDialogCopyConnections = useKanbanStore(
      (state) => state.updateBoardDialogCopyConnections
    );
    const boardQuickActions = useKanbanStore(
      (state) => state.boardQuickActions
    );

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (
        !boardQuickActions ||
        boardQuickActions.boardId !== dialog?.boardId ||
        !dialog.position
      ) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: dialog.position.x,
        y: dialog.position.y,
      });

      const sourceWidth = 220;
      const sourceScreenPos = flowToScreenPosition({
        x: boardQuickActions.position.x + sourceWidth,
        y: boardQuickActions.position.y + 100,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      dialog?.boardId,
      dialog?.position,
      boardQuickActions,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (!dialog) {
          return;
        }
        const name = dialog.newName?.trim();
        if (!name) {
          return;
        }
        duplicateBoard(dialog.boardId, name, {
          copyConnections: dialog.copyConnections ?? false,
        });
        closeBoardDialog(dialogId);
      },
      [dialog, dialogId, duplicateBoard, closeBoardDialog]
    );

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    if (!dialog || dialog.type !== "duplicate") {
      return null;
    }

    const newName = dialog.newName ?? `${dialog.boardName} (Copy)`;
    const copyConnections = dialog.copyConnections ?? false;
    const columnCount = dialog.columnCount ?? 0;
    const taskCount = dialog.taskCount ?? 0;
    const connectionCount = dialog.connectionCount ?? 0;

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`dialog-title-${dialogId}`}
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
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}

        <div className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <Copy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Duplicate Board</h3>
          </div>
          <button
            aria-label="Close duplicate board dialog"
            className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
            onClick={handleClose}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="nodrag space-y-3 p-3">
            <div className="flex gap-4 rounded bg-muted/50 px-3 py-2 text-xs">
              <span>
                <strong>{columnCount}</strong> columns
              </span>
              <span>
                <strong>{taskCount}</strong> tasks
              </span>
            </div>

            <div className="space-y-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor={`duplicate-name-${dialogId}`}
              >
                New name
              </label>
              <input
                autoFocus
                className="w-full rounded-lg border border-border/30 bg-muted/80 px-3 py-1.5 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`duplicate-name-${dialogId}`}
                onChange={(e) =>
                  updateBoardDialogNewName(dialogId, e.target.value)
                }
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                type="text"
                value={newName}
              />
            </div>

            {connectionCount > 0 && (
              <div className="space-y-2 rounded-lg border border-border/30 bg-muted/50 p-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-2 text-xs">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    This board has <strong>{connectionCount}</strong> connection
                    {connectionCount > 1 ? "s" : ""}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    checked={copyConnections}
                    className="h-4 w-4 rounded border-border"
                    onChange={(e) =>
                      updateBoardDialogCopyConnections(
                        dialogId,
                        e.target.checked
                      )
                    }
                    type="checkbox"
                  />
                  <span className="text-xs">
                    Create connections to same targets for duplicate
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="nodrag flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
            <button
              className="flex-1 rounded-md bg-card/80 px-3 py-1.5 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              onClick={handleClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-md bg-primary/90 px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              type="submit"
            >
              Duplicate
            </button>
          </div>
        </form>
      </div>
    );
  });

DuplicateBoardDialogNodeComponent.displayName = "DuplicateBoardDialogNode";
