import type { Comment } from "@/src/features/kanban/types";

// ==========================================
// Types
// ==========================================

export interface CommentClusterData {
  centroid: { x: number; y: number };
  comments: Comment[];
  id: string;
  isSingle: boolean;
}

export interface SearchTaskItem {
  boardId: string;
  boardName: string;
  columnId: string;
  columnName: string;
  description?: string;
  id: string;
  tags?: string[];
  title: string;
}

export interface SearchTaskResult {
  boardName: string;
  columnName: string;
  score?: number;
  taskId: string;
  taskTitle: string;
}

export interface RawBoardData {
  accent_color?: string;
  column_ids: string[];
  description?: string;
  icon?: string;
  id: string;
  name: string;
}

export interface RawTextBoardData {
  accent_color?: string;
  content?: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
}

export interface RawColumnData {
  id: string;
  task_ids: string[];
}

export interface RawTaskData {
  id: string;
  status: string;
}

export interface RawConnectionData {
  source_board_id: string;
  target_board_id: string;
}

export interface ComputedBoardStats {
  accentColor?: string;
  completedTasks: number;
  connections: number;
  description?: string;
  icon?: string;
  id: string;
  kind: "board" | "textBoard";
  name: string;
  totalTasks: number;
}

// ==========================================
// Synchronous pure computation fallbacks
// ==========================================

