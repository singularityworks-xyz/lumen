"use client";
import { logger } from "@lumen/logger";
import { ReactFlowProvider } from "@xyflow/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { KanbanCanvas } from "@/src/components/core/canvas";
import { CommandPalette } from "@/src/components/dialogs/command-palette";
import { FloatingNavbar } from "@/src/components/floating-navbar";
import { MobileNavbar } from "@/src/components/mobile-navbar";
import { RightDrawers } from "@/src/components/right-drawers";
import {
  type JoinSuccessData,
  JoinWorkspaceHandler,
  useCollaboration,
} from "@/src/features/collab";
import { useWorkspaceSync } from "@/src/features/collab/hooks/use-workspace-sync";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type {
  Board,
  BoardPosition,
  Column,
  Task,
} from "@/src/features/kanban/types";
import { WorkspaceDeletedBanner } from "@/src/features/workspace/components/workspace-deleted-banner";
import { CanvasContextMenu } from "../components/core/canvas-context-menu";
import { RightControls } from "../components/right-controls";
import { env } from "../env";
import { BulkActionsBar } from "../features/kanban";

function KanbanPageContent() {
  const [isReady, setIsReady] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  useCollaboration();
  useWorkspaceSync();
  const shareToken = searchParams.get("share");

  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const apiUrl = env.NEXT_PUBLIC_API_URL.replace("localhost", "127.0.0.1");

  const handleJoinComplete = useCallback(
    async (data: JoinSuccessData | null) => {
      if (shareToken) {
        router.replace("/");
      }

      if (data?.workspaceId) {
        const { workspaceId, workspaceName, owner } = data;
        const existingWorkspace = workspaces.byId[workspaceId];

        if (!existingWorkspace) {
          useKanbanStore.setState((state) => {
            state.workspaces.byId[workspaceId] = {
              id: workspaceId,
              name: workspaceName || "Shared Workspace",
              description: owner
                ? `Shared by ${owner.name || owner.email}`
                : "Joined via share link",
              created_at: new Date().toISOString(),
              board_ids: [],
              isShared: true,
              ownerId: owner?.id,
              ownerName: owner?.name || owner?.email || "Unknown",
              ownerImage: owner?.image || undefined,
              shareToken: shareToken || undefined,
            };
            if (!state.workspaces.allIds.includes(workspaceId)) {
              state.workspaces.allIds.push(workspaceId);
            }
          });
        }

        setCurrentWorkspace(workspaceId);

        try {
          const response = await fetch(
            `${apiUrl}/api/workspaces/${workspaceId}/state`,
            {
              credentials: "include",
            }
          );

          if (response.ok) {
            const stateData = await response.json();

            useKanbanStore.setState((state) => {
              for (const [id, board] of Object.entries(
                stateData.boards || {}
              )) {
                state.boards.byId[id] = board as Board;
                if (!state.boards.allIds.includes(id)) {
                  state.boards.allIds.push(id);
                }
                if (
                  !state.workspaces.byId[workspaceId]?.board_ids.includes(id)
                ) {
                  state.workspaces.byId[workspaceId]?.board_ids.push(id);
                }
              }

              // Merge columns
              for (const [id, column] of Object.entries(
                stateData.columns || {}
              )) {
                state.columns.byId[id] = column as Column;
                if (!state.columns.allIds.includes(id)) {
                  state.columns.allIds.push(id);
                }
              }

              // Merge tasks
              for (const [id, task] of Object.entries(stateData.tasks || {})) {
                state.tasks.byId[id] = task as Task;
                if (!state.tasks.allIds.includes(id)) {
                  state.tasks.allIds.push(id);
                }
              }

              // Merge board positions
              for (const [id, pos] of Object.entries(
                stateData.boardPositions || {}
              )) {
                state.boardPositions.byId[id] = pos as BoardPosition;
                if (!state.boardPositions.allIds.includes(id)) {
                  state.boardPositions.allIds.push(id);
                }
              }
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch workspace state:${error}`);
        }
      }
    },
    [apiUrl, shareToken, router, workspaces.byId, setCurrentWorkspace]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsub = useKanbanStore.persist.onFinishHydration(() => {
      setIsReady(true);
    });

    if (useKanbanStore.persist.hasHydrated()) {
      setIsReady(true);
    }

    return () => {
      unsub();
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <WorkspaceDeletedBanner />
      {isReady ? (
        <>
          <JoinWorkspaceHandler
            onComplete={handleJoinComplete}
            shareToken={shareToken}
          />
          <ReactFlowProvider>
            <KanbanCanvas />
            <MobileNavbar position="bottom" />
            <CanvasContextMenu />
            <RightDrawers />
          </ReactFlowProvider>
          <FloatingNavbar />
          <RightControls />
          <CommandPalette />
          <BulkActionsBar />
        </>
      ) : null}
    </div>
  );
}

export default function KanbanPage() {
  return (
    <Suspense fallback={null}>
      <KanbanPageContent />
    </Suspense>
  );
}
