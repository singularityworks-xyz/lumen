"use client";

import { Calendar, CheckSquare } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { type Task, useKanbanStore } from "@/src/features/kanban";

type TaskCardProps = {
  task: Task;
  boardId: string;
  onDragStart: (task: Task) => void;
  isSelected: boolean;
  onOpenDetail?: (taskId: string, screenX: number, screenY: number) => void;
};

export const TaskCard = memo(
  ({ task, boardId, onDragStart, isSelected, onOpenDetail }: TaskCardProps) => {
    const toggleTaskSelection = useKanbanStore(
      (state) => state.toggleTaskSelection
    );
    const openTaskDetailModal = useKanbanStore(
      (state) => state.openTaskDetailModal
    );
    const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);

    const showCheckbox = selectedTaskIds.length > 0;

    // Track if we're dragging to differentiate from clicks
    const dragStartPos = { current: { x: 0, y: 0 } };
    const isDragging = { current: false };

    const handleMouseDown = (e: React.MouseEvent) => {
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
    };

    const handleDragStart = (e: React.DragEvent) => {
      if (showCheckbox) {
        e.preventDefault();
        return;
      }
      isDragging.current = true;
      onDragStart(task);
    };

    const handleClick = (e: React.MouseEvent) => {
      // Calculate distance moved to differentiate drag from click
      const distance = Math.sqrt(
        (e.clientX - dragStartPos.current.x) ** 2 +
          (e.clientY - dragStartPos.current.y) ** 2
      );

      // If we dragged more than 5px or drag was initiated, don't open modal
      if (isDragging.current || distance > 5) {
        return;
      }

      // Don't open modal if in multi-select mode (checkbox mode)
      if (showCheckbox) {
        return;
      }

      // Open task detail modal - use callback if available (for canvas position), otherwise fallback
      if (onOpenDetail) {
        onOpenDetail(task.id, e.clientX, e.clientY);
      } else {
        openTaskDetailModal(task.id, boardId);
      }
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
          className={`cursor-default rounded border bg-card p-2 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md ${
            isSelected
              ? "border-primary shadow-lg"
              : "border-border/40 dark:border-border/70"
          }`}
        >
          <div className="flex items-start gap-1.5">
            {showCheckbox && (
              <Checkbox
                checked={isSelected}
                className="mt-0.5"
                onCheckedChange={handleCheckboxChange}
              />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <h4 className="line-clamp-2 font-medium text-card-foreground text-xs">
                {task.title}
              </h4>

              {task.description && (
                <p className="line-clamp-5 w-full overflow-hidden text-[11px] text-muted-foreground">
                  {task.description}
                </p>
              )}

              {task.progress > 0 && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-card-foreground">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge
                    className={`h-4 px-1.5 py-0 text-[9px] ${priorityColors[task.priority]}`}
                    variant="outline"
                  >
                    {task.priority}
                  </Badge>

                  {totalChecklist > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CheckSquare className="h-2.5 w-2.5" />
                      <span>
                        {completedChecklist}/{totalChecklist}
                      </span>
                    </div>
                  )}
                </div>

                {task.due_date && (
                  <div
                    className={`flex items-center gap-1 text-[9px] ${getDueDateClassName()}`}
                  >
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <Badge
                      className="h-3.5 bg-secondary/50 px-1.5 py-0 text-[9px]"
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
        className={`cursor-pointer rounded border bg-card p-2 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md ${
          isSelected
            ? "border-primary shadow-lg"
            : "border-border/40 dark:border-border/70"
        }`}
        data-task-id={task.id}
        draggable
        onClick={handleClick}
        onDragStart={handleDragStart}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!showCheckbox) {
              // For keyboard, use default position (no screen coords available)
              openTaskDetailModal(task.id, boardId);
            }
          }
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4 className="line-clamp-2 font-medium text-card-foreground text-xs">
              {task.title}
            </h4>

            {task.description && (
              <p className="line-clamp-5 w-full overflow-hidden text-[11px] text-muted-foreground">
                {task.description}
              </p>
            )}

            {task.progress > 0 && (
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-card-foreground">
                    {task.progress}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Badge
                  className={`h-4 px-1.5 py-0 text-[9px] ${priorityColors[task.priority]}`}
                  variant="outline"
                >
                  {task.priority}
                </Badge>

                {totalChecklist > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckSquare className="h-2.5 w-2.5" />
                    <span>
                      {completedChecklist}/{totalChecklist}
                    </span>
                  </div>
                )}
              </div>

              {task.due_date && (
                <div
                  className={`flex items-center gap-1 text-[9px] ${getDueDateClassName()}`}
                >
                  <Calendar className="h-2.5 w-2.5" />
                  <span>{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <Badge
                    className="h-3.5 bg-secondary/50 px-1.5 py-0 text-[9px]"
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
