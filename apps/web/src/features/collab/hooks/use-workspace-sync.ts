import { createLogger } from "@lumen/logger";
import { useEffect } from "react";
import { env } from "@/src/env";
import { useKanbanStore } from "@/src/features/kanban/store";
import type {
  Board,
  BoardPosition,
  Column,
  Task,
} from "@/src/features/kanban/types";
import { useAuth } from "@/src/hooks/use-auth";
import { normalizeApiUrlForCurrentHost } from "@/src/lib/url";

const logger = createLogger({ name: "use-workspace-sync" });
const MAX_CONCURRENT_PREFETCH = 3;

export function useWorkspaceSync() {
  const { user } = useAuth();
  const syncWorkspace = useKanbanStore((state) => state.syncWorkspace);

  useEffect(() => {
    if (!user) {
      return;
    }

    const abortController = new AbortController();
    let isActive = true;
    const shouldContinue = () => isActive && !abortController.signal.aborted;

    const syncWorkspaces = async () => {
      try {
        const apiUrl = normalizeApiUrlForCurrentHost(env.NEXT_PUBLIC_API_URL);
        const response = await fetch(`${apiUrl}/api/workspaces`, {
          credentials: "include",
          signal: abortController.signal,
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

        if (!shouldContinue()) {
          return;
        }

        logger.info(
          { count: backendWorkspaces.length },
          "Synced workspaces from backend"
        );

        for (const ws of backendWorkspaces) {
          if (!shouldContinue()) {
            return;
          }

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

        // Pre-fetch state for shared workspaces so content is available
        // before the user selects them (fixes empty workspace list on new device)
        const sharedWorkspaces = backendWorkspaces.filter((ws) => ws.isShared);
        if (sharedWorkspaces.length > 0) {
          await prefetchSharedWorkspaceStates(
            sharedWorkspaces,
            apiUrl,
            abortController.signal,
            shouldContinue
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        logger.error("Failed to sync workspaces", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    syncWorkspaces();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [user, syncWorkspace]);
}

async function prefetchSharedWorkspaceStates(
  workspaces: Array<{ id: string }>,
  apiUrl: string,
  signal: AbortSignal,
  shouldContinue: () => boolean
) {
  // Process in batches to avoid overwhelming the server
  for (let i = 0; i < workspaces.length; i += MAX_CONCURRENT_PREFETCH) {
    if (!shouldContinue()) {
      return;
    }

    const batch = workspaces.slice(i, i + MAX_CONCURRENT_PREFETCH);
    await Promise.allSettled(
      batch.map((ws) =>
        fetchAndMergeWorkspaceState(ws.id, apiUrl, signal, shouldContinue)
      )
    );
  }
}

async function fetchAndMergeWorkspaceState(
  workspaceId: string,
  apiUrl: string,
  signal: AbortSignal,
  shouldContinue: () => boolean
) {
  try {
    if (!shouldContinue()) {
      return;
    }

    // Skip if workspace already has boards loaded (e.g., from IndexedDB)
    const existing = useKanbanStore.getState().workspaces.byId[workspaceId];
    if (existing?.board_ids && existing.board_ids.length > 0) {
      logger.debug(
        { workspaceId },
        "Skipping pre-fetch - workspace already has content"
      );
      return;
    }

    const response = await fetch(
      `${apiUrl}/api/workspaces/${workspaceId}/state`,
      { credentials: "include", signal }
    );

    if (!shouldContinue()) {
      return;
    }

    if (!response.ok) {
      logger.warn(
        { workspaceId, status: response.status },
        "Failed to pre-fetch workspace state"
      );
      return;
    }

    const stateData = await response.json();

    if (!shouldContinue()) {
      return;
    }

    const boards = stateData.boards as Record<string, Board>;
    const columns = stateData.columns as Record<string, Column>;
    const tasks = stateData.tasks as Record<string, Task>;
    const boardPositions = stateData.boardPositions as Record<
      string,
      BoardPosition
    >;

    // Only merge if there's actual content
    const hasContent =
      Object.keys(boards).length > 0 ||
      Object.keys(columns).length > 0 ||
      Object.keys(tasks).length > 0;

    if (!hasContent) {
      return;
    }

    useKanbanStore.setState((state) => {
      if (!shouldContinue()) {
        return;
      }

      for (const [id, board] of Object.entries(boards)) {
        state.boards.byId[id] = board;
        if (!state.boards.allIds.includes(id)) {
          state.boards.allIds.push(id);
        }
        if (!state.workspaces.byId[workspaceId]?.board_ids.includes(id)) {
          state.workspaces.byId[workspaceId]?.board_ids.push(id);
        }
      }

      for (const [id, column] of Object.entries(columns)) {
        state.columns.byId[id] = column;
        if (!state.columns.allIds.includes(id)) {
          state.columns.allIds.push(id);
        }
      }

      for (const [id, task] of Object.entries(tasks)) {
        state.tasks.byId[id] = task;
        if (!state.tasks.allIds.includes(id)) {
          state.tasks.allIds.push(id);
        }
      }

      for (const [id, pos] of Object.entries(boardPositions)) {
        state.boardPositions.byId[id] = pos;
        if (!state.boardPositions.allIds.includes(id)) {
          state.boardPositions.allIds.push(id);
        }
      }
    });

    logger.info(
      {
        workspaceId,
        boardCount: Object.keys(boards).length,
        columnCount: Object.keys(columns).length,
        taskCount: Object.keys(tasks).length,
      },
      "Pre-fetched workspace state"
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    logger.error("Failed to pre-fetch workspace state", {
      workspaceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
