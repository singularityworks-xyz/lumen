"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { AlertTriangle, GripHorizontal, Link2, Trash2, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type DeleteBoardDialogNodeData = {
  dialogId: string;
};

type DeleteBoardDialogNodeProps = NodeProps<Node<DeleteBoardDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const DeleteBoardDialogNodeComponent = memo<DeleteBoardDialogNodeProps>(
  ({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const removeBoard = useKanbanStore((state) => state.removeBoard);
    const removeConnection = useKanbanStore((state) => state.removeConnection);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
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
        y: boardQuickActions.position.y + 140,
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

      removeBoard(dialog.boardId);
      closeBoardDialog(dialogId);
    }, [
      dialog,
      dialogId,
      boardConnections,
      removeBoard,
      removeConnection,
      closeBoardDialog,
    ]);

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    if (!dialog || dialog.type !== "delete") {
      return null;
    }

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

        <div className="flex cursor-move select-none items-center justify-between border-destructive/20 border-b bg-destructive/10 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <Trash2 className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-destructive text-sm">
              Delete Board
            </h3>
          </div>
          <button
            aria-label="Close delete board dialog"
            className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
            onClick={handleClose}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="nodrag space-y-3 p-3">
          {/* Warning */}
          <div className="flex gap-2 rounded bg-destructive/10 p-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <p className="font-medium text-destructive">
                This action cannot be undone.
              </p>
              <p className="mt-1 text-muted-foreground">
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{dialog.boardName}</strong>?
              </p>
            </div>
          </div>

          {/* What will be deleted */}
          <div className="space-y-1 text-xs">
            <p className="font-medium text-muted-foreground">
              This will permanently delete:
            </p>
            <ul className="space-y-1 pl-4">
              <li className="text-foreground">
                • <strong>{columnCount}</strong> column
                {columnCount !== 1 && "s"}
              </li>
              <li className="text-foreground">
                • <strong>{taskCount}</strong> task{taskCount !== 1 && "s"}
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
            Delete Board
          </button>
        </div>
      </div>
    );
  }
);

DeleteBoardDialogNodeComponent.displayName = "DeleteBoardDialogNode";
