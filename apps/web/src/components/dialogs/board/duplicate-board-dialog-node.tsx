"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Copy, GripHorizontal, Link2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

export interface DuplicateBoardDialogNodeData {
  dialogId: string;
  [key: string]: unknown;
}

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
    const boardQuickActions = useKanbanStore((state) =>
      dialog?.boardId ? state.boardQuickActions[dialog.boardId] : null
    );
    const board = useKanbanStore((state) =>
      dialog?.boardId ? state.boards.byId[dialog.boardId] : null
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `duplicate-board-dialog-${dialogId}`;

    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === zIndexDialogId;

    // Dialog presence for collaboration - auto-registers on mount, auto-cleans on unmount
    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(
        dialogId,
        "board-dialog",
        dialog?.boardId ?? ""
      );

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(zIndexDialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, zIndexDialogId]);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!(boardQuickActions && dialog?.position)) {
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
      // biome-ignore lint/a11y/noStaticElementInteractions: skip
      <div
        className={cn(
          "relative rounded-lg transition-all duration-200",
          selected || isFocused || isTopmost
            ? "scale-[1.02] shadow-xl"
            : "shadow-lg",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
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
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          portalTarget &&
          createPortal(
            <ConnectorEdge
              customColor={board?.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
              zIndex={connectorZIndex}
            />,
            portalTarget
          )}

        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        <div
          aria-labelledby={`dialog-title-${dialogId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card",
            selected || isFocused || isTopmost
              ? "ring-2 ring-primary/50"
              : "ring-1 ring-border/50"
          )}
          role="dialog"
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              board?.accentColor
                ? {
                    background: `linear-gradient(to right, ${board.accentColor}15, ${board.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/20 font-bold text-[10px] text-blue-600 dark:text-blue-400">
                <Copy className="h-3 w-3" />
              </span>
              <span className="font-semibold text-xs">Duplicate Board</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 items-center gap-1 rounded px-1.5 text-[10px]",
                  !board?.accentColor && "bg-primary/10 text-primary"
                )}
                style={
                  board?.accentColor
                    ? {
                        backgroundColor: `${board.accentColor}25`,
                        color: board.accentColor,
                      }
                    : {}
                }
              >
                {(() => {
                  const iconName = board?.icon;
                  const MappedIcon = iconName ? ICON_MAP[iconName] : undefined;
                  return MappedIcon ? (
                    <MappedIcon className="h-3 w-3" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/20 font-bold text-[9px]">
                      {getInitials(dialog.boardName)}
                    </span>
                  );
                })()}
                <span className="max-w-20 truncate">{dialog.boardName}</span>
              </span>
              <button
                aria-label="Close duplicate board dialog"
                className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                onClick={handleClose}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
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
                      This board has <strong>{connectionCount}</strong>{" "}
                      connection
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
      </div>
    );
  });

DuplicateBoardDialogNodeComponent.displayName = "DuplicateBoardDialogNode";
