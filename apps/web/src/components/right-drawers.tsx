"use client";

import { useReactFlow } from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";
import { AiDrawer } from "@/src/features/ai/components/ai-drawer";
import { CommentsDrawer } from "@/src/features/comments/components/comments-drawer";
import { useCommentClusters } from "@/src/features/comments/hooks/use-comment-clusters";
import { useCommentUIStore } from "@/src/features/comments/stores/comment-ui-store";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { BoardsDrawer } from "@/src/features/workspace/components/boards-drawer";

type ActiveDrawer = "none" | "comments" | "boards" | "ai";

export const RightDrawers = memo(() => {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const { setCenter, getZoom } = useReactFlow();
  const clusters = useCommentClusters();

  const comments = useKanbanStore((state) => state.comments);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const boards = useKanbanStore((state) => state.boards);
  const shareUrl = useKanbanStore((state) =>
    currentWorkspaceId ? state.workspaceShareUrls[currentWorkspaceId] : null
  );

  const currentWorkspace = currentWorkspaceId
    ? workspaces.byId[currentWorkspaceId]
    : null;
  const isSharedWorkspace =
    currentWorkspace?.isShared === true ||
    !!currentWorkspace?.shareToken ||
    !!shareUrl;

  const commentCount = useMemo(
    () =>
      comments.allIds
        .map((id) => comments.byId[id])
        .filter(
          (c): c is Comment =>
            !!c && c.workspaceId === currentWorkspaceId && !c.parentId
        ).length,
    [comments, currentWorkspaceId]
  );

  const boardCount = useMemo(() => {
    if (!currentWorkspaceId) {
      return 0;
    }
    const workspace = workspaces.byId[currentWorkspaceId];
    return workspace?.board_ids?.filter((id) => boards.byId[id])?.length ?? 0;
  }, [currentWorkspaceId, workspaces, boards]);

  const handleSwitchToComments = useCallback(() => {
    setActiveDrawer("comments");
  }, []);

  const handleSwitchToBoards = useCallback(() => {
    setActiveDrawer("boards");
  }, []);

  const handleSwitchToAi = useCallback(() => {
    setActiveDrawer("ai");
  }, []);

  const handleCommentsOpenChange = useCallback((open: boolean) => {
    setActiveDrawer(open ? "comments" : "none");
  }, []);

  const handleBoardsOpenChange = useCallback((open: boolean) => {
    setActiveDrawer(open ? "boards" : "none");
  }, []);

  const handleAiOpenChange = useCallback((open: boolean) => {
    setActiveDrawer(open ? "ai" : "none");
  }, []);

  const openCluster = useCommentUIStore((state) => state.openCluster);
  const handleCommentClick = useCallback(
    (comment: Comment) => {
      const cluster = clusters.find((c) =>
        c.comments.some((cc) => cc.id === comment.id)
      );

      const targetX =
        cluster && !cluster.isSingle ? cluster.centroid.x : comment.x;
      const targetY =
        cluster && !cluster.isSingle ? cluster.centroid.y : comment.y;

      setActiveDrawer("none");

      setTimeout(() => {
        setCenter(targetX, targetY, {
          zoom: Math.max(getZoom(), 1.2),
          duration: 800,
        });

        if (cluster && !cluster.isSingle) {
          setTimeout(() => {
            openCluster(cluster.id, comment.id);
          }, 850);
        }
      }, 300);
    },
    [clusters, setCenter, getZoom, openCluster]
  );

  return (
    <>
      {isSharedWorkspace && (
        <CommentsDrawer
          boardCount={boardCount}
          isOpen={activeDrawer === "comments"}
          onCommentClick={handleCommentClick}
          onOpenChange={handleCommentsOpenChange}
          onSwitchToAi={handleSwitchToAi}
          onSwitchToBoards={handleSwitchToBoards}
        />
      )}
      <BoardsDrawer
        commentCount={isSharedWorkspace ? commentCount : 0}
        isOpen={activeDrawer === "boards"}
        onOpenChange={handleBoardsOpenChange}
        onSwitchToAi={handleSwitchToAi}
        onSwitchToComments={
          isSharedWorkspace ? handleSwitchToComments : undefined
        }
      />
      {currentWorkspaceId && (
        <AiDrawer
          boardCount={boardCount}
          commentCount={isSharedWorkspace ? commentCount : 0}
          isOpen={activeDrawer === "ai"}
          onOpenChange={handleAiOpenChange}
          onSwitchToBoards={handleSwitchToBoards}
          onSwitchToComments={
            isSharedWorkspace ? handleSwitchToComments : undefined
          }
          workspaceId={currentWorkspaceId}
        />
      )}
    </>
  );
});

export default RightDrawers;
