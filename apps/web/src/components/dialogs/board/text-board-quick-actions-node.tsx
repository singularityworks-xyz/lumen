"use client";

import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import { ClipboardList, Edit2, Link2, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BlockingDialogsManager } from "@/src/components/dialogs/blocking-dialogs-manager";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { useImperativeConnector } from "@/src/hooks/use-imperative-connector";
import { cn } from "@/src/lib/utils";

export interface TextBoardQuickActionsNodeData {
  boardId: string;
  [key: string]: unknown;
}

type TextBoardQuickActionsNodeProps = NodeProps<
  Node<TextBoardQuickActionsNodeData>
>;

const DIALOG_WIDTH = 220;
const DIALOG_CENTER_OFFSET = 150;

export const TextBoardQuickActionsNodeComponent =
  memo<TextBoardQuickActionsNodeProps>(({ id, data, selected }) => {
    const { getNode, setCenter, getViewport, setViewport } = useReactFlow();
    const [isFocused, setIsFocused] = useState(false);

    const boardId = data.boardId;
    const textBoard = useKanbanStore((state) => state.textBoards.byId[boardId]);
    const boards = useKanbanStore((state) => state.boards);
    const workspaces = useKanbanStore((state) => state.workspaces);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const boardDialogs = useKanbanStore((state) => state.boardDialogs);
    const connectionDialog = useKanbanStore((state) => state.connectionDialog);

    const closeBoardQuickActions = useKanbanStore(
      (state) => state.closeBoardQuickActions
    );
    const openBoardDialog = useKanbanStore((state) => state.openBoardDialog);
    const openConnectionDialog = useKanbanStore(
      (state) => state.openConnectionDialog
    );
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const closeConnectionDialog = useKanbanStore(
      (state) => state.closeConnectionDialog
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const dialogId = `text-board-quick-actions-${boardId}`;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(dialogId, "quick-actions", boardId);

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.QUICK_ACTIONS;
      }
      return Z_INDEX_BASE.QUICK_ACTIONS + (index + 1) * 10;
    }, [dialogFocusStack, dialogId]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

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

    const hasOtherBoards = useMemo(() => {
      const currentWorkspace = currentWorkspaceId
        ? workspaces.byId[currentWorkspaceId]
        : null;
      const workspaceBoardIds = [
        ...(currentWorkspace?.board_ids ?? boards.allIds),
        ...(currentWorkspace?.text_board_ids ?? []),
      ];
      return workspaceBoardIds.filter((bId) => bId !== boardId).length > 0;
    }, [currentWorkspaceId, workspaces, boards, boardId]);

    const blockingDialogs = useMemo(() => {
      const dialogs: {
        id: string;
        name: string;
        type: "board-dialog" | "connection";
      }[] = [];

      for (const [bDialogId, d] of Object.entries(boardDialogs)) {
        if (d.boardId !== boardId) {
          continue;
        }
        const name = d.type === "rename" ? "Rename Text Board" : "Dialog";
        dialogs.push({ id: bDialogId, name, type: "board-dialog" });
      }

      if (connectionDialog?.boardId === boardId) {
        dialogs.push({
          id: "connection",
          name: "Connection",
          type: "connection",
        });
      }

      return dialogs;
    }, [boardDialogs, connectionDialog, boardId]);

    const handleCloseBlocking = useCallback(() => {
      for (const d of blockingDialogs) {
        if (d.type === "board-dialog") {
          closeBoardDialog(d.id);
        } else if (d.type === "connection") {
          closeConnectionDialog();
        }
      }
    }, [blockingDialogs, closeBoardDialog, closeConnectionDialog]);

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

    const existingRenameDialog = useMemo(
      () =>
        Object.values(boardDialogs).find(
          (d) => d.boardId === boardId && d.type === "rename"
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

    const existingConnectionDialog =
      connectionDialog?.boardId === boardId ? connectionDialog : null;

    const handleRename = useCallback(() => {
      if (!textBoard) {
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
          boardName: textBoard.name,
          boardDescription: textBoard.description,
          inputValue: textBoard.name,
          descriptionValue: textBoard.description,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 320, 280), 50);
      }
    }, [
      textBoard,
      boardId,
      getNode,
      id,
      openBoardDialog,
      existingRenameDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleDelete = useCallback(() => {
      if (!textBoard) {
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
          boardName: textBoard.name,
          connectionCount,
          position: { x: dialogX, y: dialogY },
        });

        setTimeout(() => ensureDialogVisible(dialogX, dialogY, 380, 220), 50);
      }
    }, [
      textBoard,
      boardId,
      connectionCount,
      getNode,
      id,
      openBoardDialog,
      existingDeleteDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    const handleConnections = useCallback(() => {
      if (!textBoard) {
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
      textBoard,
      boardId,
      getNode,
      id,
      openConnectionDialog,
      existingConnectionDialog,
      setCenter,
      ensureDialogVisible,
    ]);

    useImperativeConnector({
      sourceSelector: `.react-flow__node[data-id="${boardId}"]`,
      targetNodeId: id,
      customColor: textBoard?.accentColor,
      zIndex: connectorZIndex,
      endOffsetY: 24,
    });

    if (!textBoard) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      // biome-ignore lint/a11y/noStaticElementInteractions: skip
      <div
        className={cn(
          "relative rounded-lg transition-all duration-200",
          selected || isFocused || isTopmost
            ? "scale-[1.02] shadow-xl"
            : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onPointerDown={() => {
          bringDialogToFront(dialogId);
          handleDialogPointerDown();
        }}
        style={{ width: DIALOG_WIDTH }}
      >
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        <div
          aria-labelledby={`quick-actions-${id}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card",
            selected || isFocused || isTopmost ? "ring-2 ring-primary/50" : ""
          )}
          role="dialog"
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              textBoard.accentColor
                ? {
                    background: `linear-gradient(to right, ${textBoard.accentColor}15, ${textBoard.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-primary text-xs",
                  !textBoard.accentColor && "bg-primary/10"
                )}
                style={
                  textBoard.accentColor
                    ? {
                        backgroundColor: `${textBoard.accentColor}25`,
                        color: textBoard.accentColor,
                      }
                    : {}
                }
              >
                <ClipboardList className="h-3 w-3" />
                <span className="max-w-24 truncate">{textBoard.name}</span>
              </span>
            </div>
            <BlockingDialogsManager
              dialogs={blockingDialogs}
              onCloseAll={handleCloseBlocking}
              onCloseMenu={handleClose}
            >
              <X className="h-3 w-3" />
            </BlockingDialogsManager>
          </div>

          <div className="flex gap-3 border-border/50 border-b bg-muted/30 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">
              Text board
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
                    data-testid="text-board-rename-option"
                    onClick={handleRename}
                    type="button"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Rename</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Change text board name</p>
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
                    data-testid="text-board-connections-option"
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

              <div className="my-0.5 h-px bg-border/50" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
                    onClick={handleDelete}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Text Board</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">
                    Permanently delete this text board and its content
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    );
  });

TextBoardQuickActionsNodeComponent.displayName = "TextBoardQuickActionsNode";
