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
  Circle,
  Equal,
  GripHorizontal,
  Layout,
  Palette,
  Settings,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Slider } from "@/src/components/ui/slider";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import {
  ICON_MAP,
  incrementColorUsage,
  incrementIconUsage,
  QuickColorPicker,
  QuickIconPicker,
} from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";

type BoardPropertiesDialogNodeData = {
  dialogId: string;
};

type BoardPropertiesDialogNodeProps = NodeProps<
  Node<BoardPropertiesDialogNodeData>
>;

const DIALOG_WIDTH = 340;

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
    const updateBoardDialogUIState = useKanbanStore(
      (state) => state.updateBoardDialogUIState
    );

    // Get UI state from store (synced across collaborators)
    const expandedColumnId = dialog?.expandedColumnId ?? null;
    const activeTab = dialog?.activeTab ?? "progress";

    // Setter functions that update store (syncing to collaborators)
    const setExpandedColumnId = useCallback(
      (value: string | null) =>
        updateBoardDialogUIState(dialogId, { expandedColumnId: value }),
      [dialogId, updateBoardDialogUIState]
    );
    const setActiveTab = useCallback(
      (value: "progress" | "style") =>
        updateBoardDialogUIState(dialogId, { activeTab: value }),
      [dialogId, updateBoardDialogUIState]
    );
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspace = useKanbanStore((state) =>
      currentWorkspaceId ? state.workspaces.byId[currentWorkspaceId] : null
    );
    const updateWorkspace = useKanbanStore((state) => state.updateWorkspace);

    const updateBoard = useKanbanStore((state) => state.updateBoard);
    const openBoardDialog = useKanbanStore((state) => state.openBoardDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `properties-board-dialog-${dialogId}`;
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

    const boardColumns = useMemo(() => {
      if (!board) {
        return [];
      }
      return board.column_ids
        .map((colId) => columns.byId[colId])
        .filter((col): col is NonNullable<typeof col> => col !== undefined)
        .sort((a, b) => a.position - b.position);
    }, [board, columns]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: skip
    useEffect(() => {
      if (expandedColumnId === null && boardColumns.length > 0) {
        setExpandedColumnId(boardColumns[0]?.id ?? null);
      }
    }, [boardColumns, expandedColumnId]);

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

    const handleColorChange = useCallback(
      (colId: string, color: string) => {
        updateColumn(colId, { accentColor: color || undefined });
        if (currentWorkspaceId && color) {
          updateWorkspace(currentWorkspaceId, {
            colorUsage: incrementColorUsage(workspace?.colorUsage, color),
          });
        }
      },
      [updateColumn, currentWorkspaceId, workspace?.colorUsage, updateWorkspace]
    );

    const handleIconChange = useCallback(
      (colId: string, icon: string) => {
        updateColumn(colId, { icon: icon || undefined });
        if (currentWorkspaceId && icon) {
          updateWorkspace(currentWorkspaceId, {
            iconUsage: incrementIconUsage(workspace?.iconUsage, icon),
          });
        }
      },
      [updateColumn, currentWorkspaceId, workspace?.iconUsage, updateWorkspace]
    );

    const handleOpenExtendedPicker = useCallback(
      (colId: string) => {
        if (!(dialog && board)) {
          return;
        }
        openBoardDialog({
          type: "color-icon-picker",
          boardId: board.id,
          boardName: board.name,
          position: {
            x: dialog.position.x + DIALOG_WIDTH + 20,
            y: dialog.position.y,
          },
          columnId: colId,
          sourceDialogId: dialogId,
        });
      },
      [dialog, board, openBoardDialog, dialogId]
    );

    const handleBoardColorChange = useCallback(
      (color: string) => {
        if (!board) {
          return;
        }
        updateBoard(board.id, { accentColor: color || undefined });
        if (currentWorkspaceId && color) {
          updateWorkspace(currentWorkspaceId, {
            colorUsage: incrementColorUsage(workspace?.colorUsage, color),
          });
        }
      },
      [
        board,
        updateBoard,
        currentWorkspaceId,
        workspace?.colorUsage,
        updateWorkspace,
      ]
    );

    const handleBoardIconChange = useCallback(
      (icon: string) => {
        if (!board) {
          return;
        }
        updateBoard(board.id, { icon: icon || undefined });
        if (currentWorkspaceId && icon) {
          updateWorkspace(currentWorkspaceId, {
            iconUsage: incrementIconUsage(workspace?.iconUsage, icon),
          });
        }
      },
      [
        board,
        updateBoard,
        currentWorkspaceId,
        workspace?.iconUsage,
        updateWorkspace,
      ]
    );

    const handleOpenExtendedBoardPicker = useCallback(() => {
      if (!(dialog && board)) {
        return;
      }
      openBoardDialog({
        type: "color-icon-picker",
        boardId: board.id,
        boardName: board.name,
        position: {
          x: dialog.position.x + DIALOG_WIDTH + 20,
          y: dialog.position.y,
        },
        sourceDialogId: dialogId,
        targetType: "board",
      });
    }, [dialog, board, openBoardDialog, dialogId]);

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
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-primary">
                <Settings className="h-3 w-3" />
              </span>
              <span className="font-semibold text-xs">Properties</span>
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
                  const Icon = MappedIcon || Layout;
                  return <Icon className="h-3 w-3" />;
                })()}
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

          <div className="nodrag flex border-border/30 border-b bg-muted/30">
            <button
              className={cn(
                "flex-1 py-1.5 font-medium text-[11px] transition-colors",
                activeTab === "progress"
                  ? "border-primary border-b-2 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("progress")}
              type="button"
            >
              Progress
            </button>
            <button
              className={cn(
                "flex-1 py-1.5 font-medium text-[11px] transition-colors",
                activeTab === "style"
                  ? "border-primary border-b-2 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("style")}
              type="button"
            >
              <span className="flex items-center justify-center gap-1">
                <Palette className="h-3 w-3" />
                Style
              </span>
            </button>
          </div>

          <div className="nodrag flex gap-1 border-border/30 border-b bg-muted/50 px-3 py-2 dark:bg-secondary/50">
            {boardColumns.map((col) => {
              const value = columnProgressValues[col.id] ?? 0;
              const styles = getProgressStyles(value);
              const isSelected = expandedColumnId === col.id;
              const accentColor = col.accentColor;
              return (
                <button
                  className={cn(
                    "nodrag group relative flex-1 rounded px-0.5 py-1 transition-all hover:scale-105",
                    accentColor ? "" : styles.bg,
                    isSelected &&
                      "ring-1 ring-foreground/30 ring-offset-1 ring-offset-background"
                  )}
                  key={col.id}
                  onClick={() =>
                    setExpandedColumnId(isSelected ? null : col.id)
                  }
                  style={
                    accentColor ? { backgroundColor: `${accentColor}25` } : {}
                  }
                  title={`${col.name}: ${value}%`}
                  type="button"
                >
                  <div
                    className={cn(
                      "h-1.5 rounded-sm",
                      !accentColor && styles.fill
                    )}
                    style={
                      accentColor
                        ? {
                            backgroundColor: accentColor,
                            width: `${Math.max(value, 15)}%`,
                          }
                        : { width: `${Math.max(value, 15)}%` }
                    }
                  />
                  <span
                    className={cn(
                      "absolute inset-x-0 -bottom-3.5 text-center font-semibold text-[7px] opacity-0 transition-opacity group-hover:opacity-100",
                      !accentColor && styles.text
                    )}
                    style={accentColor ? { color: accentColor } : {}}
                  >
                    {value}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="nodrag p-2">
            {activeTab === "style" && (
              <div className="mb-3 space-y-3 rounded-md border border-border/30 bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                    Board Style
                  </span>
                  <button
                    className="text-[10px] text-primary hover:text-primary/80 hover:underline"
                    onClick={handleOpenExtendedBoardPicker}
                    type="button"
                  >
                    More...
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="mb-1 block text-[10px] text-muted-foreground opacity-70">
                      Accent
                    </span>
                    <QuickColorPicker
                      colorUsage={workspace?.colorUsage}
                      onChange={handleBoardColorChange}
                      onMoreClick={handleOpenExtendedBoardPicker}
                      value={board?.accentColor ?? ""}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] text-muted-foreground opacity-70">
                      Icon
                    </span>
                    <QuickIconPicker
                      accentColor={board?.accentColor}
                      iconUsage={workspace?.iconUsage}
                      onChange={handleBoardIconChange}
                      onMoreClick={handleOpenExtendedBoardPicker}
                      value={board?.icon ?? ""}
                    />
                  </div>
                </div>
              </div>
            )}
            {boardColumns.map((col, index) => {
              const value = columnProgressValues[col.id] ?? 0;
              const styles = getProgressStyles(value);
              const isExpanded = expandedColumnId === col.id;
              const accentColor = col.accentColor;
              const IconComponent = col.icon ? ICON_MAP[col.icon] : null;

              return (
                <div className="mb-1 last:mb-0" key={col.id}>
                  <button
                    className={cn(
                      "nodrag flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all",
                      "border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                      "hover:bg-muted dark:hover:bg-muted",
                      isExpanded && "border-primary/40 ring-1 ring-primary/20"
                    )}
                    onClick={() =>
                      setExpandedColumnId(isExpanded ? null : col.id)
                    }
                    type="button"
                  >
                    {accentColor || col.icon ? (
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                        style={
                          accentColor
                            ? {
                                backgroundColor: `${accentColor}25`,
                                color: accentColor,
                              }
                            : {}
                        }
                      >
                        {IconComponent ? (
                          <IconComponent
                            className="h-3 w-3"
                            style={accentColor ? { color: accentColor } : {}}
                          />
                        ) : (
                          <Circle
                            className="h-2.5 w-2.5"
                            style={
                              accentColor
                                ? { fill: accentColor, color: accentColor }
                                : {}
                            }
                          />
                        )}
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted-foreground/10 font-medium text-[9px] text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                    <span className="flex-1 truncate font-medium text-xs">
                      {col.name}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-semibold text-[10px] tabular-nums",
                        !accentColor && styles.bg,
                        !accentColor && styles.text
                      )}
                      style={
                        accentColor
                          ? {
                              backgroundColor: `${accentColor}25`,
                              color: accentColor,
                            }
                          : {}
                      }
                    >
                      {value}%
                    </span>
                    <div className="flex h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted-foreground/20">
                      <div
                        className={cn(
                          "transition-all",
                          !accentColor && styles.fill
                        )}
                        style={
                          accentColor
                            ? {
                                backgroundColor: accentColor,
                                width: `${value}%`,
                              }
                            : { width: `${value}%` }
                        }
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
                      {activeTab === "progress" ? (
                        <>
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
                                onClick={() =>
                                  handleProgressChange(col.id, preset)
                                }
                                type="button"
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <button
                            className="nodrag mb-1 w-full rounded-md border border-border/50 border-dashed bg-muted/30 py-1 text-center text-[10px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                            onClick={() => handleOpenExtendedPicker(col.id)}
                            type="button"
                          >
                            For more colors & icons, click{" "}
                            <span className="font-medium underline">here</span>
                          </button>
                          <div>
                            <span className="mb-1.5 block font-medium text-[10px] text-muted-foreground">
                              Accent Color
                            </span>
                            <QuickColorPicker
                              colorUsage={workspace?.colorUsage}
                              onChange={(color) =>
                                handleColorChange(col.id, color)
                              }
                              onMoreClick={() =>
                                handleOpenExtendedPicker(col.id)
                              }
                              value={col.accentColor ?? ""}
                            />
                          </div>
                          <div>
                            <span className="mb-1.5 block font-medium text-[10px] text-muted-foreground">
                              Icon
                            </span>
                            <QuickIconPicker
                              accentColor={col.accentColor}
                              iconUsage={workspace?.iconUsage}
                              onChange={(icon) =>
                                handleIconChange(col.id, icon)
                              }
                              onMoreClick={() =>
                                handleOpenExtendedPicker(col.id)
                              }
                              value={col.icon ?? ""}
                            />
                          </div>
                        </div>
                      )}
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
      </div>
    );
  });

BoardPropertiesDialogNodeComponent.displayName = "BoardPropertiesDialogNode";
