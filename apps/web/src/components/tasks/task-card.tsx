"use client";

import { useReactFlow } from "@xyflow/react";
import {
  Calendar,
  Check,
  CheckSquare,
  GripVertical,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { TaskDragPresenceIndicator } from "@/src/components/tasks/task-drag-presence-indicator";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { type Task, useKanbanStore } from "@/src/features/kanban";
import { useTaskDragPresence } from "@/src/hooks/use-task-drag-presence";

interface TaskCardProps {
  boardId: string;
  isSelected: boolean;
  onDragStart: (task: Task) => void;
  onOpenDetail?: (taskId: string, screenX: number, screenY: number) => void;
  task: Task;
}

export const TaskCard = memo(
  ({ task, boardId, onDragStart, isSelected, onOpenDetail }: TaskCardProps) => {
    const toggleTaskSelection = useKanbanStore(
      (state) => state.toggleTaskSelection
    );
    const openTaskDetailModal = useKanbanStore(
      (state) => state.openTaskDetailModal
    );
    const updateTask = useKanbanStore((state) => state.updateTask);
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const hasSelectedTasks = useKanbanStore(
      (state) => state.selectedTaskIds.length > 0
    );
    const openTaskQuickActions = useKanbanStore(
      (state) => state.openTaskQuickActions
    );
    const draggedTaskId = useKanbanStore((state) => state.draggedTaskId);
    const setDraggedTask = useKanbanStore((state) => state.setDraggedTask);
    const isGuestMode = useKanbanStore((state) => state.isGuestMode);
    const { getViewport, setViewport } = useReactFlow();

    const {
      getTaskDragCollaborator,
      startDragging,
      stopDragging,
      updateDragPosition,
    } = useTaskDragPresence();
    const dragCollaborator = useMemo(
      () => getTaskDragCollaborator(task.id),
      [getTaskDragCollaborator, task.id]
    );

    const interactionMode = useKanbanStore((state) => state.interactionMode);
    const showCheckbox = hasSelectedTasks || interactionMode === "select";
    const isBeingDragged = draggedTaskId === task.id;

    const VIEWPORT_PADDING = 100;
    const ensureDialogVisible = useCallback(
      (
        dialogX: number,
        dialogY: number,
        dialogWidth: number,
        dialogHeight: number
      ) => {
        const viewport = getViewport();
        const { x: vpX, y: vpY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const dialogScreenX = dialogX * zoom + vpX;
        const dialogScreenY = dialogY * zoom + vpY;
        const dialogScreenRight = (dialogX + dialogWidth) * zoom + vpX;
        const dialogScreenBottom = (dialogY + dialogHeight) * zoom + vpY;

        let newVpX = vpX;
        let newVpY = vpY;
        let needsPan = false;

        if (dialogScreenX < VIEWPORT_PADDING) {
          newVpX = vpX + (VIEWPORT_PADDING - dialogScreenX);
          needsPan = true;
        } else if (dialogScreenRight > screenWidth - VIEWPORT_PADDING) {
          newVpX = vpX - (dialogScreenRight - (screenWidth - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (dialogScreenY < VIEWPORT_PADDING) {
          newVpY = vpY + (VIEWPORT_PADDING - dialogScreenY);
          needsPan = true;
        } else if (dialogScreenBottom > screenHeight - VIEWPORT_PADDING) {
          newVpY =
            vpY - (dialogScreenBottom - (screenHeight - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (needsPan) {
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 0 });
        }
      },
      [getViewport, setViewport]
    );

    const dragStartPos = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
    };

    const handleGlobalDragOver = useCallback(
      (e: DragEvent) => {
        if (isDragging.current) {
          updateDragPosition(e.clientX, e.clientY);
        }
      },
      [updateDragPosition]
    );

    useEffect(
      () => () => {
        document.removeEventListener("dragover", handleGlobalDragOver, {
          capture: true,
        });
      },
      [handleGlobalDragOver]
    );

    const handleDragStart = (e: React.DragEvent) => {
      if (showCheckbox) {
        e.preventDefault();
        return;
      }

      // Add global listener to track drag position reliably
      document.addEventListener("dragover", handleGlobalDragOver, {
        capture: true,
      });

      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const bg = isDark
        ? "linear-gradient(180deg, #1c1c1e 0%, #18181a 100%)"
        : "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)";
      const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
      const textColor = isDark ? "#f5f5f5" : "#18181b";
      const mutedColor = isDark ? "#a1a1aa" : "#71717a";
      const shadowInsetTop = isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(255,255,255,0.8)";
      const shadowInsetBottom = isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)";
      const shadowOuter = isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.15)";

      const priorityColors: Record<string, { bg: string; text: string }> = {
        low: { bg: "rgba(59,130,246,0.2)", text: "#60a5fa" },
        medium: { bg: "rgba(234,179,8,0.2)", text: "#facc15" },
        high: { bg: "rgba(239,68,68,0.2)", text: "#f87171" },
      };
      const pColor = priorityColors[task.priority] ?? {
        bg: "rgba(234,179,8,0.2)",
        text: "#facc15",
      };

      const ghost = document.createElement("div");
      ghost.style.cssText = `
        position: fixed;
        top: -1000px;
        left: -1000px;
        width: 220px;
        padding: 10px 12px;
        background: ${bg};
        border: 1px solid ${border};
        border-radius: 8px;
        box-shadow: 
          inset 0 1px 0 ${shadowInsetTop},
          inset 0 -1px 0 ${shadowInsetBottom},
          0 4px 12px -4px ${shadowOuter},
          0 8px 24px -8px ${shadowOuter};
        font-family: system-ui, -apple-system, sans-serif;
        pointer-events: none;
        z-index: 9999;
      `;

      // Build content DOM nodes programmatically to prevent XSS
      const container = document.createElement("div");

      // Title
      const titleDiv = document.createElement("div");
      titleDiv.textContent = task.title;
      titleDiv.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: ${textColor};
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      container.appendChild(titleDiv);

      // Description (truncated)
      if (task.description) {
        const desc =
          task.description.length > 50
            ? `${task.description.slice(0, 50)}...`
            : task.description;
        const descDiv = document.createElement("div");
        descDiv.textContent = desc;
        descDiv.style.cssText = `
          margin-top: 4px;
          font-size: 10px;
          color: ${mutedColor};
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;
        container.appendChild(descDiv);
      }

      // Priority & Progress row
      const priorityRow = document.createElement("div");
      priorityRow.style.cssText = `
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      const prioritySpan = document.createElement("span");
      prioritySpan.textContent = task.priority;
      prioritySpan.style.cssText = `
        padding: 2px 6px;
        font-size: 9px;
        font-weight: 500;
        border-radius: 4px;
        background: ${pColor.bg};
        color: ${pColor.text};
      `;
      priorityRow.appendChild(prioritySpan);

      if (task.progress > 0) {
        const progressSpan = document.createElement("span");
        progressSpan.textContent = `${task.progress}%`;
        progressSpan.style.cssText = `
          font-size: 9px;
          color: ${mutedColor};
        `;
        priorityRow.appendChild(progressSpan);
      }

      container.appendChild(priorityRow);

      // Tags (up to 2)
      if (task.tags && task.tags.length > 0) {
        const tagBg = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
        const tagsDiv = document.createElement("div");
        tagsDiv.style.cssText = `
          margin-top: 6px;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        `;

        for (const tag of task.tags.slice(0, 2)) {
          const tagSpan = document.createElement("span");
          tagSpan.textContent = tag;
          tagSpan.style.cssText = `
            padding: 2px 6px;
            font-size: 8px;
            border-radius: 3px;
            background: ${tagBg};
            color: ${mutedColor};
          `;
          tagsDiv.appendChild(tagSpan);
        }

        if (task.tags.length > 2) {
          const overflowSpan = document.createElement("span");
          overflowSpan.textContent = `+${task.tags.length - 2}`;
          overflowSpan.style.cssText = `
            font-size: 8px;
            color: ${mutedColor};
          `;
          tagsDiv.appendChild(overflowSpan);
        }

        container.appendChild(tagsDiv);
      }

      ghost.appendChild(container);
      document.body.appendChild(ghost);

      e.dataTransfer.setDragImage(ghost, 100, 20);
      requestAnimationFrame(() => {
        document.body.removeChild(ghost);
      });

      isDragging.current = true;
      onDragStart(task);
      startDragging(task, e.clientX, e.clientY);
    };

    const handleDragEnd = () => {
      isDragging.current = false;
      setDraggedTask(null);
      stopDragging();
      document.removeEventListener("dragover", handleGlobalDragOver, {
        capture: true,
      });
    };

    // Note: We use global dragover for position tracking instead of onDrag
    // because onDrag is unreliable in some browsers (like Firefox)
    const handleDrag = (_e: React.DragEvent) => {
      // No-op, position tracked by global dragover
    };

    const handleClick = (e: React.MouseEvent) => {
      const distance = Math.sqrt(
        (e.clientX - dragStartPos.current.x) ** 2 +
          (e.clientY - dragStartPos.current.y) ** 2
      );

      if (isDragging.current || distance > 5) {
        return;
      }

      if (showCheckbox) {
        e.stopPropagation();
        toggleTaskSelection(task.id);
        return;
      }

      if (onOpenDetail) {
        onOpenDetail(task.id, e.clientX, e.clientY);
      } else {
        const result = openTaskDetailModal({
          taskId: task.id,
          boardId,
        });
        if (!(result.isExisting || result.usedLastPosition)) {
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
    };

    const handleStatusToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (task.status === "trash") {
        updateTask(task.id, { status: "todo" });
      } else {
        updateTask(task.id, {
          status: task.status === "done" ? "todo" : "done",
        });
      }
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (task.status === "trash") {
        deleteTask(task.id);
      } else {
        updateTask(task.id, { status: "trash" });
      }
    };

    const handleCheckboxChange = (_checked: boolean) => {
      toggleTaskSelection(task.id);
    };

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const SPACING = 20;
        const MENU_HEIGHT = 300;
        const STACK_GAP = 10;

        const state = useKanbanStore.getState();
        const boardPosition = state.boardPositions.byId[boardId];
        const taskQuickActions = state.taskQuickActions;

        const boardWidth = boardPosition?.width ?? 400;
        const boardX = boardPosition?.x ?? 0;
        const boardY = boardPosition?.y ?? 0;
        const menuX = boardX + boardWidth + SPACING;
        const existingMenusForBoard = Object.values(taskQuickActions).filter(
          (qa) => qa && qa.boardId === boardId
        );
        const stackOffset =
          existingMenusForBoard.length * (MENU_HEIGHT + STACK_GAP);
        const menuY = boardY + stackOffset;

        openTaskQuickActions(task.id, task.board_id, task.column_id, {
          x: menuX,
          y: menuY,
        });

        setTimeout(
          () => ensureDialogVisible(menuX, menuY, 200, MENU_HEIGHT),
          50
        );
      },
      [
        task.id,
        task.board_id,
        task.column_id,
        boardId,
        openTaskQuickActions,
        ensureDialogVisible,
      ]
    );

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
          className={`relative cursor-default rounded border bg-card p-2 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md ${
            isSelected
              ? "border-primary shadow-lg"
              : "border-border/40 dark:border-border/70"
          }`}
          data-task-id={task.id}
          data-testid="task-card"
        >
          <button
            aria-label={`Toggle selection for task ${task.title}`}
            className="absolute inset-0 z-10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskSelection(task.id);
            }}
            type="button"
          >
            <span className="sr-only">Toggle task selection</span>
          </button>

          <div className="pointer-events-none relative z-20 flex items-start gap-1.5">
            {showCheckbox && (
              <div className="pointer-events-auto">
                <Checkbox
                  checked={isSelected}
                  className="mt-0.5"
                  onCheckedChange={handleCheckboxChange}
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <h4
                className={`line-clamp-2 font-medium text-card-foreground text-xs ${
                  task.status === "done" ? "line-through opacity-60" : ""
                }`}
              >
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
                    data-testid="task-priority-badge"
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
      <div
        className={`group relative overflow-visible rounded border transition-all hover:shadow-md ${
          isSelected
            ? "border-primary shadow-lg"
            : dragCollaborator
              ? "border-transparent"
              : "border-border/40 dark:border-border/70"
        } ${task.status === "done" ? "bg-muted/30" : "bg-card"}`}
        data-task-id={task.id}
        data-testid="task-card"
      >
        {dragCollaborator && (
          <TaskDragPresenceIndicator collaborator={dragCollaborator} />
        )}

        {isBeingDragged && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded bg-background/80 backdrop-blur-[2px]">
            <GripVertical className="h-5 w-5 animate-pulse text-primary" />
          </div>
        )}
        {!isGuestMode && (
          <div className="absolute inset-y-0 left-0 flex w-9 flex-col border-border/40 border-r opacity-0 transition-opacity group-hover:opacity-100">
            <button
              className={`flex flex-1 items-center justify-center rounded-tl transition-all active:scale-95 ${
                task.status === "trash"
                  ? "text-muted-foreground/70 hover:bg-green-500 hover:text-white"
                  : task.status === "done"
                    ? "text-muted-foreground/70 hover:bg-primary hover:text-white"
                    : "text-muted-foreground/70 hover:bg-green-500 hover:text-white"
              }`}
              onClick={handleStatusToggle}
              title={
                task.status === "trash"
                  ? "Restore task"
                  : task.status === "done"
                    ? "Mark as to do"
                    : "Mark as done"
              }
              type="button"
            >
              {task.status === "trash" || task.status === "done" ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <div className="h-px w-full bg-border/40" />
            <button
              className="flex flex-1 items-center justify-center rounded-bl text-muted-foreground/70 transition-all hover:bg-red-500 hover:text-white active:scale-95"
              onClick={handleDelete}
              title={
                task.status === "trash" ? "Delete permanently" : "Move to trash"
              }
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/** biome-ignore lint/a11y/noStaticElementInteractions: TODO: i'll check later */}
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: TODO: i'll check later */}
        <div
          className={`relative h-full w-full bg-inherit p-2 transition-transform duration-300 ease-out ${
            isGuestMode ? "" : "group-hover:translate-x-9"
          }`}
          draggable={!isGuestMode}
          onClick={isGuestMode ? undefined : handleClick}
          onContextMenu={isGuestMode ? undefined : handleContextMenu}
          onDrag={isGuestMode ? undefined : handleDrag}
          onDragEnd={isGuestMode ? undefined : handleDragEnd}
          onDragStart={isGuestMode ? undefined : handleDragStart}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!showCheckbox) {
                const result = openTaskDetailModal({
                  taskId: task.id,
                  boardId,
                });
                if (!(result.isExisting || result.usedLastPosition)) {
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
            }
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <h4
                className={`line-clamp-2 font-medium text-card-foreground text-xs ${
                  task.status === "done" ? "line-through opacity-60" : ""
                } ${task.status === "trash" ? "opacity-40 grayscale" : ""}`}
              >
                {task.title}
                {task.status === "trash" && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-red-500/10 px-1 py-0.5 font-bold text-[8px] text-red-500 uppercase tracking-wider">
                    Trash
                  </span>
                )}
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
                    data-testid="task-priority-badge"
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
      </div>
    );
  }
);

TaskCard.displayName = "TaskCard";
