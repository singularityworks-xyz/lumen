import type { Page } from "@playwright/test";

export interface ServerBoard {
  accentColor?: string;
  column_ids: string[];
  created_at: string;
  created_by: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  workspace_id: string;
}

export interface ServerColumn {
  accentColor?: string;
  board_id: string;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  position: number;
  progressValue?: number;
  task_ids: string[];
}

export interface ServerTask {
  assigned_to?: string;
  board_id: string;
  checklists?: Array<{
    id: string;
    task_id: string;
    title: string;
    completed: boolean;
    position: number;
  }>;
  column_id: string;
  created_at: string;
  created_by: string;
  description?: string;
  due_date?: string;
  id: string;
  position: number;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "todo" | "done" | "trash";
  tags?: string[];
  title: string;
  updated_at: string;
}

export interface ServerBoardPosition {
  height?: number;
  id: string;
  lastUserHeight?: number;
  lastUserWidth?: number;
  userResized?: boolean;
  width?: number;
  x: number;
  y: number;
  zIndex: number;
}

export interface ServerComment {
  authorId: string;
  authorImage?: string;
  authorName?: string;
  content: string;
  createdAt: string;
  id: string;
  lastEditedById?: string;
  lastEditorImage?: string;
  lastEditorName?: string;
  parentId?: string;
  replyCount?: number;
  updatedAt: string;
  workspaceId: string;
  x: number;
  y: number;
}

export interface ServerWorkspace {
  board_ids: string[];
  colorUsage?: Record<string, number>;
  created_at: string;
  customColors?: string[];
  description?: string;
  iconUsage?: Record<string, number>;
  id: string;
  lastFocusedBoardId?: string | null;
  lastViewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  name: string;
  showMiniMap?: boolean;
}

export interface ServerStateResponse {
  boardPositions: Record<string, ServerBoardPosition>;
  boards: Record<string, ServerBoard>;
  columns: Record<string, ServerColumn>;
  tasks: Record<string, ServerTask>;
  workspace: Record<string, ServerWorkspace>;
}

export interface NormalizedServerSnapshot {
  boardPositions: NormalizedServerBoardPosition[];
  boards: NormalizedServerBoard[];
  columns: NormalizedServerColumn[];
  comments: NormalizedServerComment[];
  tasks: NormalizedServerTask[];
  workspaceId: string | null;
}

export interface NormalizedServerBoard {
  columnOrder: string[];
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    zIndex: number;
  };
}

export interface NormalizedServerColumn {
  boardId: string;
  id: string;
  name: string;
  position: number;
  taskOrder: string[];
}

export interface NormalizedServerTask {
  columnId: string;
  description: string | null;
  id: string;
  position: number;
  title: string;
}

export interface NormalizedServerBoardPosition {
  height?: number;
  id: string;
  width?: number;
  x: number;
  y: number;
  zIndex: number;
}

export interface NormalizedServerComment {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  updatedAt: string;
}

export function fetchServerState(
  page: Page,
  workspaceId: string
): Promise<ServerStateResponse> {
  return page.evaluate(async (wsId) => {
    const response = await fetch(`/api/workspaces/${wsId}/state`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch server state: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }, workspaceId);
}

export function normalizeServerState(
  serverState: ServerStateResponse
): NormalizedServerSnapshot {
  const boards: NormalizedServerBoard[] = [];
  const columns: NormalizedServerColumn[] = [];
  const tasks: NormalizedServerTask[] = [];
  const comments: NormalizedServerComment[] = [];

  const boardsMap = serverState.boards;
  const columnsMap = serverState.columns;
  const tasksMap = serverState.tasks;
  const boardPositionsMap = serverState.boardPositions;

  const workspaceIds = Object.keys(serverState.workspace);
  const workspaceId = workspaceIds[0] ?? null;

  for (const boardId of Object.keys(boardsMap)) {
    const board = boardsMap[boardId];
    const position = boardPositionsMap[boardId];
    if (board && position) {
      boards.push({
        id: board.id,
        name: board.name,
        columnOrder: board.column_ids,
        position: {
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          zIndex: position.zIndex,
        },
      });
    } else if (board) {
      boards.push({
        id: board.id,
        name: board.name,
        columnOrder: board.column_ids,
        position: { x: 0, y: 0, zIndex: 0 },
      });
    }
  }

  for (const columnId of Object.keys(columnsMap)) {
    const column = columnsMap[columnId];
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

  for (const taskId of Object.keys(tasksMap)) {
    const task = tasksMap[taskId];
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

  return {
    boards,
    columns,
    tasks,
    boardPositions: Object.values(boardPositionsMap),
    comments,
    workspaceId,
  };
}

export async function fetchAndNormalizeServerState(
  page: Page,
  workspaceId: string
): Promise<NormalizedServerSnapshot> {
  const serverState = await fetchServerState(page, workspaceId);
  return normalizeServerState(serverState);
}
