"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  Copy,
  Edit2,
  GripHorizontal,
  LayoutGrid,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

type BoardQuickActionsNodeData = {
  boardId: string;
};

type BoardQuickActionsNodeProps = NodeProps<Node<BoardQuickActionsNodeData>>;

const DIALOG_WIDTH = 220;

export const BoardQuickActionsNodeComponent = memo<BoardQuickActionsNodeProps>(
  ({ id, data, selected }) => {
    const { getNode, flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const boardId = data.boardId;
    const board = useKanbanStore((state) => state.boards.byId[boardId]);
    const columns = useKanbanStore((state) => state.columns);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const createTaskModals = useKanbanStore((state) => state.createTaskModals);
    const boardDialogs = useKanbanStore((state) => state.boardDialogs);

    const closeBoardQuickActions = useKanbanStore(
      (state) => state.closeBoardQuickActions
    );
    const openBoardDialog = useKanbanStore((state) => state.openBoardDialog);
    const openCreateTaskModal = useKanbanStore(
      (state) => state.openCreateTaskModal
    );
    const openConnectionDialog = useKanbanStore(
      (state) => state.openConnectionDialog
    );

    const columnCount = board?.column_ids.length ?? 0;
    const taskCount = useMemo(() => {
      if (!board) {
        return 0;
      }
      return board.column_ids.reduce((acc, colId) => {
        const col = columns.byId[colId];
        return acc + (col?.task_ids.length ?? 0);
      }, 0);
    }, [board, columns]);

    const connectionCount = useMemo(
      () =>
        boardConnections.allIds.filter((connId) => {
          const conn = boardConnections.byId[connId];
          return (
            conn?.source_board_id === boardId ||
            conn?.target_board_id === boardId
          );
        }).length,
      [boardConnections, boardId]
    );

    const hasOpenDialogs = useMemo(() => {
      const hasBoardDialog = Object.values(boardDialogs).some(
        (d) => d.boardId === boardId
      );
      const hasTaskModal = Object.values(createTaskModals).some(
        (m) => m.boardId === boardId
      );
      return hasBoardDialog || hasTaskModal;
    }, [boardDialogs, createTaskModals, boardId]);

    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );
    const boardQuickActionsState = useKanbanStore(
      (state) => state.boardQuickActions
    );

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (
        !(boardPosition && boardQuickActionsState) ||
        boardQuickActionsState.boardId !== boardId
      ) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: boardQuickActionsState.position.x,
        y: boardQuickActionsState.position.y,
      });

      const boardWidth = boardPosition.width ?? 300;
      const boardScreenPos = flowToScreenPosition({
        x: boardPosition.x + boardWidth,
        y: boardPosition.y + 20,
      });

      return {
        start: boardScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      boardId,
      boardPosition,
      boardQuickActionsState,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleClose = useCallback(() => {
      closeBoardQuickActions();
    }, [closeBoardQuickActions]);

    const handleRename = useCallback(() => {
      if (!board) {
        return;
      }
      const myNode = getNode(id);
      if (myNode) {
        openBoardDialog({
          type: "rename",
          boardId,
          boardName: board.name,
          inputValue: board.name,
          position: {
            x: myNode.position.x + DIALOG_WIDTH + 40,
            y: myNode.position.y,
          },
        });
      }
    }, [board, boardId, getNode, id, openBoardDialog]);

    const handleAddTask = useCallback(() => {
      if (!board) {
        return;
      }
      const firstColumn = board.column_ids[0];
      if (!firstColumn) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const _myScreenPos = flowToScreenPosition({
          x: myNode.position.x + DIALOG_WIDTH + 40,
          y: myNode.position.y,
        });

        openCreateTaskModal({
          columnId: firstColumn,
          boardId,
          position: {
            x: myNode.position.x + DIALOG_WIDTH + 40,
            y: myNode.position.y,
          },
          sourceType: "board-menu",
        });
      }
    }, [
      board,
      boardId,
      getNode,
      id,
      flowToScreenPosition,
      openCreateTaskModal,
    ]);

    const handleDuplicate = useCallback(() => {
      if (!board) {
        return;
      }
      const myNode = getNode(id);
      if (myNode) {
        openBoardDialog({
          type: "duplicate",
          boardId,
          boardName: board.name,
          newName: `${board.name} (Copy)`,
          copyConnections: false,
          columnCount,
          taskCount,
          connectionCount,
          position: {
            x: myNode.position.x + DIALOG_WIDTH + 40,
            y: myNode.position.y,
          },
        });
      }
    }, [
      board,
      boardId,
      columnCount,
      taskCount,
      connectionCount,
      getNode,
      id,
      openBoardDialog,
    ]);

    const handleDelete = useCallback(() => {
      if (!board) {
        return;
      }
      const myNode = getNode(id);
      if (myNode) {
        openBoardDialog({
          type: "delete",
          boardId,
          boardName: board.name,
          columnCount,
          taskCount,
          connectionCount,
          position: {
            x: myNode.position.x + DIALOG_WIDTH + 40,
            y: myNode.position.y,
          },
        });
      }
    }, [
      board,
      boardId,
      columnCount,
      taskCount,
      connectionCount,
      getNode,
      id,
      openBoardDialog,
    ]);

    const handleConnections = useCallback(() => {
      if (!board) {
        return;
      }
      const myNode = getNode(id);
      if (myNode) {
        // Pass flow coordinates since connection dialog is now a React Flow node
        openConnectionDialog(boardId, {
          x: myNode.position.x + DIALOG_WIDTH + 40,
          y: myNode.position.y,
        });
      }
    }, [board, boardId, getNode, id, openConnectionDialog]);

    if (!board) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`quick-actions-${id}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        role="dialog"
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          createPortal(
            <ConnectorEdge
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}

        <div className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="h-3 w-3 text-muted-foreground" />
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
              <LayoutGrid className="h-3 w-3" />
              <span className="max-w-24 truncate">{board.name}</span>
            </span>
          </div>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                  onClick={handleClose}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              {hasOpenDialogs && (
                <TooltipContent side="top">
                  <p className="text-xs">Close associated dialogs first</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex gap-3 border-border/50 border-b bg-muted/30 px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {columnCount} columns
          </span>
          <span className="text-[10px] text-muted-foreground">
            {taskCount} tasks
          </span>
          {connectionCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {connectionCount} connections
            </span>
          )}
        </div>

        <div className="nodrag p-1">
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            onClick={handleRename}
            type="button"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Rename</span>
          </button>

          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            onClick={handleAddTask}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Task</span>
          </button>

          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            onClick={handleDuplicate}
            type="button"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Duplicate</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {taskCount}
            </span>
          </button>

          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            onClick={handleConnections}
            type="button"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Connections</span>
            {connectionCount > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {connectionCount}
              </span>
            )}
          </button>

          <div className="my-0.5 h-px bg-border/50" />

          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
            onClick={handleDelete}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Board</span>
          </button>
        </div>
      </div>
    );
  }
);

BoardQuickActionsNodeComponent.displayName = "BoardQuickActionsNode";
