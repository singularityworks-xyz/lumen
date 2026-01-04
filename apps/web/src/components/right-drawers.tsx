"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { CommentsDrawer } from "@/src/features/comments/components/comments-drawer";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { BoardsDrawer } from "@/src/features/workspace/components/boards-drawer";

type ActiveDrawer = "none" | "comments" | "boards";

export const RightDrawers = memo(() => {
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>("none");

  const comments = useKanbanStore((state) => state.comments);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const boards = useKanbanStore((state) => state.boards);

  const commentCount = useMemo(
    () =>
      comments.allIds
        .map((id) => comments.byId[id])
        .filter(
          (c): c is Comment => !!c && c.workspaceId === currentWorkspaceId
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

  return (
    <>
      <CommentsDrawer
        boardCount={boardCount}
        defaultOpen={activeDrawer === "comments"}
        key={`comments-${activeDrawer}`}
        onSwitchToBoards={handleSwitchToBoards}
      />
      <BoardsDrawer
        commentCount={commentCount}
        defaultOpen={activeDrawer === "boards"}
        key={`boards-${activeDrawer}`}
        onSwitchToComments={handleSwitchToComments}
      />
    </>
  );
});

export default RightDrawers;
