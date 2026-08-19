import { useEffect, useMemo, useState } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import type { Comment } from "@/src/features/kanban/types";
import {
  computeCommentClusters,
  runClusterWorker,
} from "@/src/workers/worker-client";

export interface CommentCluster {
  centroid: { x: number; y: number };
  comments: Comment[];
  id: string;
  isSingle: boolean;
}

const CLUSTER_RADIUS = 80;

export function useCommentClusters(): CommentCluster[] {
  const comments = useKanbanStore((state) => state.comments);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );

  const workspaceComments = useMemo(
    () =>
      comments.allIds
        .map((id) => comments.byId[id])
        .filter(
          (c): c is Comment =>
            !!c && c.workspaceId === currentWorkspaceId && !c.parentId
        ),
    [comments, currentWorkspaceId]
  );

  const [clusters, setClusters] = useState<CommentCluster[]>(() =>
    computeCommentClusters(workspaceComments, CLUSTER_RADIUS)
  );

  useEffect(() => {
    let active = true;
    runClusterWorker(workspaceComments, CLUSTER_RADIUS)
      .then((res) => {
        if (active) {
          setClusters(res);
        }
      })
      .catch(() => {
        if (active) {
          setClusters(
            computeCommentClusters(workspaceComments, CLUSTER_RADIUS)
          );
        }
      });

    return () => {
      active = false;
    };
  }, [workspaceComments]);

  return clusters;
}
