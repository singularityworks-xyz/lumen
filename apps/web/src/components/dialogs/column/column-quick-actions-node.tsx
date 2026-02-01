"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  ArrowUpRight,
  Columns,
  Edit2,
  GripHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type BlockingDialog,
  BlockingDialogsManager,
} from "@/src/components/dialogs/blocking-dialogs-manager";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";

export interface ColumnQuickActionsNodeData {
  columnId: string;
  [key: string]: unknown;
}

type ColumnQuickActionsNodeProps = NodeProps<Node<ColumnQuickActionsNodeData>>;

const DIALOG_WIDTH = 200;

export const ColumnQuickActionsNodeComponent =
  memo<ColumnQuickActionsNodeProps>(({ id, data, selected }) => {
    const { getNode, flowToScreenPosition, getViewport, setViewport } =
      useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const columnId = data.columnId;
    const column = useKanbanStore((state) => state.columns.byId[columnId]);
    const boards = useKanbanStore((state) => state.boards);
    const closeColumnQuickActions = useKanbanStore(
      (state) => state.closeColumnQuickActions
    );
    const openColumnDialog = useKanbanStore((state) => state.openColumnDialog);
    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const createTaskModals = useKanbanStore((state) => state.createTaskModals);
    const columnDialogs = useKanbanStore((state) => state.columnDialogs);

    const columnQuickActionsState = useKanbanStore(
      (state) => state.columnQuickActions?.[columnId]
    );

    const boardId = columnQuickActionsState?.boardId ?? column?.board_id ?? "";
    const board = useKanbanStore((state) => state.boards.byId[boardId]);
    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );

    const availableTargetBoards = useMemo(() => {
      const sourceBoard = boards.byId[boardId];
      const workspaceId = sourceBoard?.workspace_id;
      return boards.allIds
        .map((bId) => boards.byId[bId])
        .filter((b): b is NonNullable<typeof b> => {
          if (!b || b.id === boardId) {
            return false;
          }
          if (!workspaceId) {
            return true;
          }
          return b.workspace_id === workspaceId;
        });
    }, [boards, boardId]);

    const closeColumnDialog = useKanbanStore(
      (state) => state.closeColumnDialog
    );
    const closeCreateTaskModal = useKanbanStore(
      (state) => state.closeCreateTaskModal
    );

    const blockingDialogs = useMemo(() => {
      const dialogs: BlockingDialog[] = [];

      for (const [cDialogId, d] of Object.entries(columnDialogs)) {
        if (d.columnId !== columnId) {
          continue;
        }

        let name = "Dialog";
        let icon: import("lucide-react").LucideIcon | string = Columns;
        switch (d.type) {
          case "rename":
            name = "Rename Column";
            icon = Edit2;
            break;
          case "delete":
            name = "Delete Column";
            icon = Trash2;
            break;
          case "move":
            name = "Move Column";
            icon = ArrowUpRight;
            break;
          default:
            break;
        }

        dialogs.push({
          id: cDialogId,
          name,
          type: "column-dialog",
          icon,
          accentColor: column?.accentColor,
        });
      }

      for (const [taskModalId, m] of Object.entries(createTaskModals)) {
        if (m.columnId !== columnId) {
          continue;
        }
        dialogs.push({
          id: taskModalId,
          name: "New Task",
          type: "task",
          icon: column?.icon,
          accentColor: column?.accentColor,
        });
      }

      return dialogs;
    }, [columnDialogs, createTaskModals, columnId, column]);

    const handleCloseBlocking = useCallback(() => {
      for (const d of blockingDialogs) {
        if (d.type === "column-dialog") {
          closeColumnDialog(d.id);
        } else if (d.type === "task") {
          closeCreateTaskModal(d.id);
        }
      }
    }, [blockingDialogs, closeColumnDialog, closeCreateTaskModal]);

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);

    const dialogId = `column-quick-actions-${columnId}`;
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(dialogId, "column-dialog", columnId);

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, dialogId]);

    const [sourceElement, setSourceElement] = useState<Element | null>(null);

    useEffect(() => {
      const idSelector = `#kanban-column-${columnId}`;
      const find = () => {
        const el = document.querySelector(idSelector);
        if (el) {
          setSourceElement(el);
          return true;
        }
        return false;
      };

      if (find()) {
        return;
      }

      const interval = setInterval(() => {
        if (find()) {
          clearInterval(interval);
        }
      }, 100);

      const timeout = setTimeout(() => clearInterval(interval), 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }, [columnId]);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!(boardPosition && columnQuickActionsState && sourceElement)) {
        return null;
      }

      const columnRect = sourceElement.getBoundingClientRect();
      const myScreenPos = flowToScreenPosition({
        x: columnQuickActionsState.position.x,
        y: columnQuickActionsState.position.y,
      });

      return {
        start: {
          x: columnRect.right,
          y: columnRect.top + 20,
        },
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      boardPosition,
      columnQuickActionsState,
      sourceElement,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleClose = useCallback(() => {
      closeColumnQuickActions(columnId);
    }, [closeColumnQuickActions, columnId]);

    const VIEWPORT_PADDING = 100;
    const ensureDialogVisible = useCallback(
      (
        dialogX: number,
        dialogY: number,
        dialogWidth: number,
        dialogHeight: number
      ) => {
        const viewport = getViewport();
        const { x: vX, y: vY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const dialogScreenX = dialogX * zoom + vX;
        const dialogScreenY = dialogY * zoom + vY;
        const dialogScreenRight = (dialogX + dialogWidth) * zoom + vX;
        const dialogScreenBottom = (dialogY + dialogHeight) * zoom + vY;

        let newVpX = vX;
        let newVpY = vY;
        let needsPan = false;

        if (dialogScreenX < VIEWPORT_PADDING) {
          newVpX = vX + (VIEWPORT_PADDING - dialogScreenX);
          needsPan = true;
        } else if (dialogScreenRight > screenWidth - VIEWPORT_PADDING) {
          newVpX = vX - (dialogScreenRight - (screenWidth - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (dialogScreenY < VIEWPORT_PADDING) {
          newVpY = vY + (VIEWPORT_PADDING - dialogScreenY);
          needsPan = true;
        } else if (dialogScreenBottom > screenHeight - VIEWPORT_PADDING) {
          newVpY =
            vY - (dialogScreenBottom - (screenHeight - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (needsPan) {
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 400 });
        }
      },
      [getViewport, setViewport]
    );

    const handleAddTask = useCallback(() => {
      if (!column) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openCreateTaskModal({
          columnId: column.id,
          boardId,
          position: { x: dialogX, y: dialogY },
          sourceType: "column-menu",
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 400, 300), 50);
      }
    }, [
      column,
      boardId,
      getNode,
      id,
      openCreateTaskModal,
      ensureDialogVisible,
    ]);

    const handleRename = useCallback(() => {
      if (!column) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        const newDialogId = openColumnDialog({
          type: "rename",
          columnId: column.id,
          columnName: column.name,
          columnDescription: column.description,
          boardId,
          boardName: board?.name ?? "Unknown Board",
          inputValue: column.name,
          descriptionValue: column.description,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => {
          const dialog = useKanbanStore.getState().columnDialogs[newDialogId];
          const targetX = dialog?.position.x ?? dialogX;
          const targetY = dialog?.position.y ?? dialogY;
          ensureDialogVisible(targetX, targetY, 320, 280);
        }, 50);
      }
    }, [
      column,
      boardId,
      board?.name,
      getNode,
      id,
      openColumnDialog,
      ensureDialogVisible,
    ]);

    const handleMoveToBoard = useCallback(() => {
      if (!column || availableTargetBoards.length === 0) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        const newDialogId = openColumnDialog({
          type: "move",
          columnId: column.id,
          columnName: column.name,
          boardId,
          boardName: board?.name ?? "Unknown Board",
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => {
          const dialog = useKanbanStore.getState().columnDialogs[newDialogId];
          const targetX = dialog?.position.x ?? dialogX;
          const targetY = dialog?.position.y ?? dialogY;
          ensureDialogVisible(targetX, targetY, 320, 300);
        }, 50);
      }
    }, [
      column,
      boardId,
      board?.name,
      availableTargetBoards.length,
      getNode,
      id,
      openColumnDialog,
      ensureDialogVisible,
    ]);

    const handleDelete = useCallback(() => {
      if (!column) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        const newDialogId = openColumnDialog({
          type: "delete",
          columnId: column.id,
          columnName: column.name,
          boardId,
          boardName: board?.name ?? "Unknown Board",
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => {
          const dialog = useKanbanStore.getState().columnDialogs[newDialogId];
          const targetX = dialog?.position.x ?? dialogX;
          const targetY = dialog?.position.y ?? dialogY;
          ensureDialogVisible(targetX, targetY, 320, 180);
        }, 50);
      }
    }, [
      column,
      boardId,
      board?.name,
      getNode,
      id,
      openColumnDialog,
      ensureDialogVisible,
    ]);

    if (!column) {
      return null;
    }

    const taskCount = column.task_ids.length;
    const showAddTask = columnQuickActionsState?.showAddTask ?? false;

    return (
      <div className="relative rounded-lg" style={{ width: DIALOG_WIDTH }}>
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          aria-labelledby={`column-quick-actions-${id}`}
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
          onPointerDown={() => {
            bringDialogToFront(dialogId);
            handleDialogPointerDown();
          }}
          role="dialog"
        >
          {connectorState &&
            portalTarget &&
            createPortal(
              <ConnectorEdge
                customColor={column.accentColor}
                endX={connectorState.end.x}
                endY={connectorState.end.y}
                startX={connectorState.start.x}
                startY={connectorState.start.y}
                zIndex={connectorZIndex}
              />,
              portalTarget
            )}

          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              column.accentColor
                ? {
                    background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs",
                  !column.accentColor &&
                    "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                )}
                style={
                  column.accentColor
                    ? {
                        backgroundColor: `${column.accentColor}25`,
                        color: column.accentColor,
                      }
                    : {}
                }
              >
                {(() => {
                  const IconComponent = column.icon
                    ? ICON_MAP[column.icon]
                    : null;
                  if (IconComponent) {
                    return <IconComponent className="h-3 w-3" />;
                  }
                  return <Columns className="h-3 w-3" />;
                })()}
                <span className="max-w-20 truncate">{column.name}</span>
              </span>
            </div>
            <BlockingDialogsManager
              dialogs={blockingDialogs}
              onCloseAll={handleCloseBlocking}
              onCloseMenu={handleClose}
            >
              <X className="h-3 w-3" />
            </BlockingDialogsManager>
          </div>

          <div className="flex gap-3 border-border/50 border-b bg-muted/30 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              Board:{" "}
              <span className="font-medium text-foreground">
                {board?.name ?? "Unknown"}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {taskCount} tasks
            </span>
          </div>

          <div className="nodrag p-1">
            <TooltipProvider delayDuration={300}>
              {showAddTask && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                        onClick={handleAddTask}
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Task</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs">
                        Create a new task in this column
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="my-0.5 h-px bg-border/50" />
                </>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                    onClick={handleRename}
                    type="button"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Rename</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Change column name</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
                      availableTargetBoards.length > 0
                        ? "hover:bg-accent hover:text-accent-foreground"
                        : "cursor-not-allowed opacity-50"
                    )}
                    disabled={availableTargetBoards.length === 0}
                    onClick={
                      availableTargetBoards.length > 0
                        ? handleMoveToBoard
                        : undefined
                    }
                    type="button"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span>Move to board</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">
                    {availableTargetBoards.length > 0
                      ? "Move this column to another board"
                      : "No other boards available"}
                  </p>
                </TooltipContent>
              </Tooltip>

              <div className="my-0.5 h-px bg-border/50" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
                    onClick={handleDelete}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">
                    Delete this column and all its tasks
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    );
  });

ColumnQuickActionsNodeComponent.displayName = "ColumnQuickActionsNode";
