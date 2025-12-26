"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  AlertTriangle,
  GripHorizontal,
  Kanban,
  MoveRight,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ModalScaleProvider,
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "@/src/components/scaled-dropdown";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { cn } from "@/src/lib/utils";

type MoveColumnDialogNodeData = {
  columnId: string;
  dialogId: string;
};

type MoveColumnDialogNodeProps = NodeProps<Node<MoveColumnDialogNodeData>>;

const DIALOG_WIDTH = 320;

export const MoveColumnDialogNodeComponent = memo<MoveColumnDialogNodeProps>(
  ({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const [targetBoardId, setTargetBoardId] = useState<string>("");
    const [conflictMode, setConflictMode] = useState<"none" | "conflict">(
      "none"
    );
    const [existingColumnId, setExistingColumnId] = useState<string | null>(
      null
    );

    const columnDialog = useKanbanStore(
      (state) => state.columnDialogs[data.dialogId]
    );
    const boards = useKanbanStore((state) => state.boards);
    const columnsStore = useKanbanStore((state) => state.columns);
    const columnQuickActions = useKanbanStore(
      (state) => state.columnQuickActions
    );
    const boardPositions = useKanbanStore((state) => state.boardPositions);

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `move-column-dialog-${data.dialogId}`;

    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === zIndexDialogId;

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(zIndexDialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, zIndexDialogId]);

    const moveColumnToBoard = useKanbanStore(
      (state) => state.moveColumnToBoard
    );
    const updateColumn = useKanbanStore((state) => state.updateColumn);
    const deleteColumn = useKanbanStore((state) => state.deleteColumn);
    const closeColumnDialog = useKanbanStore(
      (state) => state.closeColumnDialog
    );
    const closeColumnQuickActions = useKanbanStore(
      (state) => state.closeColumnQuickActions
    );

    const column = columnDialog
      ? columnsStore.byId[columnDialog.columnId]
      : null;

    const availableTargetBoards = useMemo(() => {
      if (!columnDialog) {
        return [];
      }
      const sourceBoard = boards.byId[columnDialog.boardId];
      const workspaceId = sourceBoard?.workspace_id;
      return boards.allIds
        .map((id) => boards.byId[id])
        .filter((board): board is NonNullable<typeof board> => {
          if (!board || board.id === columnDialog.boardId) {
            return false;
          }
          if (!workspaceId) {
            return true;
          }
          return board.workspace_id === workspaceId;
        });
    }, [boards, columnDialog]);

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
          end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
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
        end: { x: myScreenPos.x, y: myScreenPos.y + 30 },
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

    const handleConfirm = useCallback(() => {
      if (columnDialog && columnDialog.type === "move" && targetBoardId) {
        const targetBoard = boards.byId[targetBoardId];
        const sourceColumnName = columnDialog.columnName;

        if (targetBoard) {
          const existingColumn = targetBoard.column_ids
            .map((colId) => columnsStore.byId[colId])
            .find((col) => col?.name === sourceColumnName);

          if (existingColumn) {
            setExistingColumnId(existingColumn.id);
            setConflictMode("conflict");
            return;
          }
        }

        moveColumnToBoard(
          columnDialog.boardId,
          columnDialog.columnId,
          targetBoardId
        );
        closeColumnDialog(data.dialogId);
        closeColumnQuickActions(columnDialog.columnId);
      }
    }, [
      columnDialog,
      targetBoardId,
      boards.byId,
      columnsStore.byId,
      moveColumnToBoard,
      closeColumnDialog,
      closeColumnQuickActions,
      data.dialogId,
    ]);

    const handleRenameAndMove = useCallback(() => {
      if (columnDialog && columnDialog.type === "move" && targetBoardId) {
        const newName = `${columnDialog.columnName} (Copy)`;
        updateColumn(columnDialog.columnId, { name: newName });
        moveColumnToBoard(
          columnDialog.boardId,
          columnDialog.columnId,
          targetBoardId
        );
        closeColumnDialog(data.dialogId);
        closeColumnQuickActions(columnDialog.columnId);
      }
    }, [
      columnDialog,
      targetBoardId,
      updateColumn,
      moveColumnToBoard,
      closeColumnDialog,
      closeColumnQuickActions,
      data.dialogId,
    ]);

    const handleReplace = useCallback(() => {
      if (
        columnDialog &&
        columnDialog.type === "move" &&
        targetBoardId &&
        existingColumnId
      ) {
        deleteColumn(targetBoardId, existingColumnId);
        moveColumnToBoard(
          columnDialog.boardId,
          columnDialog.columnId,
          targetBoardId
        );
        closeColumnDialog(data.dialogId);
        closeColumnQuickActions(columnDialog.columnId);
      }
    }, [
      columnDialog,
      targetBoardId,
      existingColumnId,
      deleteColumn,
      moveColumnToBoard,
      closeColumnDialog,
      closeColumnQuickActions,
      data.dialogId,
    ]);

    const handleClose = useCallback(() => {
      closeColumnDialog(data.dialogId);
    }, [closeColumnDialog, data.dialogId]);

    if (
      !columnDialog ||
      columnDialog.type !== "move" ||
      columnDialog.columnId !== data.columnId
    ) {
      return null;
    }

    return (
      <ModalScaleProvider zIndex={2100}>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          aria-labelledby={`dialog-title-column-move-${columnDialog.columnId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card transition-all duration-200",
            selected || isFocused || isTopmost
              ? "scale-[1.02] shadow-xl ring-2 ring-primary/50"
              : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onPointerDown={() => bringDialogToFront(zIndexDialogId)}
          role="dialog"
          style={{ width: DIALOG_WIDTH }}
        >
          {connectorState &&
            portalTarget &&
            createPortal(
              <ConnectorEdge
                color="primary"
                customColor={column?.accentColor}
                endX={connectorState.end.x}
                endY={connectorState.end.y}
                hideStartNode
                startX={connectorState.start.x}
                startY={connectorState.start.y}
                zIndex={connectorZIndex}
              />,
              portalTarget
            )}

          {conflictMode === "none" ? (
            <>
              <div
                className="flex cursor-move select-none items-center justify-between border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
                style={
                  column?.accentColor
                    ? {
                        background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                      }
                    : {}
                }
              >
                <div className="flex items-center gap-2">
                  <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded",
                      !column?.accentColor && "bg-primary/20 text-primary"
                    )}
                    style={
                      column?.accentColor
                        ? {
                            backgroundColor: `${column.accentColor}25`,
                            color: column.accentColor,
                          }
                        : {}
                    }
                  >
                    {(() => {
                      const IconComponent = column?.icon
                        ? ICON_MAP[column.icon]
                        : null;
                      if (IconComponent) {
                        return <IconComponent className="h-3 w-3" />;
                      }
                      return <MoveRight className="h-3 w-3" />;
                    })()}
                  </span>
                  <span className="font-semibold text-xs">Move Column</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                      !column?.accentColor && "bg-primary/10 text-primary"
                    )}
                    style={
                      column?.accentColor
                        ? {
                            backgroundColor: `${column.accentColor}15`,
                            color: column.accentColor,
                          }
                        : {}
                    }
                  >
                    <span className="max-w-20 truncate font-medium">
                      {columnDialog.columnName}
                    </span>
                  </span>
                  <button
                    aria-label="Close move column dialog"
                    className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                    onClick={handleClose}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="nodrag p-4">
                <div className="space-y-2">
                  <label
                    className="text-muted-foreground text-xs"
                    htmlFor={`target-board-${columnDialog.columnId}`}
                  >
                    Target Board
                  </label>
                  <ScaledSelect
                    onValueChange={setTargetBoardId}
                    value={targetBoardId}
                  >
                    <ScaledSelectTrigger
                      className="w-full rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]"
                      id={`target-board-${columnDialog.columnId}`}
                    >
                      <ScaledSelectValue placeholder="Select a board..." />
                    </ScaledSelectTrigger>
                    <ScaledSelectContent>
                      {availableTargetBoards.map((board) => (
                        <ScaledSelectItem key={board.id} value={board.id}>
                          <Kanban className="h-3.5 w-3.5 text-primary" />
                          {board.name}
                        </ScaledSelectItem>
                      ))}
                    </ScaledSelectContent>
                  </ScaledSelect>
                </div>
              </div>

              <div className="nodrag flex gap-2 border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
                <Button
                  className="h-7 flex-1 rounded-md bg-card/80 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                  onClick={handleClose}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  className="h-7 flex-1 rounded-md bg-primary/90 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
                  disabled={!targetBoardId}
                  onClick={handleConfirm}
                  type="button"
                >
                  Move
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Conflict UI */}
              <div className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-orange-500/10 via-orange-500/5 to-transparent px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="shrink-0 font-semibold text-xs">
                    Conflict
                  </span>
                </div>
              </div>
              <div className="nodrag p-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  A column named{" "}
                  <span className="font-semibold text-foreground">
                    "{columnDialog.columnName}"
                  </span>{" "}
                  already exists in the target board.
                </p>
              </div>
              <div className="nodrag flex flex-col gap-2 border-t bg-muted/30 px-3 py-2">
                <Button
                  className="h-7 w-full justify-start rounded-md bg-card/80 text-xs hover:bg-card"
                  onClick={handleRenameAndMove}
                  type="button"
                  variant="outline"
                >
                  <MoveRight className="mr-2 h-3 w-3" />
                  Rename & Move
                </Button>
                <Button
                  className="h-7 w-full justify-start rounded-md bg-destructive/10 text-destructive text-xs hover:bg-destructive/20"
                  onClick={handleReplace}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Replace Existing
                </Button>
                <Button
                  className="h-7 w-full rounded-md text-xs"
                  onClick={() => setConflictMode("none")}
                  type="button"
                  variant="ghost"
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
      </ModalScaleProvider>
    );
  }
);

MoveColumnDialogNodeComponent.displayName = "MoveColumnDialogNode";
