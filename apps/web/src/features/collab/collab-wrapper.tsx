"use client";

import { type ReactNode, useEffect } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { CollaborationProvider, useCollaboration } from "./collab-provider";
import { useYjsSync } from "./hooks/use-yjs-sync";

// Connects to WebSocket and enables sync when workspace is available and shared
function YjsSyncEnabler({ children }: { children: ReactNode }) {
  const { doc, connectionState, connect, disconnect } = useCollaboration();
  const currentWorkspaceId = useKanbanStore((s) => s.currentWorkspaceId);
  const currentWorkspace = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaces.byId[s.currentWorkspaceId] : null
  );
  const shareUrl = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaceShareUrls[s.currentWorkspaceId] : null
  );
  const isConnected = connectionState === "connected";

  // Only auto-connect when workspace is shared (joined via share OR has share URL)
  const isSharedWorkspace = currentWorkspace?.isShared === true || !!shareUrl;

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

  useYjsSync(doc, isConnected, currentWorkspaceId);
  return <>{children}</>;
}

type CollaborationWrapperProps = {
  children: ReactNode;
  apiUrl?: string;
  enabled?: boolean;
};

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
