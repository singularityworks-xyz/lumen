import type { Page } from "@playwright/test";
import type {
  Board,
  BoardPosition,
  Column,
  Comment,
  Task,
} from "@/src/features/kanban/types";

export interface NormalizedBoard {
  columnOrder: string[];
  id: string;
  name: string;
  position: BoardPosition;
}

export interface NormalizedColumn {
  boardId: string;
  id: string;
  name: string;
  position: number;
  taskOrder: string[];
}

export interface NormalizedTask {
  columnId: string;
  description: string | null;
  id: string;
  position: number;
  title: string;
}

export interface NormalizedComment {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  updatedAt: string;
}

export interface NormalizedClientSnapshot {
  boards: NormalizedBoard[];
  columns: NormalizedColumn[];
  comments: NormalizedComment[];
  tasks: NormalizedTask[];
  workspaceId: string | null;
}

export interface OrphanDetectionResult {
  duplicateColumnIds: string[];
  duplicateTaskIds: string[];
  orphanedColumns: string[];
  orphanedComments: string[];
  orphanedTasks: string[];
}

export function getStoreState(
  page: Page
): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState?: () => Record<string, unknown>;
      };
    };

    const kanbanStore = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (typeof kanbanStore?.getState === "function") {
      return kanbanStore.getState();
    }

    const storeElement = document.querySelector('[data-testid="kanban-store"]');
    return storeElement
      ? JSON.parse(storeElement.getAttribute("data-state") || "{}")
      : null;
  });
}

interface StoreEntities {
  boardPositions: { byId: Record<string, BoardPosition>; allIds: string[] };
  boards: { byId: Record<string, Board>; allIds: string[] };
  columns: { byId: Record<string, Column>; allIds: string[] };
  comments: { byId: Record<string, Comment>; allIds: string[] };
  currentWorkspaceId: string | null;
  tasks: { byId: Record<string, Task>; allIds: string[] };
}

export function normalizeClientSnapshot(
  storeState: Record<string, unknown>
): NormalizedClientSnapshot {
  const boards: NormalizedBoard[] = [];
  const columns: NormalizedColumn[] = [];
  const tasks: NormalizedTask[] = [];
  const comments: NormalizedComment[] = [];

  const entities = storeState as unknown as StoreEntities;
  const boardEntities = entities.boards;
  const columnEntities = entities.columns;
  const taskEntities = entities.tasks;
  const commentEntities = entities.comments;
  const boardPositionEntities = entities.boardPositions;

  if (boardEntities?.byId && boardPositionEntities?.byId) {
    for (const boardId of boardEntities.allIds || []) {
      const board = boardEntities.byId[boardId];
      const position = boardPositionEntities.byId[boardId];
      if (board && position) {
        boards.push({
          id: board.id,
          name: board.name,
          position: {
            id: position.id,
            x: position.x,
            y: position.y,
            zIndex: position.zIndex,
            width: position.width,
            height: position.height,
          },
          columnOrder: board.column_ids,
        });
      }
    }
  }

  if (columnEntities?.byId) {
    for (const columnId of columnEntities.allIds || []) {
      const column = columnEntities.byId[columnId];
      if (column) {
        columns.push({
          id: column.id,
          boardId: column.board_id,
          name: column.name,
          position: column.position,
          taskOrder: column.task_ids,
        });
      }
    }
  }

  if (taskEntities?.byId) {
    for (const taskId of taskEntities.allIds || []) {
      const task = taskEntities.byId[taskId];
      if (task) {
        tasks.push({
          id: task.id,
          columnId: task.column_id,
          title: task.title,
          description: task.description ?? null,
          position: task.position,
        });
      }
    }
  }

  if (commentEntities?.byId) {
    for (const commentId of commentEntities.allIds || []) {
      const comment = commentEntities.byId[commentId];
      if (comment) {
        comments.push({
          id: comment.id,
          content: comment.content,
          authorId: comment.authorId,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        });
      }
    }
  }

  return {
    boards,
    columns,
    tasks,
    comments,
    workspaceId: entities.currentWorkspaceId ?? null,
  };
}

