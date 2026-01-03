import { useMemo } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import type { Comment } from "@/src/features/kanban/types";

export type CommentCluster = {
  id: string;
  comments: Comment[];
  centroid: { x: number; y: number };
  isSingle: boolean;
};

const CLUSTER_RADIUS = 80;

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // biome-ignore lint/suspicious/noBitwiseOperators: Hash function requires bitwise operations
    h = (h << 5) - h + char;
    // Convert to 32bit integer
    // biome-ignore lint/suspicious/noBitwiseOperators: Hash function requires bitwise operations
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export function useCommentClusters(): CommentCluster[] {
  const comments = useKanbanStore((state) => state.comments);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );

  return useMemo(() => {
    const workspaceComments = comments.allIds
      .map((id) => comments.byId[id])
      .filter((c): c is Comment => !!c && c.workspaceId === currentWorkspaceId);

    if (workspaceComments.length === 0) {
      return [];
    }

    const assigned = new Set<string>();
    const clusters: CommentCluster[] = [];

    const distance = (a: Comment, b: Comment) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const getNeighbors = (comment: Comment): Comment[] =>
      workspaceComments.filter(
        (c) => c.id !== comment.id && distance(comment, c) <= CLUSTER_RADIUS
      );

    const expandCluster = (seed: Comment): Comment[] => {
      const cluster: Comment[] = [seed];
      const queue = [seed];
      assigned.add(seed.id);

      while (queue.length > 0) {
        // biome-ignore lint/style/noNonNullAssertion: This is safe due to the loop condition
        const current = queue.shift()!;
        const neighbors = getNeighbors(current);

        for (const neighbor of neighbors) {
          if (!assigned.has(neighbor.id)) {
            assigned.add(neighbor.id);
            cluster.push(neighbor);
            queue.push(neighbor);
          }
        }
      }

      return cluster;
    };

    for (const comment of workspaceComments) {
      if (assigned.has(comment.id)) {
        continue;
      }

      const clusterComments = expandCluster(comment);

      const centroid = {
        x:
          clusterComments.reduce((sum, c) => sum + c.x, 0) /
          clusterComments.length,
        y:
          clusterComments.reduce((sum, c) => sum + c.y, 0) /
          clusterComments.length,
      };

      clusterComments.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      clusters.push({
        id: `cluster-${hash(
          clusterComments
            .map((c) => c.id)
            .sort()
            .join(",")
        )}`,
        comments: clusterComments,
        centroid,
        isSingle: clusterComments.length === 1,
      });
    }

    return clusters;
  }, [comments, currentWorkspaceId]);
}
