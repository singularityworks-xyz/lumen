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
  Settings,
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
const DIALOG_CENTER_OFFSET = 150;

export const BoardQuickActionsNodeComponent = memo<BoardQuickActionsNodeProps>(
  ({ id, data, selected }) => {
    const {
      getNode,
      flowToScreenPosition,
      setCenter,
      getViewport,
      setViewport,
    } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const boardId = data.boardId;
    const board = useKanbanStore((state) => state.boards.byId[boardId]);
    const boards = useKanbanStore((state) => state.boards);
    const workspaces = useKanbanStore((state) => state.workspaces);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const columns = useKanbanStore((state) => state.columns);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const createTaskModals = useKanbanStore((state) => state.createTaskModals);
    const boardDialogs = useKanbanStore((state) => state.boardDialogs);
    const connectionDialog = useKanbanStore((state) => state.connectionDialog);

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
      const hasConnectionDialog = connectionDialog?.boardId === boardId;
      return hasBoardDialog || hasTaskModal || hasConnectionDialog;
    }, [boardDialogs, createTaskModals, connectionDialog, boardId]);

    const hasOtherBoards = useMemo(() => {
      const currentWorkspace = currentWorkspaceId
        ? workspaces.byId[currentWorkspaceId]
        : null;
      const workspaceBoardIds = currentWorkspace?.board_ids ?? boards.allIds;
      return workspaceBoardIds.filter((bId) => bId !== boardId).length > 0;
    }, [currentWorkspaceId, workspaces, boards, boardId]);

    const existingRenameDialog = useMemo(
      () =>
        Object.values(boardDialogs).find(
          (d) => d.boardId === boardId && d.type === "rename"
        ),
      [boardDialogs, boardId]
    );

    const existingDuplicateDialog = useMemo(
      () =>
        Object.values(boardDialogs).find(
          (d) => d.boardId === boardId && d.type === "duplicate"
        ),
      [boardDialogs, boardId]
    );

    const existingDeleteDialog = useMemo(
      () =>
        Object.values(boardDialogs).find(
          (d) => d.boardId === boardId && d.type === "delete"
        ),
      [boardDialogs, boardId]
    );

    const existingTaskModal = useMemo(
      () => Object.values(createTaskModals).find((m) => m.boardId === boardId),
      [createTaskModals, boardId]
    );

    const existingConnectionDialog =
      connectionDialog?.boardId === boardId ? connectionDialog : null;

    const existingPropertiesDialog = useMemo(
      () =>
        Object.values(boardDialogs).find(
          (d) => d.boardId === boardId && d.type === "properties"
        ),
      [boardDialogs, boardId]
    );

    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );
    const boardQuickActionsState = useKanbanStore(
      (state) => state.boardQuickActions[boardId]
    );

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!(boardPosition && boardQuickActionsState)) {
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
      boardPosition,
      boardQuickActionsState,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleClose = useCallback(() => {
      closeBoardQuickActions(boardId);
    }, [closeBoardQuickActions, boardId]);

    const VIEWPORT_PADDING = 100;
    const ensureDialogVisible = useCallback(
      (
        dialogX: number,
        dialogY: number,
        dialogWidth: number,
        dialogHeight: number
      ) => {
        const viewport = getViewport();
        const { x: vX, y: vY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const dialogScreenX = dialogX * zoom + vX;
        const dialogScreenY = dialogY * zoom + vY;
        const dialogScreenRight = (dialogX + dialogWidth) * zoom + vX;
        const dialogScreenBottom = (dialogY + dialogHeight) * zoom + vY;

        let newVpX = vX;
        let newVpY = vY;
        let needsPan = false;

        if (dialogScreenX < VIEWPORT_PADDING) {
          newVpX = vX + (VIEWPORT_PADDING - dialogScreenX);
          needsPan = true;
        } else if (dialogScreenRight > screenWidth - VIEWPORT_PADDING) {
          newVpX = vX - (dialogScreenRight - (screenWidth - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (dialogScreenY < VIEWPORT_PADDING) {
          newVpY = vY + (VIEWPORT_PADDING - dialogScreenY);
          needsPan = true;
        } else if (dialogScreenBottom > screenHeight - VIEWPORT_PADDING) {
          newVpY =
            vY - (dialogScreenBottom - (screenHeight - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (needsPan) {
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 400 });
        }
      },
      [getViewport, setViewport]
    );

    const handleRename = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingRenameDialog) {
        setCenter(
          existingRenameDialog.position.x + DIALOG_CENTER_OFFSET,
          existingRenameDialog.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openBoardDialog({
          type: "rename",
          boardId,
          boardName: board.name,
          boardDescription: board.description,
          inputValue: board.name,
          descriptionValue: board.description,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 320, 280), 50);
      }
    }, [
      board,
      boardId,
      getNode,
      id,
      openBoardDialog,
      existingRenameDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleAddTask = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingTaskModal) {
        setCenter(
          existingTaskModal.position.x + DIALOG_CENTER_OFFSET,
          existingTaskModal.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const firstColumn = board.column_ids[0];
      if (!firstColumn) {
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openCreateTaskModal({
          columnId: firstColumn,
          boardId,
          position: { x: dialogX, y: dialogY },
          sourceType: "board-menu",
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 400, 300), 50);
      }
    }, [
      board,
      boardId,
      getNode,
      id,
      openCreateTaskModal,
      existingTaskModal,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleDuplicate = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingDuplicateDialog) {
        setCenter(
          existingDuplicateDialog.position.x + DIALOG_CENTER_OFFSET,
          existingDuplicateDialog.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openBoardDialog({
          type: "duplicate",
          boardId,
          boardName: board.name,
          newName: `${board.name} (Copy)`,
          copyConnections: false,
          columnCount,
          taskCount,
          connectionCount,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 380, 280), 50);
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
      existingDuplicateDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleDelete = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingDeleteDialog) {
        setCenter(
          existingDeleteDialog.position.x + DIALOG_CENTER_OFFSET,
          existingDeleteDialog.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openBoardDialog({
          type: "delete",
          boardId,
          boardName: board.name,
          columnCount,
          taskCount,
          connectionCount,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 380, 220), 50);
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
      existingDeleteDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleConnections = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingConnectionDialog) {
        setCenter(
          existingConnectionDialog.position.x + DIALOG_CENTER_OFFSET,
          existingConnectionDialog.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;

        openConnectionDialog(boardId, { x: dialogX, y: dialogY });
        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 400, 350), 50);
      }
    }, [
      board,
      boardId,
      getNode,
      id,
      openConnectionDialog,
      existingConnectionDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleProperties = useCallback(() => {
      if (!board) {
        return;
      }

      if (existingPropertiesDialog) {
        setCenter(
          existingPropertiesDialog.position.x + DIALOG_CENTER_OFFSET,
          existingPropertiesDialog.position.y + DIALOG_CENTER_OFFSET,
          { duration: 500, zoom: 1 }
        );
        return;
      }

      const myNode = getNode(id);
      if (myNode) {
        const dialogX = myNode.position.x + DIALOG_WIDTH + 40;
        const dialogY = myNode.position.y;
        const columnProgressValues: Record<string, number> = {};
        for (const colId of board.column_ids) {
          const col = columns.byId[colId];
          if (col) {
            columnProgressValues[colId] = col.progressValue ?? 0;
          }
        }

        openBoardDialog({
          type: "properties",
          boardId,
          boardName: board.name,
          position: { x: dialogX, y: dialogY },
          columnProgressValues,
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 380, 400), 50);
      }
    }, [
      board,
      boardId,
      columns.byId,
      getNode,
      id,
      openBoardDialog,
      existingPropertiesDialog,
      setCenter,
      ensureDialogVisible,
    ]);

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
                  className={cn(
                    "nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]",
                    hasOpenDialogs
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-destructive/20 hover:text-destructive"
                  )}
                  disabled={hasOpenDialogs}
                  onClick={hasOpenDialogs ? undefined : handleClose}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  {hasOpenDialogs
                    ? "Close associated dialogs first"
                    : "Close menu"}
                </p>
              </TooltipContent>
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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={handleRename}
                  type="button"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Rename</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">Change board name</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={handleAddTask}
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">Create a new task in this board</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">
                  Create a copy of this board with all tasks
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
                    hasOtherBoards
                      ? "hover:bg-accent hover:text-accent-foreground"
                      : "cursor-not-allowed opacity-50"
                  )}
                  disabled={!hasOtherBoards}
                  onClick={hasOtherBoards ? handleConnections : undefined}
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
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">
                  {hasOtherBoards
                    ? "Manage links to other boards"
                    : "No boards available"}
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={handleProperties}
                  type="button"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Properties</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">
                  Configure board settings and column progress
                </p>
              </TooltipContent>
            </Tooltip>

            <div className="my-0.5 h-px bg-border/50" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
                  onClick={handleDelete}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Board</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">
                  Permanently delete this board and all tasks
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);

BoardQuickActionsNodeComponent.displayName = "BoardQuickActionsNode";
