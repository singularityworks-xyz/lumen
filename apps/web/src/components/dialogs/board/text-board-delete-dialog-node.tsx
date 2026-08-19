"use client";

import type { Node, NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  ClipboardList,
  GripHorizontal,
  Link2,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { useImperativeConnector } from "@/src/hooks/use-imperative-connector";
import { cn } from "@/src/lib/utils";

export interface TextBoardDeleteDialogNodeData {
  dialogId: string;
  [key: string]: unknown;
}

type TextBoardDeleteDialogNodeProps = NodeProps<
  Node<TextBoardDeleteDialogNodeData>
>;

const DIALOG_WIDTH = 320;

export const TextBoardDeleteDialogNodeComponent =
  memo<TextBoardDeleteDialogNodeProps>(({ data, selected }) => {
    const [isFocused, setIsFocused] = useState(false);

    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const removeTextBoard = useKanbanStore((state) => state.removeTextBoard);
    const removeConnection = useKanbanStore((state) => state.removeConnection);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const textBoard = useKanbanStore((state) =>
      dialog?.boardId ? state.textBoards.byId[dialog.boardId] : null
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `text-board-delete-dialog-${dialogId}`;

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
      sourceSelector: `.react-flow__node[data-id="text-quick-actions-${dialog?.boardId}"]`,
      targetNodeId: `board-dialog-${dialogId}`,
      zIndex: connectorZIndex,
    });

    const handleConfirm = useCallback(() => {
      if (!dialog) {
        return;
      }

      const connectionsToRemove = boardConnections.allIds.filter((connId) => {
        const conn = boardConnections.byId[connId];
        return (
          conn?.source_board_id === dialog.boardId ||
          conn?.target_board_id === dialog.boardId
        );
      });

      for (const connId of connectionsToRemove) {
        removeConnection(connId);
      }

      removeTextBoard(dialog.boardId);
      closeBoardDialog(dialogId);
    }, [
      dialog,
      dialogId,
      boardConnections,
      removeTextBoard,
      removeConnection,
      closeBoardDialog,
    ]);

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    if (!dialog || dialog.type !== "delete") {
      return null;
    }

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
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        <div
          aria-labelledby={`dialog-title-${dialogId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card",
            selected || isFocused || isTopmost
              ? "ring-2 ring-destructive/50"
              : "ring-1 ring-border/50"
          )}
          data-testid="text-board-delete-dialog"
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
              <span className="flex h-5 w-5 items-center justify-center rounded bg-destructive/20 font-bold text-[10px] text-destructive">
                <Trash2 className="h-3 w-3" />
              </span>
              <span className="font-semibold text-destructive text-xs">
                Delete Text Board
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 items-center gap-1 rounded px-1.5 text-[10px]",
                  !textBoard?.accentColor &&
                    "bg-destructive/10 text-destructive"
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
                aria-label="Close delete text board dialog"
                className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                onClick={handleClose}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="nodrag space-y-3 p-3">
            <div className="flex gap-2 rounded bg-destructive/10 p-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <div className="text-xs">
                <p className="font-medium text-destructive">
                  This action cannot be undone.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground">
                    {dialog.boardName}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-medium text-muted-foreground">
                This will permanently delete:
              </p>
              <ul className="space-y-1 pl-4">
                <li className="flex items-center gap-1 text-foreground">
                  <ClipboardList className="h-3 w-3" />
                  All todo items and notes in this text board
                </li>
                {connectionCount > 0 && (
                  <li className="flex items-center gap-1 text-foreground">
                    <Link2 className="h-3 w-3" />
                    <strong>{connectionCount}</strong> connection
                    {connectionCount !== 1 && "s"}
                  </li>
                )}
              </ul>
            </div>
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
              className="flex-1 rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-destructive/90 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              onClick={handleConfirm}
              type="button"
            >
              Delete Text Board
            </button>
          </div>
        </div>
      </div>
    );
  });

TextBoardDeleteDialogNodeComponent.displayName = "TextBoardDeleteDialogNode";
