"use client";

import { Calendar, CheckSquare } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { useKanbanStore } from "../store/kanban-store";
import type { Task } from "../types";

type TaskCardProps = {
  task: Task;
  onDragStart: (task: Task) => void;
  isSelected: boolean;
};

export const TaskCard = memo(
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
  ({ task, onDragStart, isSelected }: TaskCardProps) => {
    const toggleTaskSelection = useKanbanStore(
      (state) => state.toggleTaskSelection
    );
    const selectedTasks = useKanbanStore((state) => state.selectedTasks);

    const showCheckbox = selectedTasks.size > 0;

    const handleDragStart = (e: React.DragEvent) => {
      if (showCheckbox) {
        e.preventDefault();
        return;
      }
      onDragStart(task);
    };

    const handleCheckboxChange = (_checked: boolean) => {
      toggleTaskSelection(task.id);
    };

    const priorityColors = {
      low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      high: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    const completedChecklist =
      task.checklists?.filter((c) => c.completed).length || 0;
    const totalChecklist = task.checklists?.length || 0;

    const isDue = task.due_date && new Date(task.due_date) < new Date();
    const isDueSoon =
      task.due_date &&
      new Date(task.due_date) > new Date() &&
      new Date(task.due_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const getDueDateClassName = () => {
      if (isDue) {
        return "text-red-400";
      }
      if (isDueSoon) {
        return "text-yellow-400";
      }
      return "text-muted-foreground";
    };

    if (showCheckbox) {
      return (
        <div
          className={`cursor-default rounded border bg-card p-3 transition-all hover:scale-[1.02] hover:shadow-md ${isSelected ? "border-primary shadow-lg" : "border-border/40"}`}
        >
          <div className="flex items-start gap-2">
            {showCheckbox && (
              <Checkbox
                checked={isSelected}
                className="mt-1"
                onCheckedChange={handleCheckboxChange}
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <h4 className="line-clamp-2 font-medium text-card-foreground text-sm">
                {task.title}
              </h4>

              {task.description && (
                <p className="line-clamp-2 text-muted-foreground text-xs">
                  {task.description}
                </p>
              )}

              {task.progress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-card-foreground">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    className={`h-5 px-1.5 py-0 text-[10px] ${priorityColors[task.priority]}`}
                    variant="outline"
                  >
                    {task.priority}
                  </Badge>

                  {totalChecklist > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      <CheckSquare className="h-3 w-3" />
                      <span>
                        {completedChecklist}/{totalChecklist}
                      </span>
                    </div>
                  )}
                </div>

                {task.due_date && (
                  <div
                    className={`flex items-center gap-1 text-[10px] ${getDueDateClassName()}`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <Badge
                      className="h-4 bg-secondary/50 px-1.5 py-0 text-[10px]"
                      key={tag}
                      variant="secondary"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: TODO: refactor later
      // biome-ignore lint/a11y/noStaticElementInteractions: TODO: refactor later
      <div
        className={`cursor-move rounded border bg-card p-3 transition-all hover:scale-[1.02] hover:shadow-md ${isSelected ? "border-primary shadow-lg" : "border-border/40"}`}
        draggable
        onDragStart={handleDragStart}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <h4 className="line-clamp-2 font-medium text-card-foreground text-sm">
              {task.title}
            </h4>

            {task.description && (
              <p className="line-clamp-2 text-muted-foreground text-xs">
                {task.description}
              </p>
            )}

            {task.progress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-card-foreground">
                    {task.progress}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  className={`h-5 px-1.5 py-0 text-[10px] ${priorityColors[task.priority]}`}
                  variant="outline"
                >
                  {task.priority}
                </Badge>

                {totalChecklist > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <CheckSquare className="h-3 w-3" />
                    <span>
                      {completedChecklist}/{totalChecklist}
                    </span>
                  </div>
                )}
              </div>

              {task.due_date && (
                <div
                  className={`flex items-center gap-1 text-[10px] ${getDueDateClassName()}`}
                >
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <Badge
                    className="h-4 bg-secondary/50 px-1.5 py-0 text-[10px]"
                    key={tag}
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

TaskCard.displayName = "TaskCard";
