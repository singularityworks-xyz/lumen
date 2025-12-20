"use client";

import { useReactFlow } from "@xyflow/react";
import { Calendar, Check, CheckSquare, RotateCcw, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";
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
    const updateTask = useKanbanStore((state) => state.updateTask);
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);
    const openTaskQuickActions = useKanbanStore(
      (state) => state.openTaskQuickActions
    );
    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );
    const taskQuickActions = useKanbanStore((state) => state.taskQuickActions);
    const { getViewport, setViewport, screenToFlowPosition } = useReactFlow();

    const showCheckbox = selectedTaskIds.length > 0;

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
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 400 });
        }
      },
      [getViewport, setViewport]
    );

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
      const distance = Math.sqrt(
        (e.clientX - dragStartPos.current.x) ** 2 +
          (e.clientY - dragStartPos.current.y) ** 2
      );

      if (isDragging.current || distance > 5) {
        return;
      }

      if (showCheckbox) {
        return;
      }

      if (onOpenDetail) {
        onOpenDetail(task.id, e.clientX, e.clientY);
      } else {
        const result = openTaskDetailModal({
          taskId: task.id,
          boardId,
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

    // biome-ignore lint/correctness/useExhaustiveDependencies: TODO: i'll check later
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const SPACING = 20;
        const MENU_HEIGHT = 300;
        const STACK_GAP = 10;

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
        boardPosition,
        taskQuickActions,
        screenToFlowPosition,
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
          className={`cursor-default rounded border bg-card p-2 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md ${
            isSelected
              ? "border-primary shadow-lg"
              : "border-border/40 dark:border-border/70"
          }`}
          data-task-id={task.id}
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
        className={`group relative overflow-hidden rounded border transition-all hover:shadow-md ${
          isSelected
            ? "border-primary shadow-lg"
            : "border-border/40 dark:border-border/70"
        } ${task.status === "done" ? "bg-muted/30" : "bg-card"}`}
        data-task-id={task.id}
      >
        <div className="absolute inset-y-0 left-0 flex w-9 flex-col border-border/40 border-r opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className={`flex flex-1 items-center justify-center rounded-tl transition-all active:scale-95 ${
              task.status === "trash"
                ? "text-muted-foreground/70 hover:bg-green-500 hover:text-white"
                : // biome-ignore lint/style/noNestedTernary: better for readability
                  task.status === "done"
                  ? "text-muted-foreground/70 hover:bg-primary hover:text-white"
                  : "text-muted-foreground/70 hover:bg-green-500 hover:text-white"
            }`}
            onClick={handleStatusToggle}
            title={
              task.status === "trash"
                ? "Restore task"
                : // biome-ignore lint/style/noNestedTernary: better for readability
                  task.status === "done"
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

        {/** biome-ignore lint/a11y/noStaticElementInteractions: TODO: i'll check later */}
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: TODO: i'll check later */}
        <div
          className="relative h-full w-full bg-inherit p-2 transition-transform duration-300 ease-out group-hover:translate-x-9"
          draggable
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!showCheckbox) {
                const result = openTaskDetailModal({
                  taskId: task.id,
                  boardId,
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
