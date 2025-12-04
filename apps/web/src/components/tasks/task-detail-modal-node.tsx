"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { ArrowLeft, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";
import { TaskDetailForm } from "./task-detail-form";
import { TaskViewForm } from "./task-view-form";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

type TaskDetailModalNodeData = {
  modalId: string;
};

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
    const board = useKanbanStore((state) =>
      modalState ? state.boards.byId[modalState.boardId] : null
    );
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );
    const bringTaskDetailModalToFront = useKanbanStore(
      (state) => state.bringTaskDetailModalToFront
    );
    const shakingModalId = useKanbanStore(
      (state) => state.shakingTaskDetailModalId
    );

    const isShaking = shakingModalId === data.modalId;

    const [isFocused, setIsFocused] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const handleMouseDown = useCallback(() => {
      bringTaskDetailModalToFront(data.modalId);
    }, [data.modalId, bringTaskDetailModalToFront]);

    const handleBackToView = useCallback(() => {
      setIsEditing(false);
    }, []);

    if (!(modalState && task && board)) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Node wrapper needs mouse handler
      // biome-ignore lint/a11y/noStaticElementInteractions: Node wrapper needs mouse handler
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-lg ring-1 ring-border/50",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]",
          isShaking && "animate-shake"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onMouseDown={handleMouseDown}
        style={{
          width: MODAL_WIDTH,
        }}
      >
        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
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
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
              {getInitials(board.name)}
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
              onEdit={() => setIsEditing(true)}
              task={task}
            />
          )}
        </div>
      </div>
    );
  }
);

TaskDetailModalNodeComponent.displayName = "TaskDetailModalNode";
