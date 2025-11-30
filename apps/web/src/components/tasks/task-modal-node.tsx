"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { EllipsisVertical, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "@/src/components/scaled-dropdown";
import { CreateTaskForm } from "@/src/components/tasks/create-task-form";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type TaskModalNodeData = {
  modalId: string;
};

type TaskModalNodeProps = NodeProps<Node<TaskModalNodeData>>;

const MODAL_WIDTH = 400;

export const TaskModalNodeComponent = memo<TaskModalNodeProps>(
  ({ data, selected }) => {
    const modalFormData = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.formData
    );
    const modalBoardId = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.boardId
    );
    const modalColumnId = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.columnId
    );
    const closeCreateTaskModal = useKanbanStore(
      (state) => state.closeCreateTaskModal
    );
    const bringModalToFront = useKanbanStore(
      (state) => state.bringModalToFront
    );
    const columns = useKanbanStore((state) => state.columns);
    const boards = useKanbanStore((state) => state.boards);

    const [isFocused, setIsFocused] = useState(false);

    const workspaceBoards = useMemo(() => {
      if (!modalBoardId) {
        return [];
      }
      const currentBoard = boards.byId[modalBoardId];
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
    }, [boards, modalBoardId]);

    const [selectedBoardId, setSelectedBoardId] = useState(modalBoardId ?? "");
    const [selectedColumnId, setSelectedColumnId] = useState(
      modalColumnId ?? ""
    );

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

    const handleMouseDown = useCallback(() => {
      bringModalToFront(data.modalId);
    }, [data.modalId, bringModalToFront]);

    const updatedModalState = useMemo(() => {
      if (!modalFormData) {
        return null;
      }
      if (!modalBoardId) {
        return null;
      }
      if (!modalColumnId) {
        return null;
      }
      return {
        id: data.modalId,
        boardId: selectedBoardId,
        columnId: selectedColumnId,
        formData: modalFormData,
        position: { x: 0, y: 0 },
        zIndex: 0,
      };
    }, [
      data.modalId,
      modalFormData,
      modalBoardId,
      modalColumnId,
      selectedBoardId,
      selectedColumnId,
    ]);

    if (!updatedModalState) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Node wrapper needs mouse handler
      // biome-ignore lint/a11y/noStaticElementInteractions: Node wrapper needs mouse handler
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-lg ring-1 ring-border/50",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onMouseDown={handleMouseDown}
        style={{
          width: MODAL_WIDTH,
        }}
      >
        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-zinc-50/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-zinc-900/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-xs">New Task</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ScaledSelect
              onValueChange={handleBoardChange}
              value={selectedBoardId}
            >
              <ScaledSelectTrigger
                className="nodrag h-6 w-auto min-w-0 gap-1 rounded-md border-none bg-card/80 px-2 py-0.5 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
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
            {/* <span className="text-muted-foreground text-xs">/</span> */}
            <EllipsisVertical className="size-4 text-muted-foreground" />
            <ScaledSelect
              onValueChange={setSelectedColumnId}
              value={selectedColumnId}
            >
              <ScaledSelectTrigger
                className="nodrag h-6 w-auto min-w-0 gap-1 rounded-md border-none bg-card/80 px-2 py-0.5 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                size="sm"
              >
                <ScaledSelectValue placeholder="Column" />
              </ScaledSelectTrigger>
              <ScaledSelectContent position="popper" sideOffset={4}>
                {selectedBoardColumns.map((col) => (
                  <ScaledSelectItem key={col.id} value={col.id}>
                    {col.name}
                  </ScaledSelectItem>
                ))}
              </ScaledSelectContent>
            </ScaledSelect>
            <button
              className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={() => closeCreateTaskModal(data.modalId)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="nodrag nowheel nopan">
          <CreateTaskForm
            modalId={data.modalId}
            modalState={updatedModalState}
            selectedColumnId={selectedColumnId}
          />
        </div>
      </div>
    );
  }
);

TaskModalNodeComponent.displayName = "TaskModalNode";
