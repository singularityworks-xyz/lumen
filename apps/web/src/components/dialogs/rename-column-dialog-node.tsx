"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Columns, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

type RenameColumnDialogNodeData = {
  columnId: string;
};

type RenameColumnDialogNodeProps = NodeProps<Node<RenameColumnDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const RenameColumnDialogNodeComponent =
  memo<RenameColumnDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const columnDialog = useKanbanStore((state) => state.columnDialog);
    const updateColumn = useKanbanStore((state) => state.updateColumn);
    const closeColumnDialog = useKanbanStore(
      (state) => state.closeColumnDialog
    );
    const updateColumnDialogInputValue = useKanbanStore(
      (state) => state.updateColumnDialogInputValue
    );
    const updateColumnDialogDescriptionValue = useKanbanStore(
      (state) => state.updateColumnDialogDescriptionValue
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

      const quickActions = columnQuickActions?.[data.columnId];
      if (quickActions) {
        const sourceScreenPos = flowToScreenPosition({
          x: quickActions.position.x + 200,
          y: quickActions.position.y + 20,
        });
        return {
          start: sourceScreenPos,
          end: { x: myScreenPos.x, y: myScreenPos.y + 20 },
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
        end: { x: myScreenPos.x, y: myScreenPos.y + 20 },
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

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (!columnDialog) {
          return;
        }
        const name = columnDialog.inputValue?.trim();
        const description = columnDialog.descriptionValue?.trim();

        if (name) {
          updateColumn(columnDialog.columnId, { name, description });
        }
        closeColumnDialog();
      },
      [columnDialog, updateColumn, closeColumnDialog]
    );

    const handleClose = useCallback(() => {
      closeColumnDialog();
    }, [closeColumnDialog]);

    const handleNameChange = useCallback(
      (value: string) => {
        updateColumnDialogInputValue(value);
      },
      [updateColumnDialogInputValue]
    );

    const handleDescriptionChange = useCallback(
      (value: string) => {
        updateColumnDialogDescriptionValue(value);
      },
      [updateColumnDialogDescriptionValue]
    );

    if (
      !columnDialog ||
      columnDialog.type !== "rename" ||
      columnDialog.columnId !== data.columnId
    ) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`dialog-title-column-${columnDialog.columnId}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-lg ring-1 ring-border/50",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
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

        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-500/20 font-bold text-[10px] text-violet-600 dark:text-violet-400">
              <Columns className="h-3 w-3" />
            </span>
            <span className="font-semibold text-xs">Rename Column</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] text-primary">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/20 font-bold text-[9px]">
                {getInitials(columnDialog.boardName)}
              </span>
              <span className="max-w-20 truncate">
                {columnDialog.boardName}
              </span>
            </span>
            <button
              aria-label="Close rename column dialog"
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
              <span className="flex items-center gap-1 rounded bg-violet-500/10 px-2 py-0.5 text-violet-600 dark:text-violet-400">
                <Columns className="h-3 w-3" />
                {columnDialog.columnName}
              </span>
            </div>

            <Label
              className="sr-only"
              htmlFor={`column-name-${columnDialog.columnId}`}
            >
              New column name
            </Label>
            <Input
              autoFocus
              className="h-8 rounded-md border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
              id={`column-name-${columnDialog.columnId}`}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="New column name"
              value={columnDialog.inputValue ?? columnDialog.columnName}
            />

            <Label
              className="sr-only"
              htmlFor={`column-description-${columnDialog.columnId}`}
            >
              Description (optional)
            </Label>
            <Textarea
              className="min-h-15 resize-none rounded-md border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
              id={`column-description-${columnDialog.columnId}`}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Description (optional)"
              value={
                columnDialog.descriptionValue ??
                columnDialog.columnDescription ??
                ""
              }
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
              disabled={!columnDialog.inputValue?.trim()}
              type="submit"
            >
              Rename
            </Button>
          </div>
        </form>
      </div>
    );
  });

RenameColumnDialogNodeComponent.displayName = "RenameColumnDialogNode";
