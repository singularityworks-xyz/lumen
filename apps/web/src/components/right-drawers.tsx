"use client";

import { useReactFlow } from "@xyflow/react";
import { LayoutGrid, MessageCircle, Users, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { memo, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AiDrawer } from "@/src/features/ai/components/ai-drawer";
import LarityOrb from "@/src/features/ai/components/animations/larity-orb";
import { useAiStore } from "@/src/features/ai/store/ai-store";
import { CommentsDrawer } from "@/src/features/comments/components/comments-drawer";
import { useCommentClusters } from "@/src/features/comments/hooks/use-comment-clusters";
import { useCommentUIStore } from "@/src/features/comments/stores/comment-ui-store";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { BoardsDrawer } from "@/src/features/workspace/components/boards-drawer";
import { cn } from "@/src/lib/utils";

type ActiveDrawer = "none" | "comments" | "boards" | "ai";

const floatingTabClass = cn(
  "flex flex-col items-center justify-center gap-1",
  "w-10 rounded-l-xl py-3.5",
  "bg-card/95 backdrop-blur-md",
  "border-2 border-border/50 border-r-0",
  "shadow-[0_4px_20px_rgba(0,0,0,0.15),-4px_0_12px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.25),inset_0_-2px_6px_rgba(255,255,255,0.08),inset_1px_0_4px_rgba(0,0,0,0.15)]",
  "dark:shadow-[0_4px_20px_rgba(0,0,0,0.6),-4px_0_12px_rgba(0,0,0,0.3),inset_0_3px_12px_rgba(255,255,255,0.12),inset_0_-3px_10px_rgba(0,0,0,0.5),inset_1px_0_6px_rgba(0,0,0,0.3)]",
  "hover:bg-card hover:shadow-[0_4px_24px_rgba(0,0,0,0.2),-6px_0_16px_rgba(0,0,0,0.12),inset_0_3px_12px_rgba(0,0,0,0.3),inset_0_-2px_8px_rgba(255,255,255,0.1),inset_1px_0_5px_rgba(0,0,0,0.18)]",
  "dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.7),-6px_0_16px_rgba(0,0,0,0.35),inset_0_3px_14px_rgba(255,255,255,0.15),inset_0_-3px_12px_rgba(0,0,0,0.55),inset_1px_0_7px_rgba(0,0,0,0.35)]",
  "group cursor-pointer transition-all duration-300"
);

export const RightDrawers = memo(() => {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");
  const { setCenter, getZoom } = useReactFlow();
  const clusters = useCommentClusters();

  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const setLastActiveDrawerTab = useKanbanStore(
    (state) => state.setLastActiveDrawerTab
  );

  const commentCount = useKanbanStore(
    useCallback(
      (state) =>
        currentWorkspaceId
          ? state.comments.allIds.filter((id) => {
              const c = state.comments.byId[id];
              return !!c && c.workspaceId === currentWorkspaceId && !c.parentId;
            }).length
          : 0,
      [currentWorkspaceId]
    )
  );

  const discussionCount = useKanbanStore(
    useCallback(
      (state) =>
        currentWorkspaceId
          ? state.chatMessages.allIds.filter(
              (id) =>
                state.chatMessages.byId[id]?.workspaceId === currentWorkspaceId
            ).length
          : 0,
      [currentWorkspaceId]
    )
  );

  const boardCount = useKanbanStore(
    useCallback(
      (state) => {
        if (!currentWorkspaceId) {
          return 0;
        }
        const ws = state.workspaces.byId[currentWorkspaceId];
        return (
          ws?.board_ids?.filter((id) => state.boards.byId[id])?.length ?? 0
        );
      },
      [currentWorkspaceId]
    )
  );

  const isSharedWorkspace = useKanbanStore(
    useCallback(
      (state) => {
        if (!currentWorkspaceId) {
          return false;
        }
        const ws = state.workspaces.byId[currentWorkspaceId];
        return (
          ws?.isShared === true ||
          !!ws?.shareToken ||
          !!state.workspaceShareUrls[currentWorkspaceId]
        );
      },
      [currentWorkspaceId]
    )
  );

  const hasAiMessages = useAiStore(
    useShallow(
      (state) =>
        (currentWorkspaceId
          ? (state.conversations[currentWorkspaceId]?.messages?.length ?? 0)
          : 0) > 0
    )
  );
  const isAiOffline = useAiStore((state) => state.isOffline);

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
      <div className="pointer-events-none fixed top-1/2 right-0 z-40 flex -translate-y-1/2 flex-col items-end gap-2.5">
        <motion.div
          animate={{
            x: activeDrawer === "none" ? 0 : 100,
            opacity: activeDrawer === "none" ? 1 : 0,
          }}
          className="pointer-events-auto flex flex-col items-end gap-2.5"
          initial={{ x: 100, opacity: 0 }}
          style={{ willChange: "transform, opacity" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {isSharedWorkspace && (
            <>
              <button
                aria-label="Open comments"
                className={floatingTabClass}
                data-testid="comments-drawer-trigger"
                onClick={() => {
                  setLastActiveDrawerTab("comments");
                  setActiveDrawer("comments");
                }}
                type="button"
              >
                <div className="relative">
                  <span className="text-muted-foreground transition-colors group-hover:text-primary">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  {commentCount > 0 && (
                    <motion.span
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-bold text-[9px] text-primary-foreground shadow-sm"
                      initial={{ scale: 0 }}
                    >
                      {commentCount > 99 ? "99+" : commentCount}
                    </motion.span>
                  )}
                </div>
                <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
                  Comments
                </span>
              </button>

              <button
                aria-label="Open chat"
                className={floatingTabClass}
                data-testid="chat-drawer-trigger"
                onClick={() => {
                  setLastActiveDrawerTab("discussion");
                  setActiveDrawer("comments");
                }}
                type="button"
              >
                <div className="relative">
                  <span className="text-muted-foreground transition-colors group-hover:text-primary">
                    <Users className="h-5 w-5" />
                  </span>
                  {discussionCount > 0 && (
                    <motion.span
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-bold text-[9px] text-primary-foreground shadow-sm"
                      initial={{ scale: 0 }}
                    >
                      {discussionCount > 99 ? "99+" : discussionCount}
                    </motion.span>
                  )}
                </div>
                <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
                  Chat
                </span>
              </button>
            </>
          )}

          <button
            aria-label="Open boards"
            className={floatingTabClass}
            data-testid="boards-drawer-trigger"
            onClick={() => setActiveDrawer("boards")}
            type="button"
          >
            <div className="relative">
              <LayoutGrid className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              {boardCount > 0 && (
                <motion.span
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-bold text-[9px] text-primary-foreground shadow-sm"
                  initial={{ scale: 0 }}
                >
                  {boardCount > 99 ? "99+" : boardCount}
                </motion.span>
              )}
            </div>
            <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
              Boards
            </span>
          </button>

          {currentWorkspaceId && (
            <button
              aria-label="Open AI assistant"
              className={floatingTabClass}
              data-testid="ai-floating-indicator"
              onClick={() => setActiveDrawer("ai")}
              type="button"
            >
              <div className="relative">
                <LarityOrb size="xs" speed={0.3} />
                {hasAiMessages && (
                  <motion.span
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-primary shadow-sm"
                    initial={{ scale: 0 }}
                  />
                )}
                {isAiOffline && (
                  <WifiOff className="absolute -right-1 -bottom-1 h-3 w-3 text-yellow-500" />
                )}
              </div>
              <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
                Larity
              </span>
            </button>
          )}
        </motion.div>
      </div>

      {isSharedWorkspace && (
        <CommentsDrawer
          boardCount={boardCount}
          isOpen={activeDrawer === "comments"}
          onCommentClick={handleCommentClick}
          onOpenChange={handleCommentsOpenChange}
          onSwitchToAi={handleSwitchToAi}
          onSwitchToBoards={handleSwitchToBoards}
          showTrigger={false}
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
        showTrigger={false}
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
          showTrigger={false}
          workspaceId={currentWorkspaceId}
        />
      )}
    </>
  );
});

export default RightDrawers;
