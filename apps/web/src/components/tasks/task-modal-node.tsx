"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { GripHorizontal, X } from "lucide-react";
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
          "flex flex-col rounded-lg border-2 bg-card",
          selected
            ? "border-primary/30 shadow-xl ring-2 ring-primary/20"
            : "border-border/50 shadow-lg",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
        )}
        onMouseDown={handleMouseDown}
        style={{
          width: MODAL_WIDTH,
        }}
      >
        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">New Task</span>
              <ScaledSelect
                onValueChange={handleBoardChange}
                value={selectedBoardId}
              >
                <ScaledSelectTrigger
                  className="nodrag h-6 w-auto min-w-0 gap-1 border border-border/50 bg-transparent px-2 py-0.5 text-xs shadow-none hover:bg-accent/50"
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
            className="nodrag rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={() => closeCreateTaskModal(data.modalId)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="nodrag nowheel nopan">
          <CreateTaskForm
            modalId={data.modalId}
            modalState={updatedModalState}
            onColumnChange={setSelectedColumnId}
            selectedBoardColumns={selectedBoardColumns}
            selectedColumnId={selectedColumnId}
          />
        </div>
      </div>
    );
  }
);

TaskModalNodeComponent.displayName = "TaskModalNode";
