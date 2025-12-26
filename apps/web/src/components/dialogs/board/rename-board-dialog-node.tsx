"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { GripHorizontal, Layout, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
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

type RenameBoardDialogNodeData = {
  dialogId: string;
};

type RenameBoardDialogNodeProps = NodeProps<Node<RenameBoardDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const RenameBoardDialogNodeComponent = memo<RenameBoardDialogNodeProps>(
  ({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const updateBoard = useKanbanStore((state) => state.updateBoard);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const updateBoardDialogInputValue = useKanbanStore(
      (state) => state.updateBoardDialogInputValue
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
    const zIndexDialogId = `rename-board-dialog-${dialogId}`;
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
        y: boardQuickActions.position.y + 60,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 20 },
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
        const name = dialog.inputValue?.trim();
        const description = dialog.descriptionValue;
        const updates: { name?: string; description?: string } = {};

        if (name && name !== dialog.boardName) {
          updates.name = name;
        }
        if (
          description !== undefined &&
          description !== dialog.boardDescription
        ) {
          updates.description = description;
        }

        if (Object.keys(updates).length > 0) {
          updateBoard(dialog.boardId, updates);
        }
        closeBoardDialog(dialogId);
      },
      [dialog, dialogId, updateBoard, closeBoardDialog]
    );

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    const handleNameChange = useCallback(
      (value: string) => {
        updateBoardDialogInputValue(dialogId, value);
      },
      [dialogId, updateBoardDialogInputValue]
    );

    const updateBoardDialogDescriptionValue = useKanbanStore(
      (state) => state.updateBoardDialogDescriptionValue
    );

    const handleDescriptionChange = useCallback(
      (value: string) => {
        updateBoardDialogDescriptionValue(dialogId, value);
      },
      [dialogId, updateBoardDialogDescriptionValue]
    );

    if (!dialog || dialog.type !== "rename") {
      return null;
    }

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
              color="primary"
              customColor={board?.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              hideStartNode
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
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                <Layout className="h-3 w-3" />
              </span>
              <span className="font-semibold text-xs">Rename Board</span>
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
                aria-label="Close rename board dialog"
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
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span>Current:</span>
                <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary">
                  <Layout className="h-3 w-3" />
                  {dialog.boardName}
                </span>
              </div>

              <Input
                autoFocus
                className="h-8 rounded-md border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`board-name-${dialogId}`}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="New board name"
                value={dialog.inputValue ?? dialog.boardName}
              />

              <textarea
                className="min-h-16 w-full resize-none rounded-md border border-border/30 bg-muted/80 px-3 py-2 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`board-description-${dialogId}`}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Description (optional)"
                value={dialog.descriptionValue ?? dialog.boardDescription ?? ""}
              />
            </div>

            <div className="nodrag flex gap-2 border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
              <Button
                className="h-7 flex-1 rounded-md bg-card/80 px-3 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                onClick={handleClose}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="h-7 flex-1 rounded-md bg-primary/90 px-3 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
                disabled={!dialog.inputValue?.trim()}
                type="submit"
              >
                Rename
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

RenameBoardDialogNodeComponent.displayName = "RenameBoardDialogNode";
