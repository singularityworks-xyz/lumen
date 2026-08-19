"use client";

import { type ReactNode, useEffect } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { PresenceProvider } from "@/src/features/presence/presence-provider";
import { CollaborationProvider, useCollaboration } from "./collab-provider";
import { useTaskDialogSync } from "./hooks/use-task-dialog-sync";
import { useYjsSync } from "./hooks/use-yjs-sync";

// Connects to WebSocket and enables sync when workspace is available and shared
function YjsSyncEnabler({ children }: { children: ReactNode }) {
  const { doc, connectionState, connect, disconnect, localUser } =
    useCollaboration();
  const currentWorkspaceId = useKanbanStore((s) => s.currentWorkspaceId);
  const currentWorkspace = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaces.byId[s.currentWorkspaceId] : null
  );
  const shareUrl = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaceShareUrls[s.currentWorkspaceId] : null
  );
  const isGuestMode = useKanbanStore((s) => s.isGuestMode);
  const isConnected = connectionState === "connected";

  // Only auto-connect when workspace is shared or in guest mode:
  // - isGuestMode: true means connected as read-only public guest
  // - isShared: true means the workspace was joined via share link (editor)
  // - shareUrl set in state means owner has shared this workspace
  // - shareToken on workspace means owner has shared (persisted token)
  const isSharedWorkspace =
    isGuestMode ||
    currentWorkspace?.isShared === true ||
    !!shareUrl ||
    !!currentWorkspace?.shareToken;

  // Auto-connect when shared workspace is available
  useEffect(() => {
    if (currentWorkspaceId && isSharedWorkspace) {
      connect(currentWorkspaceId);
    } else {
      // Disconnect if switching to a non-shared workspace
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [currentWorkspaceId, isSharedWorkspace, connect, disconnect]);

  // CRITICAL: Only pass workspaceId to sync when we're BOTH connected AND the workspace is shared
  // This prevents local workspace data from being deleted by stale Yjs state
  // When disconnected or on a local workspace, pass null to disable sync operations
  const syncWorkspaceId =
    isConnected && isSharedWorkspace ? currentWorkspaceId : null;
  // Main entity sync (boards, columns, tasks, etc.)
  useYjsSync(doc, isConnected, syncWorkspaceId);
  // Dedicated task detail modal sync (handles ownership and prevents race conditions)
  // Pass currentWorkspaceId so it can track workspace changes and avoid syncing stale modals
  useTaskDialogSync(doc, isConnected, currentWorkspaceId);

  // Wrap with PresenceProvider when workspace is shared and we have user info
  // This maintains the presence connection at the workspace level
  if (currentWorkspaceId && isSharedWorkspace && localUser) {
    return (
      <PresenceProvider
        enabled={isConnected}
        userAvatar={localUser.image ?? undefined}
        userId={localUser.id}
        userName={localUser.name}
        workspaceId={currentWorkspaceId}
      >
        {children}
      </PresenceProvider>
    );
  }

  return <>{children}</>;
}

interface CollaborationWrapperProps {
  apiUrl?: string;
  children: ReactNode;
  enabled?: boolean;
}

export function CollaborationWrapper({
  children,
  apiUrl,
  enabled = true,
}: CollaborationWrapperProps) {
  return (
    <CollaborationProvider apiUrl={apiUrl} enabled={enabled}>
      <YjsSyncEnabler>{children}</YjsSyncEnabler>
    </CollaborationProvider>
  );
}
