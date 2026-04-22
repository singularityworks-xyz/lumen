import { describe, expect, it } from "bun:test";

// We test the pure logic directly, not the hook wrapper.
// The hook just wraps this in useMemo with store access.

const CLUSTER_RADIUS = 80;

interface Comment {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  parentId?: string;
  updatedAt: string;
  workspaceId: string;
  x: number;
  y: number;
}

interface CommentCluster {
  centroid: { x: number; y: number };
  comments: Comment[];
  id: string;
  isSingle: boolean;
}

function makeComment(
  id: string,
  x: number,
  y: number,
  createdAt = "2024-01-01T00:00:00Z",
  wsId = "ws-1"
): Comment {
  return {
    id,
    x,
    y,
    content: `Comment ${id}`,
    authorId: "user-1",
    workspaceId: wsId,
    createdAt,
    updatedAt: createdAt,
  };
}

// Re-implement the clustering algorithm to test its behavior
function clusterComments(
  comments: Comment[],
  workspaceId: string
): CommentCluster[] {
  const workspaceComments = comments.filter(
    (c) => c.workspaceId === workspaceId && !c.parentId
  );

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

    const oldestCommentId = clusterComments[0]?.id ?? "unknown";

    clusters.push({
      id: `cluster-${oldestCommentId}`,
      comments: clusterComments,
      centroid,
      isSingle: clusterComments.length === 1,
    });
  }

  return clusters;
}

describe("comment clustering algorithm", () => {
  it("returns empty for no comments", () => {
    expect(clusterComments([], "ws-1")).toEqual([]);
  });

  it("creates a single cluster for one comment", () => {
    const comments = [makeComment("c1", 100, 100)];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.isSingle).toBe(true);
    expect(clusters[0]!.centroid).toEqual({ x: 100, y: 100 });
    expect(clusters[0]!.id).toBe("cluster-c1");
  });

  it("groups nearby comments into one cluster", () => {
    const comments = [
      makeComment("c1", 100, 100),
      makeComment("c2", 130, 110), // within 80px
      makeComment("c3", 150, 100), // within 80px of c2
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.comments).toHaveLength(3);
    expect(clusters[0]!.isSingle).toBe(false);
  });

  it("separates distant comments into different clusters", () => {
    const comments = [
      makeComment("c1", 0, 0),
      makeComment("c2", 500, 500), // far away
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.isSingle).toBe(true);
    expect(clusters[1]!.isSingle).toBe(true);
  });

  it("computes centroid correctly", () => {
    const comments = [
      makeComment("c1", 0, 0),
      makeComment("c2", 40, 40), // within 80px
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.centroid).toEqual({ x: 20, y: 20 });
  });

  it("uses oldest comment id as cluster id", () => {
    const comments = [
      makeComment("c2", 100, 100, "2024-02-01T00:00:00Z"),
      makeComment("c1", 120, 100, "2024-01-01T00:00:00Z"), // older
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.id).toBe("cluster-c1");
    expect(clusters[0]!.comments[0]!.id).toBe("c1"); // sorted by time
  });

  it("excludes reply comments (with parentId)", () => {
    const comments: Comment[] = [
      makeComment("c1", 100, 100),
      { ...makeComment("c2", 110, 100), parentId: "c1" }, // reply
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.comments).toHaveLength(1);
    expect(clusters[0]!.comments[0]!.id).toBe("c1");
  });

  it("filters by workspace id", () => {
    const comments = [
      makeComment("c1", 100, 100, "2024-01-01T00:00:00Z", "ws-1"),
      makeComment("c2", 110, 100, "2024-01-01T00:00:00Z", "ws-2"),
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.comments[0]!.id).toBe("c1");
  });

  it("handles chain clustering (A-B-C where A and C are far but connected via B)", () => {
    const comments = [
      makeComment("c1", 0, 0),
      makeComment("c2", 70, 0), // within 80px of c1
      makeComment("c3", 140, 0), // within 80px of c2, but >80px from c1
    ];
    const clusters = clusterComments(comments, "ws-1");

    // Should form one cluster via chain: c1 → c2 → c3
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.comments).toHaveLength(3);
  });

  it("exact boundary distance (80px) is included", () => {
    const comments = [
      makeComment("c1", 0, 0),
      makeComment("c2", 80, 0), // exactly 80px
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.comments).toHaveLength(2);
  });

  it("just over boundary (81px) creates separate clusters", () => {
    const comments = [
      makeComment("c1", 0, 0),
      makeComment("c2", 81, 0), // just over 80px
    ];
    const clusters = clusterComments(comments, "ws-1");

    expect(clusters).toHaveLength(2);
  });
});
