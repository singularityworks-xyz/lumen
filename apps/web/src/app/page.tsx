"use client";
import { logger } from "@lumen/logger";
import { ReactFlowProvider } from "@xyflow/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { KanbanCanvas } from "@/src/components/core/canvas";
import { CommandPalette } from "@/src/components/dialogs/command-palette";
import { FloatingNavbar } from "@/src/components/floating-navbar";
import { GuestViewCounter } from "@/src/components/guest-view-counter";
import { MobileNavbar } from "@/src/components/mobile-navbar";
import { RightDrawers } from "@/src/components/right-drawers";
import { SharedViaLumenWatermark } from "@/src/components/shared-via-lumen-watermark";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import {
  type JoinSuccessData,
  JoinWorkspaceHandler,
  useCollaboration,
} from "@/src/features/collab";
import { useWorkspaceSync } from "@/src/features/collab/hooks/use-workspace-sync";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type {
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Task,
  TaskDetailModalState,
  TextBoard,
  TextBoardPosition,
} from "@/src/features/kanban/types";
import { WorkspaceDeletedBanner } from "@/src/features/workspace/components/workspace-deleted-banner";
import { normalizeApiUrlForCurrentHost } from "@/src/lib/url";
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
  const guestToken =
    searchParams.get("guest") || searchParams.get("guestToken");

  const isGuestMode =
    useKanbanStore((state) => state.isGuestMode) || !!guestToken;
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const currentWorkspace = currentWorkspaceId
    ? workspaces.byId[currentWorkspaceId]
    : null;
  const apiUrl = normalizeApiUrlForCurrentHost(env.NEXT_PUBLIC_API_URL);

  useEffect(() => {
    if (currentWorkspace?.name) {
      document.title = `${currentWorkspace.name} | Lumen`;
    } else {
      document.title = "Lumen";
    }
  }, [currentWorkspace?.name]);

  useEffect(() => {
    if (guestToken) {
      useKanbanStore.getState().setGuestMode(true, guestToken);
    }
  }, [guestToken]);

  const handleJoinComplete = useCallback(
    async (data: JoinSuccessData | null) => {
      if (shareToken && !guestToken) {
        router.replace("/");
      }

      if (data?.workspaceId) {
        const { workspaceId, workspaceName, owner, isGuest } = data;
        const existingWorkspace = workspaces.byId[workspaceId];

        if (!existingWorkspace) {
          useKanbanStore.setState((state) => {
            state.workspaces.byId[workspaceId] = {
              id: workspaceId,
              name: workspaceName || "Shared Workspace",
              description: owner
                ? `Shared by ${owner.name || owner.email}`
                : isGuest
                  ? "Shared via Lumen"
                  : "Joined via share link",
              created_at: new Date().toISOString(),
              board_ids: [],
              text_board_ids: [],
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
          const stateEndpoint =
            isGuest && guestToken
              ? `${apiUrl}/api/share/guest/${guestToken}/state`
              : `${apiUrl}/api/workspaces/${workspaceId}/state`;

          const response = await fetch(stateEndpoint, {
            credentials: isGuest ? "same-origin" : "include",
          });

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

              // Merge text boards
              for (const [id, textBoard] of Object.entries(
                stateData.textBoards || {}
              )) {
                state.textBoards.byId[id] = textBoard as TextBoard;
                if (!state.textBoards.allIds.includes(id)) {
                  state.textBoards.allIds.push(id);
                }
                if (
                  !state.workspaces.byId[workspaceId]?.text_board_ids?.includes(
                    id
                  )
                ) {
                  if (!state.workspaces.byId[workspaceId]?.text_board_ids) {
                    const ws = state.workspaces.byId[workspaceId];
                    if (ws) {
                      ws.text_board_ids = [];
                    }
                  }
                  state.workspaces.byId[workspaceId]?.text_board_ids?.push(id);
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

              // Merge text board positions
              for (const [id, pos] of Object.entries(
                stateData.textBoardPositions || {}
              )) {
                state.textBoardPositions.byId[id] = pos as TextBoardPosition;
                if (!state.textBoardPositions.allIds.includes(id)) {
                  state.textBoardPositions.allIds.push(id);
                }
              }

              // Merge board connections
              for (const [id, conn] of Object.entries(
                stateData.boardConnections || {}
              )) {
                state.boardConnections.byId[id] = conn as BoardConnection;
                if (!state.boardConnections.allIds.includes(id)) {
                  state.boardConnections.allIds.push(id);
                }
              }

              // Merge task detail modals
              for (const [id, modal] of Object.entries(
                stateData.taskDetailModals || {}
              )) {
                state.taskDetailModals[id] = modal as TaskDetailModalState;
              }
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch workspace state:${error}`);
        }
      }
    },
    [
      apiUrl,
      shareToken,
      guestToken,
      router,
      workspaces.byId,
      setCurrentWorkspace,
    ]
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
        <TooltipProvider delayDuration={200}>
          <JoinWorkspaceHandler
            guestToken={guestToken}
            onComplete={handleJoinComplete}
            shareToken={shareToken}
          />
          <ReactFlowProvider>
            <KanbanCanvas />
            {!isGuestMode && <MobileNavbar position="bottom" />}
            {!isGuestMode && <CanvasContextMenu />}
            {!isGuestMode && <RightDrawers />}
          </ReactFlowProvider>
          {!isGuestMode && <FloatingNavbar />}
          {!isGuestMode && <RightControls />}
          {!isGuestMode && <CommandPalette />}
          {!isGuestMode && <BulkActionsBar />}
          {isGuestMode && <SharedViaLumenWatermark />}
          {isGuestMode && <GuestViewCounter />}
        </TooltipProvider>
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