export function computeCommentClusters(
  workspaceComments: Comment[],
  clusterRadius = 80
): CommentClusterData[] {
  if (workspaceComments.length === 0) {
    return [];
  }

  const assigned = new Set<string>();
  const clusters: CommentClusterData[] = [];

  const distance = (a: Comment, b: Comment) => Math.hypot(a.x - b.x, a.y - b.y);

  const getNeighbors = (comment: Comment): Comment[] =>
    workspaceComments.filter(
      (c) => c.id !== comment.id && distance(comment, c) <= clusterRadius
    );

  const expandCluster = (seed: Comment): Comment[] => {
    const cluster: Comment[] = [seed];
    const queue = [seed];
    assigned.add(seed.id);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
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

export function searchTasks(
  query: string,
  items: SearchTaskItem[]
): SearchTaskResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }

  const results: SearchTaskResult[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    const desc = (item.description || "").toLowerCase();
    const tags = item.tags || [];

    const titleIndex = title.indexOf(q);
    const descIndex = desc.indexOf(q);
    const tagMatch = tags.some((t) => t.toLowerCase().includes(q));

    if (titleIndex !== -1 || descIndex !== -1 || tagMatch) {
      let score = 0;
      if (title === q) {
        score += 100;
      } else if (titleIndex === 0) {
        score += 50;
      } else if (titleIndex > 0) {
        score += 25;
      }
      if (tagMatch) {
        score += 15;
      }
      if (descIndex !== -1) {
        score += 5;
      }

      results.push({
        boardName: item.boardName,
        columnName: item.columnName,
        taskTitle: item.title,
        taskId: item.id,
        score,
      });
    }
  }

  return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function countTextBoardTasks(content: string | undefined): {
  completedTasks: number;
  totalTasks: number;
} {
  if (!content) {
    return { completedTasks: 0, totalTasks: 0 };
  }
  try {
    const doc = JSON.parse(content) as {
      content?: Array<{
        attrs?: { checked?: boolean };
        content?: unknown;
        type: string;
      }>;
    };
    let totalTasks = 0;
    let completedTasks = 0;

    const walk = (
      nodes:
        | Array<{
            attrs?: { checked?: boolean };
            content?: unknown;
            type: string;
          }>
        | undefined
    ): void => {
      for (const node of nodes ?? []) {
        if (node.type === "taskItem") {
          totalTasks += 1;
          if (node.attrs?.checked === true) {
            completedTasks += 1;
          }
        }
        if (node.content && Array.isArray(node.content)) {
          walk(
            node.content as Array<{
              attrs?: { checked?: boolean };
              content?: unknown;
              type: string;
            }>
          );
        }
      }
    };

    walk(doc.content);
    return { completedTasks, totalTasks };
  } catch {
    return { completedTasks: 0, totalTasks: 0 };
  }
}

export function computeAllBoardStats(
  boardIds: string[],
  textBoardIds: string[],
  boardsById: Record<string, RawBoardData>,
  textBoardsById: Record<string, RawTextBoardData>,
  columnsById: Record<string, RawColumnData>,
  tasksById: Record<string, RawTaskData>,
  connections: RawConnectionData[]
): ComputedBoardStats[] {
  const countConnections = (boardId: string) =>
    connections.filter(
      (c) => c.source_board_id === boardId || c.target_board_id === boardId
    ).length;

  const kanbanStats: ComputedBoardStats[] = [];
  for (const bId of boardIds) {
    const board = boardsById[bId];
    if (!board) {
      continue;
    }

    let totalTasks = 0;
    let completedTasks = 0;

    for (const colId of board.column_ids || []) {
      const col = columnsById[colId];
      if (!col) {
        continue;
      }
      for (const taskId of col.task_ids || []) {
        const task = tasksById[taskId];
        if (task) {
          totalTasks += 1;
          if (task.status === "done") {
            completedTasks += 1;
          }
        }
      }
    }

    kanbanStats.push({
      id: board.id,
      name: board.name,
      description: board.description,
      accentColor: board.accent_color,
      icon: board.icon,
      totalTasks,
      completedTasks,
      connections: countConnections(bId),
      kind: "board",
    });
  }

  const textBoardStats: ComputedBoardStats[] = [];
  for (const tbId of textBoardIds) {
    const textBoard = textBoardsById[tbId];
    if (!textBoard) {
      continue;
    }

    const { totalTasks, completedTasks } = countTextBoardTasks(
      textBoard.content
    );

    textBoardStats.push({
      id: textBoard.id,
      name: textBoard.name,
      description: textBoard.description,
      accentColor: textBoard.accent_color,
      icon: textBoard.icon,
      totalTasks,
      completedTasks,
      connections: countConnections(tbId),
      kind: "textBoard",
    });
  }

  return [...kanbanStats, ...textBoardStats];
}

// ==========================================
// Web Worker Pool with Blob URL (Zero Loader Issues)
// ==========================================

let nextRequestId = 1;

function createBlobWorker(code: string): Worker | null {
  if (
    typeof window === "undefined" ||
    typeof Worker === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return null;
  }
  try {
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  } catch {
    return null;
  }
}

// Cluster Worker
const CLUSTER_WORKER_CODE = `
self.onmessage = function(e) {
  var id = e.data.id;
  var payload = e.data.payload || {};
  var workspaceComments = payload.comments || [];
  var clusterRadius = payload.clusterRadius || 80;

  if (workspaceComments.length === 0) {
    self.postMessage({ id: id, type: "cluster_result", data: [] });
    return;
  }

  var assigned = {};
  var clusters = [];

  function getNeighbors(comment) {
    var list = [];
    for (var i = 0; i < workspaceComments.length; i++) {
      var c = workspaceComments[i];
      if (c.id !== comment.id) {
        var dx = comment.x - c.x;
        var dy = comment.y - c.y;
        if (Math.sqrt(dx * dx + dy * dy) <= clusterRadius) {
          list.push(c);
        }
      }
    }
    return list;
  }

  for (var i = 0; i < workspaceComments.length; i++) {
    var comment = workspaceComments[i];
    if (assigned[comment.id]) continue;

    var cluster = [comment];
    var queue = [comment];
    assigned[comment.id] = true;

    while (queue.length > 0) {
      var current = queue.shift();
      var neighbors = getNeighbors(current);
      for (var j = 0; j < neighbors.length; j++) {
        var neighbor = neighbors[j];
        if (!assigned[neighbor.id]) {
          assigned[neighbor.id] = true;
          cluster.push(neighbor);
          queue.push(neighbor);
        }
      }
    }

    var totalX = 0;
    var totalY = 0;
    for (var k = 0; k < cluster.length; k++) {
      totalX += cluster[k].x;
      totalY += cluster[k].y;
    }

    cluster.sort(function(a, b) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    var oldestCommentId = cluster[0] ? cluster[0].id : "unknown";
    clusters.push({
      id: "cluster-" + oldestCommentId,
      comments: cluster,
      centroid: { x: totalX / cluster.length, y: totalY / cluster.length },
      isSingle: cluster.length === 1
    });
  }

  self.postMessage({ id: id, type: "cluster_result", data: clusters });
};
`;

let clusterWorkerInstance: Worker | null = null;
const clusterPendingRequests = new Map<
  number,
  {
    reject: (err: Error) => void;
    resolve: (data: CommentClusterData[]) => void;
  }
>();

function getClusterWorker(): Worker | null {
  if (!clusterWorkerInstance) {
    clusterWorkerInstance = createBlobWorker(CLUSTER_WORKER_CODE);
    if (clusterWorkerInstance) {
      clusterWorkerInstance.onmessage = (event) => {
        const { id, data, error } = event.data;
        const pending = clusterPendingRequests.get(id);
        if (pending) {
          clusterPendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(data);
          }
        }
      };
      clusterWorkerInstance.onerror = (err) => {
        for (const [id, pending] of clusterPendingRequests.entries()) {
          pending.reject(new Error(err.message || "Cluster worker error"));
          clusterPendingRequests.delete(id);
        }
      };
    }
  }
  return clusterWorkerInstance;
}

