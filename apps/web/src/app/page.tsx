"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { KanbanCanvas } from "@/src/components/core/canvas";
import { CommandPalette } from "@/src/components/dialogs/command-palette";
import { FloatingNavbar } from "@/src/components/floating-navbar";
import { MobileNavbar } from "@/src/components/mobile-navbar";
import { RightControls } from "@/src/components/right-controls";
import { JoinWorkspaceHandler } from "@/src/features/collab";
import { BulkActionsBar } from "@/src/features/kanban/components/bulk-actions-bar";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { CanvasContextMenu } from "../components/core/canvas-context-menu";

function KanbanPageContent() {
  const [isReady, setIsReady] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const shareToken = searchParams.get("share");

  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

  const handleJoinComplete = useCallback(
    async (workspaceId: string | null) => {
      if (shareToken) {
        router.replace("/");
      }

      if (workspaceId) {
        const existingWorkspace = workspaces.byId[workspaceId];

        if (!existingWorkspace) {
          useKanbanStore.setState((state) => {
            state.workspaces.byId[workspaceId] = {
              id: workspaceId,
              name: "Shared Workspace",
              description: "Joined via share link",
              created_at: new Date().toISOString(),
              board_ids: [],
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
            const data = await response.json();

            useKanbanStore.setState((state) => {
              // Merge boards
              for (const [id, board] of Object.entries(data.boards || {})) {
                // biome-ignore lint/suspicious/noExplicitAny: TODO: Type properly
                state.boards.byId[id] = board as any;
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
              for (const [id, column] of Object.entries(data.columns || {})) {
                // biome-ignore lint/suspicious/noExplicitAny: TODO: Type properly
                state.columns.byId[id] = column as any;
                if (!state.columns.allIds.includes(id)) {
                  state.columns.allIds.push(id);
                }
              }

              // Merge tasks
              for (const [id, task] of Object.entries(data.tasks || {})) {
                // biome-ignore lint/suspicious/noExplicitAny: TODO: Type properly
                state.tasks.byId[id] = task as any;
                if (!state.tasks.allIds.includes(id)) {
                  state.tasks.allIds.push(id);
                }
              }

              // Merge board positions
              for (const [id, pos] of Object.entries(
                data.boardPositions || {}
              )) {
                // biome-ignore lint/suspicious/noExplicitAny: TODO: Type properly
                state.boardPositions.byId[id] = pos as any;
                if (!state.boardPositions.allIds.includes(id)) {
                  state.boardPositions.allIds.push(id);
                }
              }
            });

            console.log("Synced shared workspace data:", {
              boards: Object.keys(data.boards || {}).length,
              tasks: Object.keys(data.tasks || {}).length,
            });
          }
        } catch (error) {
          console.error("Failed to fetch workspace state:", error);
        }
      }
    },
    [shareToken, router, workspaces.byId, setCurrentWorkspace, apiUrl]
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
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <JoinWorkspaceHandler
        onComplete={handleJoinComplete}
        shareToken={shareToken}
      />

      {isReady ? (
        <>
          <ReactFlowProvider>
            <KanbanCanvas />
            <MobileNavbar position="bottom" />
          </ReactFlowProvider>
          <FloatingNavbar />
          <RightControls />
          <CanvasContextMenu />
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
