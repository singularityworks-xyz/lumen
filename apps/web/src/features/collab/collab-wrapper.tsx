"use client";

import { type ReactNode, useEffect } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { CollaborationProvider, useCollaboration } from "./collab-provider";
import { useYjsSync } from "./hooks/use-yjs-sync";

// Connects to WebSocket and enables sync when workspace is available
function YjsSyncEnabler({ children }: { children: ReactNode }) {
  const { doc, connectionState, connect, disconnect } = useCollaboration();
  const currentWorkspaceId = useKanbanStore((s) => s.currentWorkspaceId);
  const isConnected = connectionState === "connected";

  // Auto-connect when workspace is available
  useEffect(() => {
    if (currentWorkspaceId) {
      connect(currentWorkspaceId);
    }

    return () => {
      disconnect();
    };
  }, [currentWorkspaceId, connect, disconnect]);

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
