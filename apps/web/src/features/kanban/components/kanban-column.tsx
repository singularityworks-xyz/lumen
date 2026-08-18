/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReactFlow } from "@xyflow/react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  GripVertical,
  Plus,
  SquarePen,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { TaskCard } from "@/src/components/tasks/task-card";
import { useCollaboration } from "@/src/features/collab";
import { useCachedProfileImage } from "@/src/hooks/use-cached-profile-image";
import { useColumnDragPresence } from "@/src/hooks/use-column-drag-presence";
import { useTaskDragPresence } from "@/src/hooks/use-task-drag-presence";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../store/kanban-store";
import type { DenormalizedColumn, Task } from "../types";
import { ICON_MAP } from "../utils/color-icon-utils";

interface KanbanColumnProps {
  boardId: string;
  column: DenormalizedColumn;
  onOpenTaskDetail?: (taskId: string, screenX: number, screenY: number) => void;
}

export const KanbanColumn = memo(
  ({ column, boardId, onOpenTaskDetail }: KanbanColumnProps) => {
    const [_isHovered, setIsHovered] = useState(false);
    const [_isDragOver, setIsDragOver] = useState(false);
    const columnUi = useKanbanStore((state) => state.columnUi[column.id]);
    const updateColumnUi = useKanbanStore((state) => state.updateColumnUi);

    const bottomView = columnUi?.bottomView ?? "finished";
    const activeBottomTasks =
      bottomView === "finished"
        ? column.tasks.filter((t) => t.status === "done")
        : column.tasks.filter((t) => t.status === "trash");

    const isFinishedExpanded =
      columnUi?.isBottomExpanded ?? activeBottomTasks.length <= 2;

    const openColumnQuickActions = useKanbanStore(
      (state) => state.openColumnQuickActions
    );
    const openColumnDialog = useKanbanStore((state) => state.openColumnDialog);
    const columnHeaderRef = useRef<HTMLDivElement>(null);
    const columnBodyRef = useRef<HTMLElement>(null);
    const _draggedTaskId = useKanbanStore((state) => state.draggedTaskId);
    const setDraggedTask = useKanbanStore((state) => state.setDraggedTask);
    const moveTask = useKanbanStore((state) => state.moveTask);
    const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);
    const { getViewport, setViewport, screenToFlowPosition, getNode } =
      useReactFlow();

    const { startDragging, stopDragging } = useTaskDragPresence();
    const { draggingCollaborators } = useColumnDragPresence();
    const { localUser } = useCollaboration();

    const dragCollaborator = draggingCollaborators.find(
      (c) => c.draggingColumn?.columnId === column.id
    );

    const getAvailableTargetBoards = useCallback(() => {
      const state = useKanbanStore.getState();
      const sourceBoard = state.boards.byId[boardId];
      const workspaceId = sourceBoard?.workspace_id;
      return state.boards.allIds
        .map((id) => state.boards.byId[id])
        .filter((board): board is NonNullable<typeof board> => {
          if (!board || board.id === boardId) {
            return false;
          }
          if (!workspaceId) {
            return true;
          }
          return board.workspace_id === workspaceId;
        });
    }, [boardId]);

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: column.id,
      data: {
        type: "column",
        columnId: column.id,
        boardId,
      },
    });

    const isBeingDragged = !!dragCollaborator;
    const dragColor = dragCollaborator?.color ?? localUser?.color ?? "#3b82f6";
    const dragName = dragCollaborator?.name ?? localUser?.name ?? "You";
    const dragImage = dragCollaborator?.image ?? localUser?.image;

    const { imageUrl, hasImage } = useCachedProfileImage(dragImage);

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const columnTasks = column.tasks;
    const todoTasks = useMemo(
      () =>
        columnTasks.filter((t) => t.status !== "done" && t.status !== "trash"),
      [columnTasks]
    );
    const doneTasks = useMemo(
      () => columnTasks.filter((t) => t.status === "done"),
      [columnTasks]
    );
    const trashTasks = useMemo(
      () => columnTasks.filter((t) => t.status === "trash"),
      [columnTasks]
    );

    const taskCount = columnTasks.length;

    const handleDragStart = useCallback(
      (task: Task) => {
        setDraggedTask(task.id);
        startDragging(task);
      },
      [setDraggedTask, startDragging]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const state = useKanbanStore.getState();
        const currentDraggedTaskId = state.draggedTaskId;
        const currentDraggedTask = currentDraggedTaskId
          ? state.tasks.byId[currentDraggedTaskId]
          : null;
        if (currentDraggedTask && currentDraggedTask.column_id !== column.id) {
          moveTask(
            currentDraggedTask.id,
            currentDraggedTask.column_id,
            column.id,
            boardId
          );
        }
        setDraggedTask(null);
        stopDragging();
      },
      [column.id, boardId, moveTask, setDraggedTask, stopDragging]
    );

    const calculateQuickActionsPosition = useCallback(() => {
      const QUICK_ACTIONS_HEIGHT = 200;
      const SPACING = 20;

      const state = useKanbanStore.getState();
      const boardNode = getNode(boardId);
      const boardPos = state.boardPositions.byId[boardId];

      if (!(boardNode && boardPos)) {
        const rect = columnHeaderRef.current?.getBoundingClientRect();
        if (rect) {
          return screenToFlowPosition({
            x: rect.right + 20,
            y: rect.top,
          });
        }
        return { x: 0, y: 0 };
      }

      const boardWidth = boardNode.width ?? 400;
      const baseX = boardPos.x + boardWidth + SPACING;
      const baseY = boardPos.y;

      const existingMenus = Object.values(
        state.columnQuickActions ?? {}
      ).filter((qa) => qa?.boardId === boardId && qa?.columnId !== column.id);

      const yOffset = existingMenus.length * (QUICK_ACTIONS_HEIGHT + SPACING);

      return {
        x: baseX,
        y: baseY + yOffset,
      };
    }, [boardId, getNode, screenToFlowPosition, column.id]);

    const DIALOG_WIDTH = 320;
    const DIALOG_HEIGHT = 180;
    const VIEWPORT_PADDING = 100;

    const ensureDialogVisible = useCallback(
      (dialogX: number, dialogY: number) => {
        const viewport = getViewport();
        const { x: vpX, y: vpY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const dialogScreenX = dialogX * zoom + vpX;
        const dialogScreenY = dialogY * zoom + vpY;
        const dialogScreenRight = (dialogX + DIALOG_WIDTH) * zoom + vpX;
        const dialogScreenBottom = (dialogY + DIALOG_HEIGHT) * zoom + vpY;

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

    const handleHeaderContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const flowPos = calculateQuickActionsPosition();
        openColumnQuickActions(column.id, boardId, false, flowPos);
        ensureDialogVisible(flowPos.x, flowPos.y);
      },
      [
        column.id,
        boardId,
        openColumnQuickActions,
        calculateQuickActionsPosition,
        ensureDialogVisible,
      ]
    );

    const handleBodyContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const flowPos = calculateQuickActionsPosition();
        openColumnQuickActions(column.id, boardId, true, flowPos);
        ensureDialogVisible(flowPos.x, flowPos.y);
      },
      [
        column.id,
        boardId,
        openColumnQuickActions,
        calculateQuickActionsPosition,
        ensureDialogVisible,
      ]
    );

    const handleDirectRename = useCallback(() => {
      const quickActionsPos = calculateQuickActionsPosition();
      openColumnQuickActions(column.id, boardId, false, quickActionsPos);
      const QA_WIDTH = 200;
      const RENAME_DIALOG_OFFSET = 40;
      const renameDialogX = quickActionsPos.x + QA_WIDTH + RENAME_DIALOG_OFFSET;
      const renameDialogY = quickActionsPos.y;

      const state = useKanbanStore.getState();
      openColumnDialog({
        type: "rename",
        columnId: column.id,
        columnName: column.name,
        columnDescription: column.description,
        boardId,
        boardName: state.boards.byId[boardId]?.name ?? "Unknown Board",
        inputValue: column.name,
        descriptionValue: column.description,
        position: { x: renameDialogX, y: renameDialogY },
      });

      setTimeout(() => ensureDialogVisible(renameDialogX, renameDialogY), 100);
    }, [
      column.id,
      column.name,
      column.description,
      boardId,
      calculateQuickActionsPosition,
      openColumnQuickActions,
      openColumnDialog,
      ensureDialogVisible,
    ]);

    const handleDirectMoveToBoard = useCallback(() => {
      if (getAvailableTargetBoards().length === 0) {
        return;
      }

      const quickActionsPos = calculateQuickActionsPosition();
      openColumnQuickActions(column.id, boardId, false, quickActionsPos);

      const QA_WIDTH = 200;
      const MOVE_DIALOG_OFFSET = 40;

      const moveDialogX = quickActionsPos.x + QA_WIDTH + MOVE_DIALOG_OFFSET;
      const moveDialogY = quickActionsPos.y + 130;

      const state = useKanbanStore.getState();
      openColumnDialog({
        type: "move",
        columnId: column.id,
        columnName: column.name,
        boardId,
        boardName: state.boards.byId[boardId]?.name ?? "Unknown Board",
        position: { x: moveDialogX, y: moveDialogY },
      });

      setTimeout(() => ensureDialogVisible(moveDialogX, moveDialogY), 100);
    }, [
      getAvailableTargetBoards,
      calculateQuickActionsPosition,
      openColumnQuickActions,
      column.id,
      column.name,
      boardId,
      openColumnDialog,
      ensureDialogVisible,
    ]);

    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );

    const handleAddTaskClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const flowPos = calculateQuickActionsPosition();
        openCreateTaskModal({
          columnId: column.id,
          boardId,
          position: flowPos,
          sourceType: "column-menu",
        });
      },
      [column.id, boardId, openCreateTaskModal, calculateQuickActionsPosition]
    );

    return (
      <section
        aria-label={`Column: ${column.name}`}
        className="relative flex max-h-full w-[285px] min-w-[285px] max-w-[285px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/60"
        data-testid="kanban-column"
        id={`kanban-column-${column.id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        ref={setNodeRef}
        style={style}
      >
        {isBeingDragged && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm"
            style={{
              border: `2px solid ${dragColor}`,
            }}
          >
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 p-4">
              <GripVertical className="h-10 w-10 animate-pulse text-muted-foreground/50" />
              <span className="animate-pulse font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">
                Being moved
              </span>
              <div
                className="absolute top-2 right-2 h-8 w-8 overflow-hidden rounded-full border-2 shadow-sm"
                style={{ borderColor: dragColor }}
                title={dragName}
              >
                {hasImage && imageUrl ? (
                  <Image
                    alt={dragName}
                    className="h-full w-full object-cover"
                    height={32}
                    src={imageUrl}
                    width={32}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center bg-muted"
                    style={{ backgroundColor: dragColor }}
                  >
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/** biome-ignore lint/a11y/noStaticElementInteractions: required */}
        <div
          className="group cursor-grab bg-muted/90 px-2.5 py-2 active:cursor-grabbing dark:bg-secondary/90"
          data-testid="column-header"
          onContextMenu={handleHeaderContextMenu}
          ref={columnHeaderRef}
          {...attributes}
          {...listeners}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(column.accentColor || column.icon) && (
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                    !column.accentColor && "bg-muted"
                  )}
                  style={
                    column.accentColor
                      ? { backgroundColor: `${column.accentColor}25` }
                      : {}
                  }
                >
                  {(() => {
                    const IconComponent = column.icon
                      ? ICON_MAP[column.icon]
                      : null;
                    if (IconComponent) {
                      return (
                        <IconComponent
                          className="h-3 w-3"
                          style={
                            column.accentColor
                              ? { color: column.accentColor }
                              : {}
                          }
                        />
                      );
                    }
                    return (
                      <Circle
                        className="h-2.5 w-2.5"
                        style={
                          column.accentColor
                            ? {
                                fill: column.accentColor,
                                color: column.accentColor,
                              }
                            : {}
                        }
                      />
                    );
                  })()}
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                <h3 className="font-semibold text-card-foreground text-xs">
                  {column.name}
                </h3>
                <p className="line-clamp-1 text-[10px] text-foreground">
                  {column.description || `This is ${column.name} column`}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  aria-label="Rename column"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDirectRename();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  type="button"
                >
                  <SquarePen className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label="Add task to column"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid="add-task-trigger"
                onClick={handleAddTaskClick}
                onPointerDown={(e) => e.stopPropagation()}
                type="button"
              >
                <Plus className="h-3 w-3" />
              </button>
              <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {taskCount}
              </span>
              {column.progressValue !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-medium text-[10px] ${
                    column.progressValue <= 20
                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                      : column.progressValue <= 40
                        ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        : column.progressValue <= 60
                          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                          : column.progressValue <= 80
                            ? "bg-lime-500/20 text-lime-600 dark:text-lime-400"
                            : "bg-green-500/20 text-green-600 dark:text-green-400"
                  }`}
                >
                  {column.progressValue}%
                </span>
              )}
              <button
                aria-label="Move column to another board"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDirectMoveToBoard();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                type="button"
              >
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <section
          aria-label="Task drop zone"
          className="min-h-40 flex-1 space-y-1.5 overflow-y-auto p-2 transition-all"
          onContextMenu={handleBodyContextMenu}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          ref={columnBodyRef}
        >
          {todoTasks.map((task) => (
            <TaskCard
              boardId={boardId}
              isSelected={selectedTaskIds.includes(task.id)}
              key={task.id}
              onDragStart={handleDragStart}
              onOpenDetail={onOpenTaskDetail}
              task={task}
            />
          ))}

          {todoTasks.length === 0 && (
            <div
              className={`fade-in zoom-in-95 flex animate-in flex-col items-center justify-center gap-1 p-4 text-center duration-300 ${
                doneTasks.length > 0 ? "py-6" : "h-full min-h-40"
              }`}
            >
              {doneTasks.length > 0 ? (
                <p className="font-medium text-muted-foreground/70 text-xs">
                  Hurray! All done
                </p>
              ) : (
                <>
                  <p className="font-medium text-muted-foreground/50 text-xs">
                    No tasks yet
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    Drag or add a new task
                  </p>
                </>
              )}
            </div>
          )}

          {(doneTasks.length > 0 || trashTasks.length > 0) && (
            <div className="mt-4 space-y-1.5 pt-2">
              {/** biome-ignore lint/a11y/useSemanticElements: skip */}
              <div
                className="flex cursor-pointer items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateColumnUi(column.id, {
                    isBottomExpanded: !isFinishedExpanded,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    updateColumnUi(column.id, {
                      isBottomExpanded: !isFinishedExpanded,
                    });
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <button
                  className="flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateColumnUi(column.id, {
                      isBottomExpanded: !isFinishedExpanded,
                    });
                  }}
                  type="button"
                >
                  {isFinishedExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    className={`flex items-center gap-1 font-medium text-[10px] uppercase tracking-wider transition-colors hover:text-foreground ${
                      bottomView === "finished"
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateColumnUi(column.id, {
                        bottomView: "finished",
                        isBottomExpanded: true,
                      });
                    }}
                    type="button"
                  >
                    <Check className="h-2.5 w-2.5" />
                    <span>Finished</span>
                    <span className="text-muted-foreground/70">
                      {doneTasks.length}
                    </span>
                  </button>
                  <span className="text-muted-foreground/30">|</span>
                  <button
                    className={`flex items-center gap-1 font-medium text-[10px] uppercase tracking-wider transition-colors hover:text-foreground ${
                      bottomView === "trash"
                        ? "text-red-500"
                        : "text-muted-foreground/60"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateColumnUi(column.id, {
                        bottomView: "trash",
                        isBottomExpanded: true,
                      });
                    }}
                    type="button"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    <span>Trash</span>
                    <span className="text-muted-foreground/70">
                      {trashTasks.length}
                    </span>
                  </button>
                </div>

                <div className="relative ml-2 flex-1">
                  <div className="h-px w-full bg-border/40" />
                </div>
              </div>

              {isFinishedExpanded && activeBottomTasks.length > 0 && (
                <div className="fade-in slide-in-from-top-1 mt-2 animate-in space-y-1.5 duration-200">
                  {activeBottomTasks.map((task) => (
                    <TaskCard
                      boardId={boardId}
                      isSelected={selectedTaskIds.includes(task.id)}
                      key={task.id}
                      onDragStart={handleDragStart}
                      onOpenDetail={onOpenTaskDetail}
                      task={task}
                    />
                  ))}
                </div>
              )}

              {isFinishedExpanded && activeBottomTasks.length === 0 && (
                <div className="py-8 text-center text-[10px] text-muted-foreground/40 italic">
                  Empty {bottomView}
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    );
  }
);

KanbanColumn.displayName = "KanbanColumn";
