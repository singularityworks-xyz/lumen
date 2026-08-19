"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { ClipboardList, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { useImperativeConnector } from "@/src/hooks/use-imperative-connector";
import { cn } from "@/src/lib/utils";

export interface TextBoardRenameDialogNodeData {
  dialogId: string;
  [key: string]: unknown;
}

type TextBoardRenameDialogNodeProps = NodeProps<
  Node<TextBoardRenameDialogNodeData>
>;

const DIALOG_WIDTH = 320;

export const TextBoardRenameDialogNodeComponent =
  memo<TextBoardRenameDialogNodeProps>(({ data, selected }) => {
    const [isFocused, setIsFocused] = useState(false);

    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const updateTextBoard = useKanbanStore((state) => state.updateTextBoard);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const updateBoardDialogInputValue = useKanbanStore(
      (state) => state.updateBoardDialogInputValue
    );
    const updateBoardDialogDescriptionValue = useKanbanStore(
      (state) => state.updateBoardDialogDescriptionValue
    );
    const textBoard = useKanbanStore((state) =>
      dialog?.boardId ? state.textBoards.byId[dialog.boardId] : null
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `text-board-rename-dialog-${dialogId}`;

    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === zIndexDialogId;

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

    useImperativeConnector({
      customColor: textBoard?.accentColor,
      endOffsetY: 20,
      hideStartNode: true,
      sourceSelector: `.react-flow__node[data-id="text-quick-actions-${dialog?.boardId}"]`,
      targetNodeId: `board-dialog-${dialogId}`,
      zIndex: connectorZIndex,
    });

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (!dialog) {
          return;
        }
        const name = dialog.inputValue?.trim();
        const description = dialog.descriptionValue;
        const updates: { description?: string; name?: string } = {};

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
          updateTextBoard(dialog.boardId, updates);
        }
        closeBoardDialog(dialogId);
      },
      [dialog, dialogId, updateTextBoard, closeBoardDialog]
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
          data-testid="text-board-rename-dialog"
          role="dialog"
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              textBoard?.accentColor
                ? {
                    background: `linear-gradient(to right, ${textBoard.accentColor}15, ${textBoard.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                <ClipboardList className="h-3 w-3" />
              </span>
              <span className="font-semibold text-xs">Rename Text Board</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 items-center gap-1 rounded px-1.5 text-[10px]",
                  !textBoard?.accentColor && "bg-primary/10 text-primary"
                )}
                style={
                  textBoard?.accentColor
                    ? {
                        backgroundColor: `${textBoard.accentColor}25`,
                        color: textBoard.accentColor,
                      }
                    : {}
                }
              >
                <ClipboardList className="h-3 w-3" />
                <span className="max-w-20 truncate">{dialog.boardName}</span>
              </span>
              <button
                aria-label="Close rename text board dialog"
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
                  <ClipboardList className="h-3 w-3" />
                  {dialog.boardName}
                </span>
              </div>

              <Input
                autoFocus
                className="h-8 rounded-md border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`text-board-name-${dialogId}`}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="New text board name"
                value={dialog.inputValue ?? dialog.boardName}
              />

              <textarea
                className="min-h-16 w-full resize-none rounded-md border border-border/30 bg-muted/80 px-3 py-2 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`text-board-description-${dialogId}`}
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
  });

TextBoardRenameDialogNodeComponent.displayName = "TextBoardRenameDialogNode";
