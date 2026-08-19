"use client";

import type { Node, NodeProps } from "@xyflow/react";
import {
  Check,
  Copy,
  Eye,
  Globe,
  GripHorizontal,
  Link2,
  Share2,
  Users,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { useImperativeConnector } from "@/src/hooks/use-imperative-connector";
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

const DIALOG_WIDTH = 420;

export const ShareDialogNodeComponent = memo<ShareDialogNodeProps>(
  ({ data, selected }) => {
    const [isFocused, setIsFocused] = useState(false);

    const boardId = data.boardId;
    const shareDialog = useKanbanStore((state) => state.shareDialog);
    const board = useKanbanStore((state) =>
      boardId ? state.boards.byId[boardId] : null
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

    const [isLoading, setIsLoading] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [guestLink, setGuestLink] = useState<string | null>(null);
    const [isGuestEnabled, setIsGuestEnabled] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const [copiedCollab, setCopiedCollab] = useState(false);
    const [copiedGuest, setCopiedGuest] = useState(false);

    const copyCollabTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const copyGuestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    useEffect(() => {
      registerDialog(dialogId);
      return () => unregisterDialog(dialogId);
    }, [dialogId, registerDialog, unregisterDialog]);

    // Fetch existing shares on mount
    useEffect(() => {
      let isMounted = true;
      if (!currentWorkspaceId) {
        return;
      }

      async function fetchShareInfo() {
        try {
          const token = await getJwtToken();
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          const res = await fetch(
            `/api/workspaces/${currentWorkspaceId}/share`,
            {
              headers,
              credentials: "include",
            }
          );
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.collaboratorLink?.url || data.url) {
              const url = data.collaboratorLink?.url || data.url;
              setShareLink(url);
              if (currentWorkspaceId) {
                setWorkspaceShareUrl(currentWorkspaceId, url);
              }
            }
            if (data.guestLink?.enabled) {
              setIsGuestEnabled(true);
              setGuestLink(data.guestLink.url);
            } else {
              setIsGuestEnabled(false);
              setGuestLink(null);
            }
          }
        } catch {
          // ignore fetch error on mount
        }
      }

      fetchShareInfo();
      return () => {
        isMounted = false;
      };
    }, [currentWorkspaceId, setWorkspaceShareUrl]);

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

    useImperativeConnector({
      customColor: board?.accentColor,
      sourceSelector: `.react-flow__node[data-id="${boardId}"]`,
      targetNodeId: `share-dialog-${boardId}`,
      zIndex: connectorZIndex,
    });

    const handleClose = useCallback(() => {
      closeShareDialog();
    }, [closeShareDialog]);

    const handleCreateShareLink = useCallback(async () => {
      if (!(currentWorkspaceId && workspace)) {
        return;
      }

      setIsLoading(true);
      setShareError(null);
      try {
        const workspaceId = currentWorkspaceId;
        const token = await getJwtToken();

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`/api/workspaces/${workspaceId}/share`, {
          headers,
          credentials: "include",
          method: "POST",
        });

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
        console.error("Failed to create share link", error);
        setShareError("Unable to create a share link right now.");
      } finally {
        setIsLoading(false);
      }
    }, [currentWorkspaceId, workspace, setWorkspaceShareUrl]);

    const handleToggleGuestShare = useCallback(async () => {
      if (!currentWorkspaceId) {
        return;
      }

      setIsGuestLoading(true);
      setShareError(null);
      try {
        const token = await getJwtToken();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        if (isGuestEnabled) {
          // Revoke guest link
          const res = await fetch(
            `/api/workspaces/${currentWorkspaceId}/share/guest`,
            {
              method: "DELETE",
              headers,
              credentials: "include",
            }
          );
          if (!res.ok) {
            throw new Error("Failed to disable public guest link");
          }
          setIsGuestEnabled(false);
          setGuestLink(null);
        } else {
          // Enable guest link
          const res = await fetch(
            `/api/workspaces/${currentWorkspaceId}/share/guest`,
            {
              method: "POST",
              headers,
              credentials: "include",
            }
          );
          if (!res.ok) {
            throw new Error("Failed to enable public guest link");
          }
          const data = await res.json();
          setIsGuestEnabled(true);
          setGuestLink(data.url);
        }
      } catch (error) {
        console.error("Failed to toggle guest share link", error);
        setShareError("Unable to update public guest link.");
      } finally {
        setIsGuestLoading(false);
      }
    }, [currentWorkspaceId, isGuestEnabled]);

    const handleCopyCollabLink = useCallback(async () => {
      if (!shareLink) {
        return;
      }
      if (copyCollabTimeoutRef.current) {
        clearTimeout(copyCollabTimeoutRef.current);
      }
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopiedCollab(true);
        copyCollabTimeoutRef.current = setTimeout(
          () => setCopiedCollab(false),
          2000
        );
      } catch (error) {
        console.error("Failed to copy link:", error);
      }
    }, [shareLink]);

    const handleCopyGuestLink = useCallback(async () => {
      if (!guestLink) {
        return;
      }
      if (copyGuestTimeoutRef.current) {
        clearTimeout(copyGuestTimeoutRef.current);
      }
      try {
        await navigator.clipboard.writeText(guestLink);
        setCopiedGuest(true);
        copyGuestTimeoutRef.current = setTimeout(
          () => setCopiedGuest(false),
          2000
        );
      } catch (error) {
        console.error("Failed to copy link:", error);
      }
    }, [guestLink]);

    useEffect(
      () => () => {
        if (copyCollabTimeoutRef.current) {
          clearTimeout(copyCollabTimeoutRef.current);
        }
        if (copyGuestTimeoutRef.current) {
          clearTimeout(copyGuestTimeoutRef.current);
        }
      },
      []
    );

    if (!(board && shareDialog)) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Dialog root element container
      // biome-ignore lint/a11y/noStaticElementInteractions: Dialog root element container
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
              <span className="font-semibold text-xs">Share Workspace</span>
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

          <div className="nodrag space-y-4 p-3.5">
            {/* Section 1: Collaborator Link */}
            <div className="space-y-2 rounded-md border border-border/50 bg-secondary/20 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground text-xs">
                    Collaborator Link
                  </span>
                </div>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-[9px] text-primary">
                  Editor Access
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Allows logged-in users to join and edit this workspace in
                real-time.
              </p>

              {shareLink ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="h-8 flex-1 font-mono text-[11px]"
                      data-testid="share-link-input"
                      readOnly
                      value={shareLink}
                    />
                    <Button
                      className="h-8 px-2.5 text-xs"
                      data-testid="copy-share-link-button"
                      onClick={handleCopyCollabLink}
                      size="sm"
                      variant="outline"
                    >
                      {copiedCollab ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="h-8 w-full text-xs"
                  data-testid="create-share-link-button"
                  disabled={isLoading || !currentWorkspaceId}
                  onClick={handleCreateShareLink}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  {isLoading ? "Creating..." : "Create Collaborator Link"}
                </Button>
              )}
            </div>

            {/* Section 2: Public Guest Link (Read-only) */}
            <div className="space-y-2.5 rounded-md border border-border/50 bg-secondary/20 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-semibold text-foreground text-xs">
                    Public Guest Link
                  </span>
                </div>
                <button
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-[10px] transition-colors",
                    isGuestEnabled
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  )}
                  data-testid="toggle-guest-share-button"
                  disabled={isGuestLoading || !currentWorkspaceId}
                  onClick={handleToggleGuestShare}
                  type="button"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isGuestEnabled
                        ? "animate-pulse bg-emerald-500"
                        : "bg-muted-foreground/50"
                    )}
                  />
                  {isGuestLoading
                    ? "Updating..."
                    : isGuestEnabled
                      ? "Enabled"
                      : "Disabled"}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Public read-only link. Anyone can view real-time changes without
                signing in. Editing and extra popups are disabled.
              </p>

              {isGuestEnabled && guestLink && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="h-8 flex-1 font-mono text-[11px]"
                      data-testid="guest-share-link-input"
                      readOnly
                      value={guestLink}
                    />
                    <Button
                      className="h-8 px-2.5 text-xs"
                      data-testid="copy-guest-link-button"
                      onClick={handleCopyGuestLink}
                      size="sm"
                      variant="outline"
                    >
                      {copiedGuest ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <Eye className="h-3 w-3" />
                    <span>Real-time read-only access active</span>
                  </div>
                </div>
              )}
            </div>

            {shareError && (
              <p className="text-center text-[10px] text-destructive">
                {shareError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ShareDialogNodeComponent.displayName = "ShareDialogNode";
