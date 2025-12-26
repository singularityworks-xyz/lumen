"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  Check,
  Copy,
  Edit2,
  GripHorizontal,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type BlockingDialog,
  BlockingDialogsManager,
} from "@/src/components/dialogs/blocking-dialogs-manager";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import { cn } from "@/src/lib/utils";

type TaskQuickActionsNodeData = {
  taskId: string;
};

type TaskQuickActionsNodeProps = NodeProps<Node<TaskQuickActionsNodeData>>;

const DIALOG_WIDTH = 200;

export const TaskQuickActionsNodeComponent = memo<TaskQuickActionsNodeProps>(
  ({ id, data, selected }) => {
    const { flowToScreenPosition, getViewport, setViewport, getNode } =
      useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
    }, []);

    const taskId = data.taskId;
    const task = useKanbanStore((state) => state.tasks.byId[taskId]);
    const columns = useKanbanStore((state) => state.columns);
    const closeTaskQuickActions = useKanbanStore(
      (state) => state.closeTaskQuickActions
    );
    const updateTask = useKanbanStore((state) => state.updateTask);
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const openTaskDetailModal = useKanbanStore(
      (state) => state.openTaskDetailModal
    );
    const duplicateTask = useKanbanStore((state) => state.duplicateTask);
    const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );

    const dialogId = `task-quick-actions-${taskId}`;

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.QUICK_ACTIONS;
      }
      return Z_INDEX_BASE.QUICK_ACTIONS + (index + 1) * 10;
    }, [dialogFocusStack, dialogId]);

    const taskQuickActionsState = useKanbanStore(
      (state) => state.taskQuickActions[taskId]
    );

    const column = task ? columns.byId[task.column_id] : null;

    // biome-ignore lint/correctness/useExhaustiveDependencies: TODO: check tis
    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!taskQuickActionsState) {
        return null;
      }
      const sourceTaskElement = document.querySelector(
        `[data-task-id="${taskId}"]`
      );

      if (!sourceTaskElement) {
        return null;
      }

      const sourceRect = sourceTaskElement.getBoundingClientRect();
      const myScreenPos = flowToScreenPosition({
        x: taskQuickActionsState.position.x,
        y: taskQuickActionsState.position.y,
      });

      return {
        start: {
          x: sourceRect.right,
          y: sourceRect.top + sourceRect.height / 2,
        },
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      taskQuickActionsState,
      taskId,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
      mounted,
    ]);

    const taskDetailConnectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!taskQuickActionsState) {
        return null;
      }

      const taskDetailModal = Object.values(taskDetailModals).find(
        (modal) => modal?.taskId === taskId
      );

      if (!taskDetailModal) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: taskQuickActionsState.position.x + DIALOG_WIDTH,
        y: taskQuickActionsState.position.y + 60,
      });

      const dialogScreenPos = flowToScreenPosition({
        x: taskDetailModal.position.x,
        y: taskDetailModal.position.y + 20,
      });

      return {
        start: myScreenPos,
        end: dialogScreenPos,
      };
    }, [
      taskQuickActionsState,
      taskId,
      taskDetailModals,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const blockingDialogs = useMemo(() => {
      const dialogs: BlockingDialog[] = [];

      for (const [modalId, modal] of Object.entries(taskDetailModals)) {
        if (modal?.taskId === taskId) {
          dialogs.push({
            id: modalId,
            name: "Edit Task",
            type: "task-detail",
            icon: Edit2,
            accentColor: column?.accentColor,
          });
        }
      }

      return dialogs;
    }, [taskDetailModals, taskId, column]);

    const handleCloseBlocking = useCallback(() => {
      for (const d of blockingDialogs) {
        if (d.type === "task-detail") {
          closeTaskDetailModal(d.id);
        }
      }
    }, [blockingDialogs, closeTaskDetailModal]);

    const handleClose = useCallback(() => {
      closeTaskQuickActions(taskId);
    }, [closeTaskQuickActions, taskId]);

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

    const handleEdit = useCallback(() => {
      if (!task) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        const result = openTaskDetailModal({
          taskId: task.id,
          boardId: task.board_id,
          position: { x: dialogX, y: dialogY },
          initialIsEditing: true,
          openedFromQuickActions: true,
        });
        if (!result.isExisting) {
          setTimeout(() => ensureDialogVisible(dialogX, dialogY, 450, 500), 50);
        }
      } else {
        const result = openTaskDetailModal({
          taskId: task.id,
          boardId: task.board_id,
          initialIsEditing: true,
          openedFromQuickActions: true,
        });
        if (!result.isExisting) {
          setTimeout(
            () =>
              ensureDialogVisible(
                result.position.x,
                result.position.y,
                450,
                500
              ),
            50
          );
        }
      }
    }, [task, id, getNode, openTaskDetailModal, ensureDialogVisible]);

    const handleMarkDone = useCallback(() => {
      if (!task) {
        return;
      }
      updateTask(task.id, {
        status: task.status === "done" ? "todo" : "done",
      });
      handleClose();
    }, [task, updateTask, handleClose]);

    const handleMoveToTrash = useCallback(() => {
      if (!task) {
        return;
      }

      handleCloseBlocking();

      if (task.status === "trash") {
        deleteTask(task.id);
      } else {
        updateTask(task.id, { status: "trash" });
      }
      handleClose();
    }, [task, updateTask, deleteTask, handleClose, handleCloseBlocking]);

    const handleRestore = useCallback(() => {
      if (!task) {
        return;
      }
      updateTask(task.id, { status: "todo" });
      handleClose();
    }, [task, updateTask, handleClose]);

    const handleDuplicate = useCallback(() => {
      if (!task) {
        return;
      }
      duplicateTask(task.id);
    }, [task, duplicateTask]);

    if (!task) {
      return null;
    }

    const isTrash = task.status === "trash";
    const isDone = task.status === "done";

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`task-quick-actions-${id}`}
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
        onPointerDown={() => bringDialogToFront(dialogId)}
        role="dialog"
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          createPortal(
            <ConnectorEdge
              customColor={column?.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
              zIndex={connectorZIndex}
            />,
            document.body
          )}

        {taskDetailConnectorState &&
          createPortal(
            <ConnectorEdge
              customColor={column?.accentColor}
              endX={taskDetailConnectorState.end.x}
              endY={taskDetailConnectorState.end.y}
              startX={taskDetailConnectorState.start.x}
              startY={taskDetailConnectorState.start.y}
              zIndex={connectorZIndex}
            />,
            document.body
          )}

        <div
          className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
          style={
            column?.accentColor
              ? {
                  background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                }
              : {}
          }
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="h-3 w-3 text-muted-foreground" />
            <span
              className="max-w-28 truncate font-medium text-xs"
              style={
                column?.accentColor
                  ? {
                      color: column.accentColor,
                    }
                  : { color: "var(--foreground)" }
              }
            >
              {task.title}
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
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isDone
                ? "text-green-500"
                : isTrash
                  ? "text-red-500"
                  : "text-muted-foreground"
            )}
          >
            {isDone ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Done
              </>
            ) : isTrash ? (
              <>
                <Trash2 className="h-2.5 w-2.5" />
                Trash
              </>
            ) : (
              "To Do"
            )}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {task.priority}
          </span>
        </div>

        <div className="nodrag p-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={handleEdit}
                  type="button"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">Edit task details</p>
              </TooltipContent>
            </Tooltip>

            {!isTrash && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
                      isDone
                        ? "text-yellow-600 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                        : "text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/20"
                    )}
                    onClick={handleMarkDone}
                    type="button"
                  >
                    {isDone ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Mark as To Do</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark as Done</span>
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">
                    {isDone
                      ? "Move back to active tasks"
                      : "Complete this task"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {isTrash && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-green-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-green-100 dark:text-green-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-green-900/20"
                    onClick={handleRestore}
                    type="button"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Restore from trash</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={handleDuplicate}
                  type="button"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Duplicate</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">Create a copy of this task</p>
              </TooltipContent>
            </Tooltip>

            <div className="my-0.5 h-px bg-border/50" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
                  onClick={handleMoveToTrash}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    {isTrash ? "Delete Permanently" : "Move to Trash"}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">
                  {isTrash
                    ? "Permanently delete this task"
                    : "Move task to trash"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);

TaskQuickActionsNodeComponent.displayName = "TaskQuickActionsNode";
