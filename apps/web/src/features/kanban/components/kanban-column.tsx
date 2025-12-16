/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: ignore */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ColumnQuickActions } from "@/src/components/column-quick-actions";
import { TaskCard } from "@/src/components/tasks/task-card";
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

    // Global state selectors
    const globalQuickActions = useKanbanStore(
      (state) => state.columnQuickActions
    );
    const globalDialogState = useKanbanStore((state) => state.columnDialog);

    // Actions
    const openColumnQuickActions = useKanbanStore(
      (state) => state.openColumnQuickActions
    );
    const closeColumnQuickActions = useKanbanStore(
      (state) => state.closeColumnQuickActions
    );
    const updateColumnQuickActionsPosition = useKanbanStore(
      (state) => state.updateColumnQuickActionsPosition
    );
    const openColumnDialog = useKanbanStore((state) => state.openColumnDialog);
    const closeColumnDialog = useKanbanStore(
      (state) => state.closeColumnDialog
    );
    const updateColumnDialogPosition = useKanbanStore(
      (state) => state.updateColumnDialogPosition
    );

    // Derived state
    const isQuickActionsOpen = globalQuickActions?.columnId === column.id;
    const isDialogOpen = globalDialogState?.columnId === column.id;

    const quickActions = isQuickActionsOpen ? globalQuickActions : null;
    const dialogState = isDialogOpen ? globalDialogState : null;

    // Refs for source elements
    const columnHeaderRef = useRef<HTMLDivElement>(null);
    const columnBodyRef = useRef<HTMLElement>(null);

    // Button refs for dialog connections
    const actionButtonRefs = useRef<{
      rename: HTMLButtonElement | null;
      delete: HTMLButtonElement | null;
      move: HTMLButtonElement | null;
    }>({ rename: null, delete: null, move: null });

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

    // Get source rect for quick actions connector edge
    const getSourceRect = useCallback(() => {
      if (columnHeaderRef.current) {
        return columnHeaderRef.current.getBoundingClientRect();
      }
      return null;
    }, []);

    // Get source button rect for dialog connector edges
    const getSourceButtonRect = useCallback(() => {
      if (dialogState?.type) {
        const ref = actionButtonRefs.current[dialogState.type];
        if (ref) {
          return ref.getBoundingClientRect();
        }
      }
      return null;
    }, [dialogState?.type]);

    const handleHeaderContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = columnHeaderRef.current?.getBoundingClientRect();
        openColumnQuickActions(column.id, false, {
          x: rect ? rect.right + 20 : e.clientX + 20,
          y: rect ? rect.top : e.clientY,
        });
      },
      [column.id, openColumnQuickActions]
    );

    const handleBodyContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = columnHeaderRef.current?.getBoundingClientRect();
        openColumnQuickActions(column.id, true, {
          x: rect ? rect.right + 20 : e.clientX + 20,
          y: rect ? rect.top : e.clientY,
        });
      },
      [column.id, openColumnQuickActions]
    );

    const handleCloseQuickActions = useCallback(() => {
      closeColumnQuickActions();
    }, [closeColumnQuickActions]);

    const handleQuickActionsPositionChange = useCallback(
      (position: { x: number; y: number }) => {
        updateColumnQuickActionsPosition(position);
      },
      [updateColumnQuickActionsPosition]
    );

    const handleAddTask = useCallback(
      (_buttonRef: React.RefObject<HTMLButtonElement | null>) => {
        openCreateTaskModal(column.id, boardId);
        closeColumnQuickActions();
      },
      [column.id, boardId, openCreateTaskModal, closeColumnQuickActions]
    );

    const handleOpenRenameDialog = useCallback(
      (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
        if (buttonRef.current) {
          actionButtonRefs.current.rename = buttonRef.current;
          const rect = buttonRef.current.getBoundingClientRect();
          openColumnDialog({
            type: "rename",
            columnId: column.id,
            position: { x: rect.right + 40, y: rect.top - 30 },
          });
        }
      },
      [column.id, openColumnDialog]
    );

    const handleOpenDeleteDialog = useCallback(
      (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
        if (buttonRef.current) {
          actionButtonRefs.current.delete = buttonRef.current;
          const rect = buttonRef.current.getBoundingClientRect();
          openColumnDialog({
            type: "delete",
            columnId: column.id,
            position: { x: rect.right + 40, y: rect.top - 30 },
          });
        }
      },
      [column.id, openColumnDialog]
    );

    const handleOpenMoveDialog = useCallback(
      (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
        if (availableTargetBoards.length === 0) {
          return;
        }
        if (buttonRef.current) {
          actionButtonRefs.current.move = buttonRef.current;
          const rect = buttonRef.current.getBoundingClientRect();
          openColumnDialog({
            type: "move",
            columnId: column.id,
            position: { x: rect.right + 40, y: rect.top - 30 },
          });
        }
      },
      [availableTargetBoards.length, column.id, openColumnDialog]
    );

    const handleDialogPositionChange = useCallback(
      (position: { x: number; y: number }) => {
        updateColumnDialogPosition(position);
      },
      [updateColumnDialogPosition]
    );

    const handleCloseDialog = useCallback(() => {
      closeColumnDialog();
    }, [closeColumnDialog]);

    // Move column handlers
    const [targetBoardId, setTargetBoardId] = useState<string | null>(null);
    const [showConflictDialog, setShowConflictDialog] = useState(false);
    const [conflictExistingColumn, setConflictExistingColumn] = useState<{
      id: string;
      name: string;
    } | null>(null);

    const handleMoveConfirm = useCallback(
      (selectedTargetBoardId: string) => {
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
          closeColumnDialog();
          closeColumnQuickActions();
          return;
        }

        setConflictExistingColumn({
          id: existingColumn.id,
          name: existingColumn.name,
        });
        closeColumnDialog();
        setShowConflictDialog(true);
      },
      [
        boards.byId,
        columnsStore.byId,
        column.name,
        column.id,
        boardId,
        moveColumnToBoard,
        closeColumnDialog,
        closeColumnQuickActions,
      ]
    );

    const handleRenameAndMove = useCallback(
      (newName: string) => {
        if (!targetBoardId) {
          return;
        }

        updateColumn(column.id, { name: newName });
        moveColumnToBoard(boardId, column.id, targetBoardId);
        setShowConflictDialog(false);
        setConflictExistingColumn(null);
        closeColumnQuickActions();
      },
      [
        targetBoardId,
        column.id,
        boardId,
        updateColumn,
        moveColumnToBoard,
        closeColumnQuickActions,
      ]
    );

    const handleReplaceExisting = useCallback(() => {
      if (!(targetBoardId && conflictExistingColumn)) {
        return;
      }

      deleteColumn(targetBoardId, conflictExistingColumn.id);
      moveColumnToBoard(boardId, column.id, targetBoardId);
      setShowConflictDialog(false);
      setConflictExistingColumn(null);
      closeColumnQuickActions();
    }, [
      targetBoardId,
      conflictExistingColumn,
      boardId,
      column.id,
      deleteColumn,
      moveColumnToBoard,
      closeColumnQuickActions,
    ]);

    const handleRename = useCallback(
      (newName: string) => {
        updateColumn(column.id, { name: newName });
        closeColumnQuickActions();
      },
      [column.id, updateColumn, closeColumnQuickActions]
    );

    const handleRemove = useCallback(() => {
      deleteColumn(boardId, column.id);
      closeColumnQuickActions();
    }, [boardId, column.id, deleteColumn, closeColumnQuickActions]);

    // Direct action handlers for column header buttons
    const handleDirectRename = useCallback(() => {
      const rect = columnHeaderRef.current?.getBoundingClientRect();
      if (rect) {
        openColumnDialog({
          type: "rename",
          columnId: column.id,
          position: { x: rect.right + 40, y: rect.top - 30 },
        });
      }
    }, [column.id, openColumnDialog]);

    const handleDirectMoveToBoard = useCallback(() => {
      if (availableTargetBoards.length === 0) {
        return;
      }
      const rect = columnHeaderRef.current?.getBoundingClientRect();
      if (rect) {
        openColumnDialog({
          type: "move",
          columnId: column.id,
          position: { x: rect.right + 40, y: rect.top - 30 },
        });
      }
    }, [availableTargetBoards.length, column.id, openColumnDialog]);

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
          ref={columnHeaderRef}
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
              <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {taskCount}
              </span>
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

        {/* Column Quick Actions Dialog */}
        {quickActions && (
          <ColumnQuickActions
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnId={column.id}
            columnName={column.name}
            getSourceRect={getSourceRect}
            onAddTask={handleAddTask}
            onClose={handleCloseQuickActions}
            onMoveToBoard={
              availableTargetBoards.length > 0
                ? handleOpenMoveDialog
                : undefined
            }
            onPositionChange={handleQuickActionsPositionChange}
            onRemove={handleOpenDeleteDialog}
            onRename={handleOpenRenameDialog}
            position={quickActions.position}
            showAddTask={quickActions.showAddTask}
            showMoveToBoard={availableTargetBoards.length > 0}
          />
        )}

        {/* Rename Column Dialog */}
        {dialogState?.type === "rename" && (
          <RenameColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            currentName={column.name}
            getSourceButtonRect={getSourceButtonRect}
            onClose={handleCloseDialog}
            onPositionChange={handleDialogPositionChange}
            onRename={handleRename}
            position={dialogState.position}
            quickActionsPosition={quickActions?.position}
          />
        )}

        {/* Delete Column Dialog */}
        {dialogState?.type === "delete" && (
          <DeleteColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            getSourceButtonRect={getSourceButtonRect}
            onClose={handleCloseDialog}
            onConfirm={handleRemove}
            onPositionChange={handleDialogPositionChange}
            position={dialogState.position}
            quickActionsPosition={quickActions?.position}
          />
        )}

        {/* Move Column Dialog */}
        {dialogState?.type === "move" && (
          <MoveColumnDialog
            boardName={boards.byId[boardId]?.name ?? "Unknown Board"}
            columnName={column.name}
            getSourceButtonRect={getSourceButtonRect}
            onClose={handleCloseDialog}
            onConfirm={handleMoveConfirm}
            onPositionChange={handleDialogPositionChange}
            position={dialogState.position}
            quickActionsPosition={quickActions?.position}
            targetBoards={availableTargetBoards.map((b) => ({
              id: b.id,
              name: b.name,
            }))}
          />
        )}

        {/* Column Conflict Dialog */}
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
