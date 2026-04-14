"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { GripHorizontal, Link2, Share2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { getJwtToken } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

export interface ShareDialogNodeData {
  boardId: string;
  [key: string]: unknown;
}

type ShareDialogNodeProps = NodeProps<Node<ShareDialogNodeData>>;

const DIALOG_WIDTH = 380;

export const ShareDialogNodeComponent = memo<ShareDialogNodeProps>(
  ({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);

    const boardId = data.boardId;
    const shareDialog = useKanbanStore((state) => state.shareDialog);
    const boardQuickActions = useKanbanStore((state) =>
      boardId ? state.boardQuickActions[boardId] : null
    );
    const board = useKanbanStore((state) =>
      boardId ? state.boards.byId[boardId] : null
    );
    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspace = useKanbanStore((state) =>
      currentWorkspaceId ? state.workspaces.byId[currentWorkspaceId] : null
    );
    const closeShareDialog = useKanbanStore((state) => state.closeShareDialog);
    const setWorkspaceShareUrl = useKanbanStore(
      (state) => state.setWorkspaceShareUrl
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const dialogId = `share-dialog-${boardId}`;
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const apiUrl = (
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002"
    ).replace("localhost", "127.0.0.1");

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(dialogId, "share-dialog", boardId);

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.DIALOGS;
      }
      return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
    }, [dialogFocusStack, dialogId]);

    // Compute board icon using useMemo to avoid IIFE in JSX
    const boardIcon = useMemo(() => {
      const iconName = board?.icon;
      const MappedIcon = iconName ? ICON_MAP[iconName] : undefined;
      if (MappedIcon) {
        return <MappedIcon className="h-3 w-3" />;
      }
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/20 font-bold text-[9px]">
          {getInitials(board?.name ?? "")}
        </span>
      );
    }, [board?.icon, board?.name]);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!(boardQuickActions && shareDialog?.position)) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: shareDialog.position.x,
        y: shareDialog.position.y,
      });

      const boardWidth = 300;
      const boardX = boardPosition?.x ?? 0;
      const boardY = boardPosition?.y ?? 0;
      const boardScreenPos = flowToScreenPosition({
        x: boardX + boardWidth,
        y: boardY,
      });

      return {
        start: boardScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      boardQuickActions,
      shareDialog?.position,
      flowToScreenPosition,
      boardPosition?.x,
      boardPosition?.y,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleClose = useCallback(() => {
      closeShareDialog();
    }, [closeShareDialog]);

    const handleCreateShareLink = useCallback(async () => {
      if (!(currentWorkspaceId && workspace)) {
        return;
      }

      setIsLoading(true);
      try {
        const workspaceId = currentWorkspaceId;
        const token = await getJwtToken();

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
          `${apiUrl}/api/workspaces/${workspaceId}/share`,
          {
            headers,
            credentials: "include",
            method: "POST",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to create share link: ${response.status} ${response.statusText}`
          );
        }

        const responseData = await response.json();
        const generatedLink = responseData.url;

        setShareLink(generatedLink);
        setWorkspaceShareUrl(workspaceId, generatedLink);
      } catch (error) {
        console.error("DEBUG_SHARE_FETCH_ERROR", apiUrl, error);
      } finally {
        setIsLoading(false);
      }
    }, [currentWorkspaceId, workspace, apiUrl, setWorkspaceShareUrl]);

    const handleCopyLink = useCallback(async () => {
      if (!shareLink) {
        return;
      }
      // Clear any existing timeout to prevent calling setCopied after unmount
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy link:", error);
      }
    }, [shareLink]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
      };
    }, []);

    if (!(board && shareDialog)) {
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
        {connectorState &&
          portalTarget &&
          createPortal(
            <ConnectorEdge
              customColor={board.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
              zIndex={connectorZIndex}
            />,
            portalTarget
          )}

        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        <div
          aria-labelledby={`share-dialog-title-${boardId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card",
            selected || isFocused || isTopmost
              ? "ring-2 ring-primary/50"
              : "ring-1 ring-border/50"
          )}
          data-testid="share-dialog"
          role="dialog"
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              board.accentColor
                ? {
                    background: `linear-gradient(to right, ${board.accentColor}15, ${board.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                <Share2 className="h-3 w-3" />
              </span>
              <span className="font-semibold text-xs">Share Board</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 items-center gap-1 rounded px-1.5 text-[10px]",
                  !board.accentColor && "bg-primary/10 text-primary"
                )}
                style={
                  board.accentColor
                    ? {
                        backgroundColor: `${board.accentColor}25`,
                        color: board.accentColor,
                      }
                    : {}
                }
              >
                {boardIcon}
                <span className="max-w-20 truncate">{board.name}</span>
              </span>
              <button
                aria-label="Close share dialog"
                className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                onClick={handleClose}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="nodrag space-y-3 p-3">
            <p className="text-muted-foreground text-xs">
              Create a shareable link for this workspace. Anyone with the link
              can view and collaborate on this board.
            </p>

            {shareLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    data-testid="share-link-input"
                    readOnly
                    value={shareLink}
                  />
                  <Button onClick={handleCopyLink} size="sm" variant="outline">
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Anyone with this link can join as a collaborator.
                </p>
              </div>
            ) : (
              <Button
                className="w-full"
                data-testid="create-share-link-button"
                disabled={isLoading || !currentWorkspaceId}
                onClick={handleCreateShareLink}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {isLoading ? "Creating..." : "Create Share Link"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ShareDialogNodeComponent.displayName = "ShareDialogNode";
