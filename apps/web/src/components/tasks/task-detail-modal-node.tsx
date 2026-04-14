"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { ArrowLeft, Columns, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";
import { TaskDetailForm } from "./task-detail-form";
import { TaskViewForm } from "./task-view-form";

export interface TaskDetailModalNodeData {
  modalId: string;
  [key: string]: unknown;
}

type TaskDetailModalNodeProps = NodeProps<Node<TaskDetailModalNodeData>>;

const MODAL_WIDTH = 400;

export const TaskDetailModalNodeComponent = memo<TaskDetailModalNodeProps>(
  ({ data, selected }) => {
    const modalState = useKanbanStore(
      (state) => state.taskDetailModals[data.modalId]
    );
    const task = useKanbanStore((state) =>
      modalState ? state.tasks.byId[modalState.taskId] : null
    );
    const columns = useKanbanStore((state) => state.columns);
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );
    const setTaskDetailModalEditing = useKanbanStore(
      (state) => state.setTaskDetailModalEditing
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);

    const dialogId = `task-detail-modal-${data.modalId}`;

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(
        dialogId,
        "task-dialog",
        modalState?.taskId ?? data.modalId
      );

    const shakingModalId = useKanbanStore(
      (state) => state.shakingTaskDetailModalId
    );

    const column = task ? columns.byId[task.column_id] : null;

    const isShaking = shakingModalId === data.modalId;

    const [isFocused, setIsFocused] = useState(false);

    // Use synced isEditing state from store, fallback to initialIsEditing
    const isEditing =
      modalState?.isEditing ?? modalState?.initialIsEditing ?? false;

    const handleMouseDown = useCallback(() => {
      bringDialogToFront(dialogId);
      handleDialogPointerDown();
    }, [dialogId, bringDialogToFront, handleDialogPointerDown]);

    const handleBackToView = useCallback(() => {
      setTaskDetailModalEditing(data.modalId, false);
    }, [data.modalId, setTaskDetailModalEditing]);

    const handleStartEditing = useCallback(() => {
      setTaskDetailModalEditing(data.modalId, true);
    }, [data.modalId, setTaskDetailModalEditing]);

    if (!(modalState && task)) {
      return null;
    }

    return (
      <div
        className="relative rounded-lg"
        style={{
          width: MODAL_WIDTH,
        }}
      >
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Node wrapper needs mouse handler */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Node wrapper needs mouse handler */}
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
            selected || isFocused || isTopmost
              ? "shadow-xl ring-2 ring-primary/50"
              : "shadow-lg ring-1 ring-border/50",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]",
            isShaking && "animate-shake"
          )}
          data-testid="task-detail-modal"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onMouseDown={handleMouseDown}
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerDown={handleMouseDown}
            style={
              column?.accentColor
                ? {
                    background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button
                  className="nodrag flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-primary/20 hover:text-primary dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                  onClick={handleBackToView}
                  type="button"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
              ) : (
                <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded font-medium text-[10px]",
                  !column?.accentColor &&
                    "bg-violet-500/20 text-violet-600 dark:text-violet-400"
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
                  return <Columns className="h-3 w-3" />;
                })()}
              </span>
              <span
                className="max-w-32 truncate font-semibold text-xs"
                title={task.title}
              >
                {task.title}
              </span>
            </div>
            <button
              className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              data-testid="task-detail-close-button"
              onClick={() => closeTaskDetailModal(data.modalId)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="nodrag nowheel nopan max-h-[70vh] overflow-y-auto">
            {isEditing ? (
              <TaskDetailForm
                boardId={modalState.boardId}
                modalId={data.modalId}
                onCancel={handleBackToView}
                onSaved={handleBackToView}
                task={task}
              />
            ) : (
              <TaskViewForm
                boardId={modalState.boardId}
                modalId={data.modalId}
                onEdit={handleStartEditing}
                task={task}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);

TaskDetailModalNodeComponent.displayName = "TaskDetailModalNode";
