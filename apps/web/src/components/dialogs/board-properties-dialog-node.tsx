"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  ChevronDown,
  ChevronUp,
  Equal,
  GripHorizontal,
  Layout,
  Settings,
  X,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Slider } from "@/src/components/ui/slider";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type BoardPropertiesDialogNodeData = {
  dialogId: string;
};

type BoardPropertiesDialogNodeProps = NodeProps<
  Node<BoardPropertiesDialogNodeData>
>;

const DIALOG_WIDTH = 320;

function getProgressStyles(progress: number) {
  if (progress === 0) {
    return { bg: "bg-zinc-500/15", text: "text-zinc-500", fill: "bg-zinc-400" };
  }
  if (progress <= 25) {
    return { bg: "bg-rose-500/15", text: "text-rose-500", fill: "bg-rose-500" };
  }
  if (progress <= 50) {
    return {
      bg: "bg-amber-500/15",
      text: "text-amber-500",
      fill: "bg-amber-500",
    };
  }
  if (progress <= 75) {
    return { bg: "bg-sky-500/15", text: "text-sky-500", fill: "bg-sky-500" };
  }
  return {
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
    fill: "bg-emerald-500",
  };
}

export const BoardPropertiesDialogNodeComponent =
  memo<BoardPropertiesDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const [expandedColumnId, setExpandedColumnId] = useState<string | null>(
      null
    );

    const dialogId = data.dialogId;
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);
    const boardQuickActions = useKanbanStore((state) =>
      dialog ? state.boardQuickActions[dialog.boardId] : null
    );
    const board = useKanbanStore((state) =>
      dialog ? state.boards.byId[dialog.boardId] : null
    );
    const columns = useKanbanStore((state) => state.columns);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const updateColumn = useKanbanStore((state) => state.updateColumn);
    const updateBoardDialogColumnProgress = useKanbanStore(
      (state) => state.updateBoardDialogColumnProgress
    );

    const boardColumns = useMemo(() => {
      if (!board) {
        return [];
      }
      return board.column_ids
        .map((colId) => columns.byId[colId])
        .filter((col): col is NonNullable<typeof col> => col !== undefined)
        .sort((a, b) => a.position - b.position);
    }, [board, columns]);

    const columnProgressValues = useMemo(() => {
      const values: Record<string, number> = {};
      for (const col of boardColumns) {
        const dialogValue = dialog?.columnProgressValues?.[col.id];
        values[col.id] = dialogValue ?? col.progressValue ?? 0;
      }
      return values;
    }, [boardColumns, dialog?.columnProgressValues]);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };
      if (!(dialog?.position && boardQuickActions)) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: dialog.position.x,
        y: dialog.position.y,
      });
      const sourceScreenPos = flowToScreenPosition({
        x: boardQuickActions.position.x + 220,
        y: boardQuickActions.position.y + 24,
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

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    const handleProgressChange = useCallback(
      (columnId: string, value: number) => {
        const clamped = Math.max(0, Math.min(100, value));
        updateBoardDialogColumnProgress(dialogId, columnId, clamped);
      },
      [dialogId, updateBoardDialogColumnProgress]
    );

    const handleAutoDistribute = useCallback(() => {
      const count = boardColumns.length;
      if (count === 0) {
        return;
      }

      for (let i = 0; i < count; i++) {
        const col = boardColumns[i];
        if (col) {
          const value = count === 1 ? 100 : Math.round((i * 100) / (count - 1));
          updateBoardDialogColumnProgress(dialogId, col.id, value);
        }
      }
    }, [boardColumns, dialogId, updateBoardDialogColumnProgress]);

    const handleSave = useCallback(() => {
      for (const col of boardColumns) {
        const newValue = columnProgressValues[col.id];
        if (newValue !== col.progressValue) {
          updateColumn(col.id, { progressValue: newValue });
        }
      }
      closeBoardDialog(dialogId);
    }, [
      boardColumns,
      columnProgressValues,
      updateColumn,
      closeBoardDialog,
      dialogId,
    ]);

    if (!dialog || dialog.type !== "properties") {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`dialog-title-${dialogId}`}
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
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-primary">
              <Settings className="h-3 w-3" />
            </span>
            <span className="font-semibold text-xs">Column Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] text-primary">
              <Layout className="h-3 w-3" />
              <span className="max-w-16 truncate">{dialog.boardName}</span>
            </span>
            <button
              aria-label="Close"
              className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={handleClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="nodrag flex gap-1 border-border/30 border-b bg-muted/50 px-3 py-2 dark:bg-secondary/50">
          {boardColumns.map((col) => {
            const value = columnProgressValues[col.id] ?? 0;
            const styles = getProgressStyles(value);
            const isSelected = expandedColumnId === col.id;
            return (
              <button
                className={cn(
                  "nodrag group relative flex-1 rounded px-0.5 py-1 transition-all hover:scale-105",
                  styles.bg,
                  isSelected &&
                    "ring-1 ring-foreground/30 ring-offset-1 ring-offset-background"
                )}
                key={col.id}
                onClick={() => setExpandedColumnId(isSelected ? null : col.id)}
                title={`${col.name}: ${value}%`}
                type="button"
              >
                <div
                  className={cn("h-1.5 rounded-sm", styles.fill)}
                  style={{ width: `${Math.max(value, 15)}%` }}
                />
                <span
                  className={cn(
                    "absolute inset-x-0 -bottom-3.5 text-center font-semibold text-[7px] opacity-0 transition-opacity group-hover:opacity-100",
                    styles.text
                  )}
                >
                  {value}%
                </span>
              </button>
            );
          })}
        </div>

        <div className="nodrag max-h-64 overflow-y-auto p-2">
          {boardColumns.map((col, index) => {
            const value = columnProgressValues[col.id] ?? 0;
            const styles = getProgressStyles(value);
            const isExpanded = expandedColumnId === col.id;

            return (
              <div className="mb-1 last:mb-0" key={col.id}>
                <button
                  className={cn(
                    "nodrag flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all",
                    "border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    "dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]",
                    "hover:bg-muted dark:hover:bg-muted",
                    isExpanded && "border-primary/40 ring-1 ring-primary/20"
                  )}
                  onClick={() =>
                    setExpandedColumnId(isExpanded ? null : col.id)
                  }
                  type="button"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted-foreground/10 font-medium text-[9px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate font-medium text-xs">
                    {col.name}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-semibold text-[10px] tabular-nums",
                      styles.bg,
                      styles.text
                    )}
                  >
                    {value}%
                  </span>
                  <div className="flex h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted-foreground/20">
                    <div
                      className={cn("transition-all", styles.fill)}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-1 rounded-md border border-border/30 bg-muted/80 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]">
                    <Slider
                      className="nodrag **:data-[slot=slider-thumb]:h-5 **:data-[slot=slider-thumb]:w-5 **:data-[slot=slider-thumb]:border-0 **:data-[slot=slider-thumb]:bg-foreground **:data-[slot=slider-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.1)] dark:**:data-[slot=slider-thumb]:bg-muted-foreground dark:**:data-[slot=slider-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]"
                      max={100}
                      min={0}
                      onValueChange={(vals) =>
                        handleProgressChange(col.id, vals[0] ?? 0)
                      }
                      step={5}
                      value={[value]}
                    />
                    <div className="mt-2 flex gap-1">
                      {[0, 25, 50, 75, 100].map((preset) => (
                        <button
                          className={cn(
                            "nodrag flex-1 rounded py-1 font-medium text-[10px] transition-all",
                            value === preset
                              ? cn(
                                  getProgressStyles(preset).bg,
                                  getProgressStyles(preset).text
                                )
                              : "bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20"
                          )}
                          key={preset}
                          onClick={() => handleProgressChange(col.id, preset)}
                          type="button"
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="nodrag flex gap-2 border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <button
            className="nodrag flex h-6 items-center justify-center gap-1 rounded-md bg-muted px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={handleAutoDistribute}
            title="Distribute 0% → 100% evenly"
            type="button"
          >
            <Equal className="h-3 w-3" />
            Auto
          </button>
          <div className="flex-1" />
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
            onClick={handleSave}
            type="button"
          >
            Save
          </Button>
        </div>
      </div>
    );
  });

BoardPropertiesDialogNodeComponent.displayName = "BoardPropertiesDialogNode";
