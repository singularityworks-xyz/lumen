"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { EllipsisVertical, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "@/src/components/scaled-dropdown";
import { CreateTaskForm } from "@/src/components/tasks/create-task-form";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

type TaskModalNodeData = {
  modalId: string;
};

type TaskModalNodeProps = NodeProps<Node<TaskModalNodeData>>;

const MODAL_WIDTH = 400;

export const TaskModalNodeComponent = memo<TaskModalNodeProps>(
  ({ id, data, selected }) => {
    const { getNode, flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [mounted, setMounted] = useState(false);

    const modalBoardId = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.boardId
    );
    const sourceRect = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.sourceRect
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    const connectorState = useMemo(() => {
      // Access viewport values to ensure re-calculation on transform changes
      // flowToScreenPosition internally uses the current viewport state
      const _vp = { vpX, vpY, vpZoom };
      const myNode = getNode(id);

      if (myNode) {
        const myScreenPos = flowToScreenPosition({
          x: myNode.position.x,
          y: myNode.position.y,
        });

        if (sourceRect) {
          return {
            start: {
              x: sourceRect.right,
              y: sourceRect.top + sourceRect.height / 2,
            },
            end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
          };
        }
        const boardNode = modalBoardId ? getNode(modalBoardId) : null;
        if (boardNode) {
          const boardWidth = boardNode.measured?.width ?? 300;
          const boardScreenPos = flowToScreenPosition({
            x: boardNode.position.x + boardWidth,
            y: boardNode.position.y + 20,
          });

          return {
            start: boardScreenPos,
            end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
          };
        }
      }
      return null;
    }, [
      id,
      modalBoardId,
      getNode,
      flowToScreenPosition,
      sourceRect,
      vpX,
      vpY,
      vpZoom,
    ]);

    const modalFormData = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.formData
    );
    const modalColumnId = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.columnId
    );
    const closeCreateTaskModal = useKanbanStore(
      (state) => state.closeCreateTaskModal
    );
    const _sourcePosition = useKanbanStore(
      (state) => state.createTaskModals[data.modalId]?.sourcePosition
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
        {mounted &&
          connectorState &&
          createPortal(
            <ConnectorEdge
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}
        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
              {getInitials(boards.byId[selectedBoardId]?.name ?? "")}
            </span>
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
