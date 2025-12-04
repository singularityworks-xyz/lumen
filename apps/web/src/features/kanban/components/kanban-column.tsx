/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { TaskCard } from "@/src/components/tasks/task-card";
import { ColumnContextMenu } from "../../../components/column-context-menu";
import { ColumnConflictDialog } from "../../../components/dialogs/column-conflict-dialog";
import { DeleteColumnDialog } from "../../../components/dialogs/delete-column-dialog";
import { MoveColumnDialog } from "../../../components/dialogs/move-column-dialog";
import { RenameColumnDialog } from "../../../components/dialogs/rename-column-dialog";
import { useKanbanStore } from "../store/kanban-store";
import type { DenormalizedColumn, Task } from "../types";

type KanbanColumnProps = {
  column: DenormalizedColumn;
  boardId: string;
  onOpenTaskDetail?: (taskId: string, screenX: number, screenY: number) => void;
};

export const KanbanColumn = memo(
  ({ column, boardId, onOpenTaskDetail }: KanbanColumnProps) => {
    const [_isHovered, setIsHovered] = useState(false);
    const [_isDragOver, setIsDragOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      type: "header" | "body";
    } | null>(null);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const draggedTaskId = useKanbanStore((state) => state.draggedTaskId);
    const tasksStore = useKanbanStore((state) => state.tasks);
    const setDraggedTask = useKanbanStore((state) => state.setDraggedTask);
    const moveTask = useKanbanStore((state) => state.moveTask);
    const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);
    const updateColumn = useKanbanStore((state) => state.updateColumn);
    const deleteColumn = useKanbanStore((state) => state.deleteColumn);
    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const moveColumnToBoard = useKanbanStore(
      (state) => state.moveColumnToBoard
    );
    const boards = useKanbanStore((state) => state.boards);
    const columnsStore = useKanbanStore((state) => state.columns);

    // Get dragged task from store
    const draggedTask = draggedTaskId ? tasksStore.byId[draggedTaskId] : null;

    const availableTargetBoards = useMemo(() => {
      const sourceBoard = boards.byId[boardId];
      const workspaceId = sourceBoard?.workspace_id;
      return boards.allIds
        .map((id) => boards.byId[id])
        .filter((board): board is NonNullable<typeof board> => {
          if (!board || board.id === boardId) {
            return false;
          }
          if (!workspaceId) {
            return true;
          }
          return board.workspace_id === workspaceId;
        });
    }, [boards, boardId]);

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

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const columnTasks = column.tasks;
    const taskCount = columnTasks.length;

    const handleDragStart = useCallback(
      (task: Task) => {
        setDraggedTask(task.id);
      },
      [setDraggedTask]
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

        if (draggedTask && draggedTask.column_id !== column.id) {
          moveTask(draggedTask.id, draggedTask.column_id, column.id, boardId);
        }
        setDraggedTask(null);
      },
      [draggedTask, column.id, boardId, moveTask, setDraggedTask]
    );

    const handleHeaderContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "header" });
    }, []);

    const handleBodyContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, type: "body" });
    }, []);

    const handleAddTask = useCallback(() => {
      openCreateTaskModal(column.id, boardId);
    }, [column.id, boardId, openCreateTaskModal]);

    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [targetBoardId, setTargetBoardId] = useState<string | null>(null);
    const [showConflictDialog, setShowConflictDialog] = useState(false);
    const [conflictExistingColumn, setConflictExistingColumn] = useState<{
      id: string;
      name: string;
    } | null>(null);

    const handleOpenMoveDialog = useCallback(() => {
      if (availableTargetBoards.length === 0) {
        return;
      }
      setTargetBoardId(availableTargetBoards[0]?.id ?? null);
      setShowMoveDialog(true);
    }, [availableTargetBoards]);

    const handleMoveConfirm = (selectedTargetBoardId: string) => {
      setTargetBoardId(selectedTargetBoardId);
      const targetBoard = boards.byId[selectedTargetBoardId];
      if (!targetBoard) {
        return;
      }

      const existingColumn = targetBoard.column_ids
        .map((colId) => columnsStore.byId[colId])
        .find((col) => col?.name === column.name);

      if (!existingColumn) {
        moveColumnToBoard(boardId, column.id, selectedTargetBoardId);
        setShowMoveDialog(false);
        return;
      }

      setConflictExistingColumn({
        id: existingColumn.id,
        name: existingColumn.name,
      });
      setShowMoveDialog(false);
      setShowConflictDialog(true);
    };

    const handleRenameAndMove = (newName: string) => {
      if (!targetBoardId) {
        return;
      }

      updateColumn(column.id, { name: newName });
      moveColumnToBoard(boardId, column.id, targetBoardId);
      setShowConflictDialog(false);
      setConflictExistingColumn(null);
    };

    const handleReplaceExisting = () => {
      if (!(targetBoardId && conflictExistingColumn)) {
        return;
      }

      deleteColumn(targetBoardId, conflictExistingColumn.id);
      moveColumnToBoard(boardId, column.id, targetBoardId);
      setShowConflictDialog(false);
      setConflictExistingColumn(null);
    };

    const handleRename = useCallback(
      (newName: string) => {
        updateColumn(column.id, { name: newName });
      },
      [column.id, updateColumn]
    );

    const handleRemove = useCallback(() => {
      deleteColumn(boardId, column.id);
    }, [boardId, column.id, deleteColumn]);

    return (
      <section
        aria-label={`Column: ${column.name}`}
        className="flex max-h-full w-[285px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/60"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        ref={setNodeRef}
        style={style}
      >
        {/** biome-ignore lint/a11y/noStaticElementInteractions: required */}
        <div
          className="group cursor-grab bg-muted/90 px-2.5 py-2 active:cursor-grabbing dark:bg-secondary/90"
          onContextMenu={handleHeaderContextMenu}
          {...attributes}
          {...listeners}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-card-foreground text-xs">
                {column.name}
              </h3>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  aria-label="Rename column"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRenameDialog(true);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  type="button"
                >
                  <SquarePen className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {taskCount}
              </span>
              <button
                aria-label="Move column to another board"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMoveDialog();
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
        >
          {columnTasks.length > 0 ? (
            columnTasks.map((task) => (
              <TaskCard
                boardId={boardId}
                isSelected={selectedTaskIds.includes(task.id)}
                key={task.id}
                onDragStart={handleDragStart}
                onOpenDetail={onOpenTaskDetail}
                task={task}
              />
            ))
          ) : (
            <div className="flex h-40 items-center justify-center text-center">
              <p className="text-muted-foreground/60 text-xs">No tasks yet</p>
            </div>
          )}
        </section>

        {contextMenu && contextMenu.type === "header" && (
          <ColumnContextMenu
            onClose={() => setContextMenu(null)}
            onMoveToBoard={handleOpenMoveDialog}
            onRemove={() => {
              setContextMenu(null);
              setShowDeleteDialog(true);
            }}
            onRename={() => {
              setContextMenu(null);
              setShowRenameDialog(true);
            }}
            x={contextMenu.x}
            y={contextMenu.y}
          />
        )}

        {contextMenu && contextMenu.type === "body" && (
          <ColumnContextMenu
            onAddTask={handleAddTask}
            onClose={() => setContextMenu(null)}
            x={contextMenu.x}
            y={contextMenu.y}
          />
        )}

        {showRenameDialog && (
          <RenameColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            currentName={column.name}
            onClose={() => setShowRenameDialog(false)}
            onRename={handleRename}
          />
        )}

        {showDeleteDialog && (
          <DeleteColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            onClose={() => setShowDeleteDialog(false)}
            onConfirm={handleRemove}
          />
        )}

        {showMoveDialog && (
          <MoveColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            onClose={() => setShowMoveDialog(false)}
            onConfirm={handleMoveConfirm}
            targetBoards={availableTargetBoards.map((b) => ({
              id: b.id,
              name: b.name,
            }))}
          />
        )}

        {showConflictDialog && targetBoardId && (
          <ColumnConflictDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            onClose={() => {
              setShowConflictDialog(false);
              setConflictExistingColumn(null);
            }}
            onRenameAndMove={handleRenameAndMove}
            onReplaceExisting={handleReplaceExisting}
            targetBoardName={boards.byId[targetBoardId]?.name ?? "Target Board"}
          />
        )}
      </section>
    );
  }
);

KanbanColumn.displayName = "KanbanColumn";