export function detectOrphans(
  snapshot: NormalizedClientSnapshot
): OrphanDetectionResult {
  const boardIds = new Set(snapshot.boards.map((b) => b.id));
  const columnIds = new Set(snapshot.columns.map((c) => c.id));
  const _taskIds = new Set(snapshot.tasks.map((t) => t.id));
  const _commentIds = new Set(snapshot.comments.map((c) => c.id));

  const orphanedTasks: string[] = [];
  const orphanedColumns: string[] = [];
  const orphanedComments: string[] = [];
  const duplicateTaskIds: string[] = [];
  const duplicateColumnIds: string[] = [];

  const taskCountByColumn = new Map<string, number>();
  for (const task of snapshot.tasks) {
    const count = taskCountByColumn.get(task.columnId) ?? 0;
    taskCountByColumn.set(task.columnId, count + 1);
  }
  for (const [columnId, count] of taskCountByColumn) {
    if (count > 1) {
      const tasksInColumn = snapshot.tasks.filter(
        (t) => t.columnId === columnId
      );
      const seen = new Set<string>();
      for (const task of tasksInColumn) {
        if (seen.has(task.id)) {
          duplicateTaskIds.push(task.id);
        }
        seen.add(task.id);
      }
    }
  }

  const columnCountByBoard = new Map<string, number>();
  for (const column of snapshot.columns) {
    const count = columnCountByBoard.get(column.boardId) ?? 0;
    columnCountByBoard.set(column.boardId, count + 1);
  }
  for (const [boardId, count] of columnCountByBoard) {
    if (count > 1) {
      const colsInBoard = snapshot.columns.filter((c) => c.boardId === boardId);
      const seen = new Set<string>();
      for (const col of colsInBoard) {
        if (seen.has(col.id)) {
          duplicateColumnIds.push(col.id);
        }
        seen.add(col.id);
      }
    }
  }

  for (const task of snapshot.tasks) {
    if (!columnIds.has(task.columnId)) {
      orphanedTasks.push(task.id);
    }
  }

  for (const column of snapshot.columns) {
    if (!boardIds.has(column.boardId)) {
      orphanedColumns.push(column.id);
    }
  }

  return {
    orphanedTasks,
    orphanedColumns,
    orphanedComments,
    duplicateTaskIds: [...new Set(duplicateTaskIds)],
    duplicateColumnIds: [...new Set(duplicateColumnIds)],
  };
}

