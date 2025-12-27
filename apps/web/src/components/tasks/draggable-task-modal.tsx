/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Draggable modal requires mouse interactions for drag */
"use client";

import { GripHorizontal, X } from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { CreateTaskModalState } from "@/src/features/kanban/types";
import { cn } from "@/src/lib/utils";
import {
  ModalScaleProvider,
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "../scaled-dropdown";
import { CreateTaskForm } from "./create-task-form";

type DraggableTaskModalProps = {
  modalState: CreateTaskModalState;
  screenPosition: { x: number; y: number };
  zoom: number;
};

const MODAL_WIDTH = 400;

export const DraggableTaskModal = memo(
  ({ modalState, screenPosition, zoom }: DraggableTaskModalProps) => {
    const { id, position, zIndex, boardId, columnId } = modalState;

    const closeCreateTaskModal = useKanbanStore(
      (state) => state.closeCreateTaskModal
    );
    const updateModalPosition = useKanbanStore(
      (state) => state.updateModalPosition
    );
    const bringModalToFront = useKanbanStore(
      (state) => state.bringModalToFront
    );
    const columns = useKanbanStore((state) => state.columns);
    const boards = useKanbanStore((state) => state.boards);

    const workspaceBoards = useMemo(() => {
      const currentBoard = boards.byId[boardId];
      if (!currentBoard) {
        return [];
      }

      const workspaceId = currentBoard.workspace_id;
      return boards.allIds
        .map((bid) => boards.byId[bid])
        .filter(
          (board): board is NonNullable<typeof board> =>
            board !== undefined && board.workspace_id === workspaceId
        );
    }, [boards, boardId]);

    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [selectedBoardId, setSelectedBoardId] = useState(boardId);
    const [selectedColumnId, setSelectedColumnId] = useState(columnId);

    const selectedBoardColumns = useMemo(() => {
      const board = boards.byId[selectedBoardId];
      if (!board) {
        return [];
      }
      return board.column_ids
        .map((colId) => columns.byId[colId])
        .filter((col): col is NonNullable<typeof col> => col !== undefined);
    }, [boards, columns, selectedBoardId]);

    const handleBoardChange = useCallback(
      (newBoardId: string) => {
        setSelectedBoardId(newBoardId);
        const newBoard = boards.byId[newBoardId];
        if (newBoard && newBoard.column_ids.length > 0) {
          const firstColumnId = newBoard.column_ids[0];
          if (firstColumnId) {
            setSelectedColumnId(firstColumnId);
          }
        }
      },
      [boards]
    );

    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        if ((e.target as HTMLElement).closest("[data-slot='select-trigger']")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionStartRef.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        bringModalToFront(id);
      },
      [position, id, bringModalToFront]
    );

    const handleDragMove = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (!isDragging) {
          return;
        }
        const dx = (e.clientX - dragStartRef.current.x) / zoom;
        const dy = (e.clientY - dragStartRef.current.y) / zoom;
        const newPos = {
          x: positionStartRef.current.x + dx,
          y: positionStartRef.current.y + dy,
        };
        updateModalPosition(id, newPos);
      },
      [isDragging, id, updateModalPosition, zoom]
    );

    const handleDragEnd = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
          setIsDragging(false);
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
      },
      [isDragging]
    );

    const handleMouseDown = useCallback(() => {
      bringModalToFront(id);
      setIsFocused(true);
    }, [id, bringModalToFront]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          setIsFocused(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const updatedModalState = useMemo(
      () => ({
        ...modalState,
        boardId: selectedBoardId,
        columnId: selectedColumnId,
      }),
      [modalState, selectedBoardId, selectedColumnId]
    );

    return (
      <div
        aria-modal="true"
        className={cn(
          "fixed flex max-h-[85vh] flex-col overflow-hidden rounded-lg border-2 bg-card",
          isFocused
            ? "border-primary/30 shadow-xl ring-2 ring-primary/20"
            : "border-border/50 shadow-lg",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
        )}
        onMouseDown={handleMouseDown}
        ref={modalRef}
        role="dialog"
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
          width: MODAL_WIDTH,
          zIndex: 100 + zIndex,
          transform: "none",
          transformOrigin: "top left",
        }}
        tabIndex={-1}
      >
        <ModalScaleProvider zIndex={zIndex}>
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/30 px-4 py-3"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">New Task</span>
                {/* Board Selector */}
                <ScaledSelect
                  onValueChange={handleBoardChange}
                  value={selectedBoardId}
                >
                  <ScaledSelectTrigger
                    className="h-6 w-auto min-w-0 gap-1 border border-border/50 bg-transparent px-2 py-0.5 text-xs shadow-none hover:bg-accent/50"
                    size="sm"
                  >
                    <ScaledSelectValue />
                  </ScaledSelectTrigger>
                  <ScaledSelectContent position="popper" sideOffset={4}>
                    {workspaceBoards.map((board) => (
                      <ScaledSelectItem key={board.id} value={board.id}>
                        {board.name}
                      </ScaledSelectItem>
                    ))}
                  </ScaledSelectContent>
                </ScaledSelect>
              </div>
            </div>
            <button
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => closeCreateTaskModal(id)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <CreateTaskForm
            modalId={id}
            modalState={updatedModalState}
            onColumnChange={setSelectedColumnId}
            selectedBoardColumns={selectedBoardColumns}
            selectedColumnId={selectedColumnId}
          />
        </ModalScaleProvider>
      </div>
    );
  }
);

DraggableTaskModal.displayName = "DraggableTaskModal";
