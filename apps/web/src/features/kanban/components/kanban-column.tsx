/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useCallback, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "../store/kanban-store";
import type { DenormalizedColumn, Task } from "../types";
import { ColumnContextMenu } from "./column-context-menu";
import { DeleteColumnDialog } from "./delete-column-dialog";
import { RenameColumnDialog } from "./rename-column-dialog";
import { TaskCard } from "./task-card";

type KanbanColumnProps = {
  column: DenormalizedColumn;
  boardId: string;
};

export const KanbanColumn = memo(({ column, boardId }: KanbanColumnProps) => {
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
  const setCreateTaskColumnId = useKanbanStore(
    (state) => state.setCreateTaskColumnId
  );
  const moveColumnToBoard = useKanbanStore((state) => state.moveColumnToBoard);
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
  } = useSortable({ id: column.id });

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
    setCreateTaskColumnId(column.id);
  }, [column.id, setCreateTaskColumnId]);

  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictExistingColumn, setConflictExistingColumn] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState(column.name);

  const handleOpenMoveDialog = useCallback(() => {
    if (availableTargetBoards.length === 0) {
      return;
    }
    setTargetBoardId(availableTargetBoards[0]?.id ?? null);
    setShowMoveDialog(true);
  }, [availableTargetBoards]);

  const handleConfirmMove = () => {
    if (!targetBoardId) {
      return;
    }
    const targetBoard = boards.byId[targetBoardId];
    if (!targetBoard) {
      return;
    }

    // Check if there's an existing column with the same name in target board
    const existingColumn = targetBoard.column_ids
      .map((colId) => columnsStore.byId[colId])
      .find((col) => col?.name === column.name);

    if (!existingColumn) {
      moveColumnToBoard(boardId, column.id, targetBoardId);
      setShowMoveDialog(false);
      return;
    }

    setConflictExistingColumn({
      id: existingColumn.id,
      name: existingColumn.name,
    });
    setRenameValue(column.name);
    setShowMoveDialog(false);
    setShowConflictDialog(true);
  };

  const handleRenameAndMove = () => {
    if (!targetBoardId) {
      return;
    }

    const newName = renameValue.trim() || column.name;
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
      className="flex max-h-full min-w-[285px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/60"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={setNodeRef}
      style={style}
    >
      {/** biome-ignore lint/a11y/noStaticElementInteractions: required */}
      <div
        className="cursor-grab bg-zinc-100/90 px-2.5 py-2 active:cursor-grabbing dark:bg-zinc-800/90"
        onContextMenu={handleHeaderContextMenu}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-card-foreground text-xs">
            {column.name}
          </h3>
          <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {taskCount}
          </span>
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
              isSelected={selectedTaskIds.includes(task.id)}
              key={task.id}
              onDragStart={handleDragStart}
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
          currentName={column.name}
          onClose={() => setShowRenameDialog(false)}
          onRename={handleRename}
        />
      )}

      {showDeleteDialog && (
        <DeleteColumnDialog
          columnName={column.name}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleRemove}
        />
      )}

      {showMoveDialog && (
        <AlertDialog onOpenChange={setShowMoveDialog} open={showMoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move Column</AlertDialogTitle>
              <AlertDialogDescription>
                Move "{column.name}" to another board in this workspace.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <label
                className="font-medium text-card-foreground text-sm"
                htmlFor="target-board"
              >
                Target Board
              </label>
              <select
                className="w-full rounded-md border border-border bg-secondary/30 p-2 text-sm"
                id="target-board"
                onChange={(e) => setTargetBoardId(e.target.value)}
                value={targetBoardId ?? ""}
              >
                {availableTargetBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmMove}>
                Move
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showConflictDialog && (
        <AlertDialog
          onOpenChange={setShowConflictDialog}
          open={showConflictDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Column name conflict</AlertDialogTitle>
              <AlertDialogDescription>
                A column named "{column.name}" already exists on the target
                board. You can rename this column or replace the existing one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label
                  className="font-medium text-card-foreground text-sm"
                  htmlFor="column-new-name"
                >
                  New name
                </label>
                <Input
                  id="column-new-name"
                  onChange={(e) => setRenameValue(e.target.value)}
                  value={renameValue}
                />
              </div>
            </div>
            <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
              <AlertDialogCancel
                className="sm:order-1"
                onClick={() => setShowConflictDialog(false)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="sm:order-2"
                onClick={handleRenameAndMove}
              >
                Rename &amp; Move
              </AlertDialogAction>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:order-3"
                onClick={handleReplaceExisting}
              >
                Replace Existing
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
});

KanbanColumn.displayName = "KanbanColumn";
