import { createLogger } from "@lumen/logger";
import { useEffect } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { useAuth } from "@/src/hooks/use-auth";

const logger = createLogger({ name: "use-workspace-sync" });

export function useWorkspaceSync() {
  const { user } = useAuth();
  const syncWorkspace = useKanbanStore((state) => state.syncWorkspace);

  useEffect(() => {
    if (!user) {
      return;
    }

    const syncWorkspaces = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
        const response = await fetch(`${apiUrl}/api/workspaces`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch workspaces");
        }

        const backendWorkspaces: Array<{
          id: string;
          name: string;
          description?: string;
          ownerId: string;
          ownerName?: string;
          ownerImage?: string;
          isShared: boolean;
        }> = await response.json();

        logger.info(
          { count: backendWorkspaces.length },
          "Synced workspaces from backend"
        );

        for (const ws of backendWorkspaces) {
          syncWorkspace({
            id: ws.id,
            name: ws.name,
            description: ws.description || undefined,
            ownerId: ws.ownerId,
            ownerName: ws.ownerName || undefined,
            ownerImage: ws.ownerImage || undefined,
            isShared: ws.isShared,
            // Preserve existing local state if any, otherwise defaults handle it in slice
          });
        }
      } catch (error) {
        logger.error("Failed to sync workspaces", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    syncWorkspaces();
  }, [user, syncWorkspace]);
}