export function runClusterWorker(
  comments: Comment[],
  clusterRadius = 80
): Promise<CommentClusterData[]> {
  const worker = getClusterWorker();
  if (!worker) {
    return Promise.resolve(computeCommentClusters(comments, clusterRadius));
  }

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    clusterPendingRequests.set(id, { resolve, reject });
    worker.postMessage({
      id,
      type: "cluster",
      payload: { comments, clusterRadius },
    });
  });
}

// Search Worker
const SEARCH_WORKER_CODE = `
self.onmessage = function(e) {
  var id = e.data.id;
  var payload = e.data.payload || {};
  var q = (payload.query || "").trim().toLowerCase();
  var items = payload.items || [];

  if (q.length === 0) {
    self.postMessage({ id: id, type: "search_tasks_result", data: [] });
    return;
  }

  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var title = (item.title || "").toLowerCase();
    var desc = (item.description || "").toLowerCase();
    var tags = item.tags || [];

    var titleIndex = title.indexOf(q);
    var descIndex = desc.indexOf(q);
    var tagMatch = false;
    for (var t = 0; t < tags.length; t++) {
      if (tags[t].toLowerCase().indexOf(q) !== -1) {
        tagMatch = true;
        break;
      }
    }

    if (titleIndex !== -1 || descIndex !== -1 || tagMatch) {
      var score = 0;
      if (title === q) score += 100;
      else if (titleIndex === 0) score += 50;
      else if (titleIndex > 0) score += 25;
      if (tagMatch) score += 15;
      if (descIndex !== -1) score += 5;

      results.push({
        boardName: item.boardName,
        columnName: item.columnName,
        taskTitle: item.title,
        taskId: item.id,
        score: score
      });
    }
  }

  results.sort(function(a, b) {
    return (b.score || 0) - (a.score || 0);
  });

  self.postMessage({ id: id, type: "search_tasks_result", data: results });
};
`;

let searchWorkerInstance: Worker | null = null;
const searchPendingRequests = new Map<
  number,
  {
    reject: (err: Error) => void;
    resolve: (data: SearchTaskResult[]) => void;
  }
>();

function getSearchWorker(): Worker | null {
  if (!searchWorkerInstance) {
    searchWorkerInstance = createBlobWorker(SEARCH_WORKER_CODE);
    if (searchWorkerInstance) {
      searchWorkerInstance.onmessage = (event) => {
        const { id, data, error } = event.data;
        const pending = searchPendingRequests.get(id);
        if (pending) {
          searchPendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(data);
          }
        }
      };
      searchWorkerInstance.onerror = (err) => {
        for (const [id, pending] of searchPendingRequests.entries()) {
          pending.reject(new Error(err.message || "Search worker error"));
          searchPendingRequests.delete(id);
        }
      };
    }
  }
  return searchWorkerInstance;
}

export function runSearchWorker(
  query: string,
  items: SearchTaskItem[]
): Promise<SearchTaskResult[]> {
  const worker = getSearchWorker();
  if (!worker) {
    return Promise.resolve(searchTasks(query, items));
  }

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    searchPendingRequests.set(id, { resolve, reject });
    worker.postMessage({
      id,
      type: "search_tasks",
      payload: { query, items },
    });
  });
}

