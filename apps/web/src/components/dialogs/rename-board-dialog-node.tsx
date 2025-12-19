"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { GripHorizontal, Layout, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type RenameBoardDialogNodeData = {
  dialogId: string;
};

type RenameBoardDialogNodeProps = NodeProps<Node<RenameBoardDialogNodeData>>;

const DIALOG_WIDTH = 380;

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
        y: boardQuickActions.position.y + 60,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
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
        const name = dialog.inputValue?.trim();
        if (name && name !== dialog.boardName) {
          updateBoard(dialog.boardId, { name });
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

    if (!dialog || dialog.type !== "rename") {
      return null;
    }

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
              color="primary"
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              hideStartNode
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}

        <div className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Rename Board</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
              <Layout className="h-3 w-3" />
              {dialog.boardName}
            </span>
            <button
              aria-label="Close rename board dialog"
              className="nodrag rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="nodrag p-4">
            <div className="space-y-2">
              <Label
                className="text-muted-foreground text-xs"
                htmlFor={`board-name-${dialogId}`}
              >
                Board Name
              </Label>
              <Input
                autoFocus
                className="rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id={`board-name-${dialogId}`}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Board name"
                value={dialog.inputValue ?? dialog.boardName}
              />
            </div>
          </div>

          <div className="nodrag flex justify-end gap-2 border-t bg-muted/30 px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <Button
              className="h-8 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              onClick={handleClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              disabled={!dialog.inputValue?.trim()}
              type="submit"
            >
              Rename
            </Button>
          </div>
        </form>
      </div>
    );
  }
);

RenameBoardDialogNodeComponent.displayName = "RenameBoardDialogNode";