export function compareBoardCoordinates(
  snapshotA: NormalizedClientSnapshot,
  snapshotB: NormalizedClientSnapshot,
  tolerance = 0
): {
  match: boolean;
  differences: Array<{ boardId: string; a: BoardPosition; b: BoardPosition }>;
} {
  const differences: Array<{
    boardId: string;
    a: BoardPosition;
    b: BoardPosition;
  }> = [];

  const boardsA = new Map(snapshotA.boards.map((b) => [b.id, b]));
  const boardsB = new Map(snapshotB.boards.map((b) => [b.id, b]));

  const allBoardIds = new Set([...boardsA.keys(), ...boardsB.keys()]);

  for (const boardId of allBoardIds) {
    const boardA = boardsA.get(boardId);
    const boardB = boardsB.get(boardId);

    if (boardA === undefined || boardB === undefined) {
      continue;
    }

    const posA = boardA.position;
    const posB = boardB.position;

    const xDiff = Math.abs(posA.x - posB.x);
    const yDiff = Math.abs(posA.y - posB.y);

    if (xDiff > tolerance || yDiff > tolerance) {
      differences.push({ boardId, a: posA, b: posB });
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

export function compareColumnOrder(
  snapshotA: NormalizedClientSnapshot,
  snapshotB: NormalizedClientSnapshot
): {
  match: boolean;
  differences: Array<{ boardId: string; aOrder: string[]; bOrder: string[] }>;
} {
  const differences: Array<{
    boardId: string;
    aOrder: string[];
    bOrder: string[];
  }> = [];

  const boardsA = new Map(snapshotA.boards.map((b) => [b.id, b]));
  const boardsB = new Map(snapshotB.boards.map((b) => [b.id, b]));

  const allBoardIds = new Set([...boardsA.keys(), ...boardsB.keys()]);

  for (const boardId of allBoardIds) {
    const boardA = boardsA.get(boardId);
    const boardB = boardsB.get(boardId);

    if (boardA === undefined || boardB === undefined) {
      continue;
    }

    const orderA = boardA.columnOrder;
    const orderB = boardB.columnOrder;

    if (orderA.length !== orderB.length) {
      differences.push({ boardId, aOrder: orderA, bOrder: orderB });
      continue;
    }

    for (let i = 0; i < orderA.length; i++) {
      if (orderA[i] !== orderB[i]) {
        differences.push({ boardId, aOrder: orderA, bOrder: orderB });
        break;
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

export function compareTaskOrder(
  snapshotA: NormalizedClientSnapshot,
  snapshotB: NormalizedClientSnapshot
): {
  match: boolean;
  differences: Array<{ columnId: string; aOrder: string[]; bOrder: string[] }>;
} {
  const differences: Array<{
    columnId: string;
    aOrder: string[];
    bOrder: string[];
  }> = [];

  const columnsA = new Map(snapshotA.columns.map((c) => [c.id, c]));
  const columnsB = new Map(snapshotB.columns.map((c) => [c.id, c]));

  const allColumnIds = new Set([...columnsA.keys(), ...columnsB.keys()]);

  for (const columnId of allColumnIds) {
    const colA = columnsA.get(columnId);
    const colB = columnsB.get(columnId);

    if (colA === undefined || colB === undefined) {
      continue;
    }

    const orderA = colA.taskOrder;
    const orderB = colB.taskOrder;

    if (orderA.length !== orderB.length) {
      differences.push({ columnId, aOrder: orderA, bOrder: orderB });
      continue;
    }

    for (let i = 0; i < orderA.length; i++) {
      if (orderA[i] !== orderB[i]) {
        differences.push({ columnId, aOrder: orderA, bOrder: orderB });
        break;
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

export function compareCommentOrdering(
  snapshotA: NormalizedClientSnapshot,
  snapshotB: NormalizedClientSnapshot,
  taskId?: string
): {
  match: boolean;
  differences: Array<{ taskId: string; aOrder: string[]; bOrder: string[] }>;
} {
  const differences: Array<{
    taskId: string;
    aOrder: string[];
    bOrder: string[];
  }> = [];

  interface CommentWithTask {
    createdAt: string;
    id: string;
    taskId: string;
    updatedAt: string;
  }

  const getCommentsForTask = (
    snapshot: NormalizedClientSnapshot,
    targetTaskId: string
  ): CommentWithTask[] =>
    snapshot.comments
      .filter((c) => {
        const task = snapshot.tasks.find((t) => t.title === c.content);
        return task?.id === targetTaskId;
      })
      .map((c) => ({
        id: c.id,
        taskId: targetTaskId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

  const getAllTaskIds = (snapshot: NormalizedClientSnapshot): string[] => {
    const taskIds = new Set<string>();
    for (const col of snapshot.columns) {
      for (const taskId of col.taskOrder) {
        taskIds.add(taskId);
      }
    }
    return [...taskIds];
  };

  const taskIdsA = taskId ? [taskId] : getAllTaskIds(snapshotA);
  const taskIdsB = taskId ? [taskId] : getAllTaskIds(snapshotB);

  const allTaskIds = new Set([...taskIdsA, ...taskIdsB]);

  for (const tid of allTaskIds) {
    const commentsA = getCommentsForTask(snapshotA, tid);
    const commentsB = getCommentsForTask(snapshotB, tid);

    const orderA = commentsA.map((c) => c.id);
    const orderB = commentsB.map((c) => c.id);

    if (orderA.length !== orderB.length) {
      differences.push({ taskId: tid, aOrder: orderA, bOrder: orderB });
      continue;
    }

    for (let i = 0; i < orderA.length; i++) {
      if (orderA[i] !== orderB[i]) {
        differences.push({ taskId: tid, aOrder: orderA, bOrder: orderB });
        break;
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

export async function captureNormalizedSnapshot(
  page: Page
): Promise<NormalizedClientSnapshot> {
  const storeState = await getStoreState(page);
  if (!storeState) {
    return {
      boards: [],
      columns: [],
      tasks: [],
      comments: [],
      workspaceId: null,
    };
  }
  return normalizeClientSnapshot(storeState as Record<string, unknown>);
}

export function assertNoOrphans(snapshot: NormalizedClientSnapshot): void {
  const orphans = detectOrphans(snapshot);
  const hasIssues =
    orphans.orphanedTasks.length > 0 ||
    orphans.orphanedColumns.length > 0 ||
    orphans.orphanedComments.length > 0 ||
    orphans.duplicateTaskIds.length > 0 ||
    orphans.duplicateColumnIds.length > 0;

  if (hasIssues) {
    const errors: string[] = [];
    if (orphans.orphanedTasks.length > 0) {
      errors.push(`Orphaned tasks: ${orphans.orphanedTasks.join(", ")}`);
    }
    if (orphans.orphanedColumns.length > 0) {
      errors.push(`Orphaned columns: ${orphans.orphanedColumns.join(", ")}`);
    }
    if (orphans.orphanedComments.length > 0) {
      errors.push(`Orphaned comments: ${orphans.orphanedComments.join(", ")}`);
    }
    if (orphans.duplicateTaskIds.length > 0) {
      errors.push(`Duplicate task IDs: ${orphans.duplicateTaskIds.join(", ")}`);
    }
    if (orphans.duplicateColumnIds.length > 0) {
      errors.push(
        `Duplicate column IDs: ${orphans.duplicateColumnIds.join(", ")}`
      );
    }
    throw new Error(`Orphan/duplicate detection failed: ${errors.join("; ")}`);
  }
}
