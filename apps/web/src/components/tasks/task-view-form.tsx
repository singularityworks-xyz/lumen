"use client";

import { format } from "date-fns";
import {
  Calendar,
  CheckSquare,
  Edit2,
  FileText,
  Loader,
  Tag,
  Trash2,
} from "lucide-react";
import { memo } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { type Task, useKanbanStore } from "@/src/features/kanban";
import { cn } from "@/src/lib/utils";

type TaskViewFormProps = {
  modalId: string;
  task: Task;
  boardId: string;
  onEdit: () => void;
};

const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    badgeClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    label: "Medium",
    color: "bg-amber-500",
    textColor: "text-amber-500",
    badgeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  high: {
    label: "High",
    color: "bg-rose-500",
    textColor: "text-rose-500",
    badgeClass: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  },
} as const;

export const TaskViewForm = memo(
  ({ modalId, task, boardId, onEdit }: TaskViewFormProps) => {
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );

    const handleDelete = () => {
      deleteTask(boardId, task.id);
      closeTaskDetailModal(modalId);
    };

    const completedCount =
      task.checklists?.filter((c) => c.completed).length ?? 0;
    const totalChecklist = task.checklists?.length ?? 0;

    const isDue = task.due_date && new Date(task.due_date) < new Date();
    const isDueSoon =
      task.due_date &&
      new Date(task.due_date) > new Date() &&
      new Date(task.due_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const getDueDateClassName = () => {
      if (isDue) {
        return "text-rose-500";
      }
      if (isDueSoon) {
        return "text-amber-500";
      }
      return "text-muted-foreground";
    };

    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Title */}
          <div>
            <h3 className="font-semibold text-card-foreground text-lg leading-tight">
              {task.title}
            </h3>
          </div>

          {/* Priority & Due Date Row */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              className={cn(
                "px-2 py-0.5 text-xs",
                PRIORITY_CONFIG[task.priority].badgeClass
              )}
              variant="secondary"
            >
              <span
                className={cn(
                  "mr-1.5 h-2 w-2 rounded-full",
                  PRIORITY_CONFIG[task.priority].color
                )}
              />
              {PRIORITY_CONFIG[task.priority].label} Priority
            </Badge>

            {task.due_date && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  getDueDateClassName()
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(task.due_date), "PPP")}</span>
                {isDue && (
                  <span className="font-medium text-xs">(Overdue)</span>
                )}
                {isDueSoon && (
                  <span className="font-medium text-xs">(Due soon)</span>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {task.progress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <Loader className="h-3.5 w-3.5" />
                  Progress
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-semibold text-xs",
                    task.progress === 100 &&
                      "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                    task.progress >= 50 &&
                      task.progress < 100 &&
                      "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                    task.progress < 50 && "bg-muted text-muted-foreground"
                  )}
                >
                  {task.progress}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]">
                <div
                  className={cn(
                    "h-full transition-all",
                    task.progress === 100 && "bg-emerald-500",
                    task.progress >= 50 &&
                      task.progress < 100 &&
                      "bg-amber-500",
                    task.progress < 50 && "bg-primary"
                  )}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <Badge
                    className="bg-primary/10 px-2 py-0.5 text-primary text-xs"
                    key={tag}
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <FileText className="h-3.5 w-3.5" />
                Description
              </span>
              <div className="rounded-lg border border-border/30 bg-muted/80 p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]">
                <p className="whitespace-pre-wrap text-card-foreground text-sm leading-relaxed">
                  {task.description}
                </p>
              </div>
            </div>
          )}

          {/* Checklist */}
          {task.checklists && task.checklists.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Checklist
                </span>
                <span className="text-muted-foreground text-xs">
                  {completedCount}/{totalChecklist} completed
                </span>
              </div>
              <div className="space-y-1.5">
                {task.checklists.map((item) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/80 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]"
                    key={item.id}
                  >
                    <Checkbox checked={item.completed} disabled />
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        item.completed
                          ? "text-muted-foreground line-through"
                          : "text-card-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
          <Button
            className="h-7 rounded-md bg-destructive/90 text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-destructive dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
            onClick={handleDelete}
            type="button"
            variant="destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            className="h-7 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
            onClick={() => closeTaskDetailModal(modalId)}
            type="button"
            variant="ghost"
          >
            Close
          </Button>
          <Button
            className="h-7 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
            onClick={onEdit}
            type="button"
          >
            <Edit2 className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>
    );
  }
);

TaskViewForm.displayName = "TaskViewForm";