// Board Stats Worker
const BOARD_STATS_WORKER_CODE = `
function countTextBoardTasks(content) {
  if (!content) return { completedTasks: 0, totalTasks: 0 };
  try {
    var doc = JSON.parse(content);
    var totalTasks = 0;
    var completedTasks = 0;
    function walk(nodes) {
      if (!nodes) return;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.type === "taskItem") {
          totalTasks++;
          if (node.attrs && node.attrs.checked === true) {
            completedTasks++;
          }
        }
        if (node.content && Array.isArray(node.content)) {
          walk(node.content);
        }
      }
    }
    walk(doc.content);
    return { completedTasks: completedTasks, totalTasks: totalTasks };
  } catch (e) {
    return { completedTasks: 0, totalTasks: 0 };
  }
}

self.onmessage = function(e) {
  var id = e.data.id;
  var payload = e.data.payload || {};
  var boardIds = payload.boardIds || [];
  var textBoardIds = payload.textBoardIds || [];
  var boardsById = payload.boardsById || {};
  var textBoardsById = payload.textBoardsById || {};
  var columnsById = payload.columnsById || {};
  var tasksById = payload.tasksById || {};
  var connections = payload.connections || [];

  function countConnections(bId) {
    var cCount = 0;
    for (var i = 0; i < connections.length; i++) {
      if (connections[i].source_board_id === bId || connections[i].target_board_id === bId) {
        cCount++;
      }
    }
    return cCount;
  }

  var kanbanStats = [];
  for (var b = 0; b < boardIds.length; b++) {
    var bId = boardIds[b];
    var board = boardsById[bId];
    if (!board) continue;

    var totalTasks = 0;
    var completedTasks = 0;
    var colIds = board.column_ids || [];

    for (var c = 0; c < colIds.length; c++) {
      var col = columnsById[colIds[c]];
      if (!col) continue;
      var tIds = col.task_ids || [];
      for (var t = 0; t < tIds.length; t++) {
        var task = tasksById[tIds[t]];
        if (task) {
          totalTasks++;
          if (task.status === "done") {
            completedTasks++;
          }
        }
      }
    }

    kanbanStats.push({
      id: board.id,
      name: board.name,
      description: board.description,
      accentColor: board.accent_color,
      icon: board.icon,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      connections: countConnections(bId),
      kind: "board"
    });
  }

  var textBoardStats = [];
  for (var tb = 0; tb < textBoardIds.length; tb++) {
    var tbId = textBoardIds[tb];
    var textBoard = textBoardsById[tbId];
    if (!textBoard) continue;

    var stats = countTextBoardTasks(textBoard.content);
    textBoardStats.push({
      id: textBoard.id,
      name: textBoard.name,
      description: textBoard.description,
      accentColor: textBoard.accent_color,
      icon: textBoard.icon,
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      connections: countConnections(tbId),
      kind: "textBoard"
    });
  }

  self.postMessage({
    id: id,
    type: "compute_board_stats_result",
    data: kanbanStats.concat(textBoardStats)
  });
};
`;

let boardStatsWorkerInstance: Worker | null = null;
const boardStatsPendingRequests = new Map<
  number,
  {
    reject: (err: Error) => void;
    resolve: (data: ComputedBoardStats[]) => void;
  }
>();

function getBoardStatsWorker(): Worker | null {
  if (!boardStatsWorkerInstance) {
    boardStatsWorkerInstance = createBlobWorker(BOARD_STATS_WORKER_CODE);
    if (boardStatsWorkerInstance) {
      boardStatsWorkerInstance.onmessage = (event) => {
        const { id, data, error } = event.data;
        const pending = boardStatsPendingRequests.get(id);
        if (pending) {
          boardStatsPendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(data);
          }
        }
      };
      boardStatsWorkerInstance.onerror = (err) => {
        for (const [id, pending] of boardStatsPendingRequests.entries()) {
          pending.reject(new Error(err.message || "Board stats worker error"));
          boardStatsPendingRequests.delete(id);
        }
      };
    }
  }
  return boardStatsWorkerInstance;
}

export function runBoardStatsWorker(
  boardIds: string[],
  textBoardIds: string[],
  boardsById: Record<string, RawBoardData>,
  textBoardsById: Record<string, RawTextBoardData>,
  columnsById: Record<string, RawColumnData>,
  tasksById: Record<string, RawTaskData>,
  connections: RawConnectionData[]
): Promise<ComputedBoardStats[]> {
  const worker = getBoardStatsWorker();
  if (!worker) {
    return Promise.resolve(
      computeAllBoardStats(
        boardIds,
        textBoardIds,
        boardsById,
        textBoardsById,
        columnsById,
        tasksById,
        connections
      )
    );
  }

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    boardStatsPendingRequests.set(id, { resolve, reject });
    worker.postMessage({
      id,
      type: "compute_board_stats",
      payload: {
        boardIds,
        textBoardIds,
        boardsById,
        textBoardsById,
        columnsById,
        tasksById,
        connections,
      },
    });
  });
}
