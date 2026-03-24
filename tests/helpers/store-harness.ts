import type {
  KanbanState,
  KanbanStore,
} from "../../apps/web/src/features/kanban/store/types";
import { createInitialState } from "../../apps/web/src/features/kanban/store/utils";
import type {
  Board,
  BoardPosition,
  Column,
  Task,
} from "../../apps/web/src/features/kanban/types";

type StoreSet = (fn: (state: KanbanStore) => void) => void;
type StoreGet = () => KanbanStore;

export function createFreshState(): KanbanState {
  return createInitialState();
}

export function createSliceHarness<T>(
  sliceCreator: (set: StoreSet, get: StoreGet) => T
): { state: KanbanStore; actions: T } {
  const state = createInitialState() as KanbanStore;

  const set: StoreSet = (fn) => {
    fn(state);
  };

  const get: StoreGet = () => state;

  const actions = sliceCreator(set, get);

  return { state, actions };
}

export function addBoardToState(
  state: KanbanState,
  opts: {
    boardId?: string;
    name?: string;
    workspaceId?: string;
    columnIds?: string[];
    x?: number;
    y?: number;
  } = {}
): { boardId: string; columnIds: string[] } {
  const boardId = opts.boardId ?? `board-${state.boards.allIds.length + 1}`;
  const workspaceId = opts.workspaceId ?? state.currentWorkspaceId ?? "";
  const columnIds = opts.columnIds ?? [
    `col-${boardId}-1`,
    `col-${boardId}-2`,
    `col-${boardId}-3`,
  ];

  const board: Board = {
    id: boardId,
    name: opts.name ?? "Test Board",
    workspace_id: workspaceId,
    created_by: "test-user",
    created_at: new Date().toISOString(),
    column_ids: columnIds,
  };

  state.boards.byId[boardId] = board;
  state.boards.allIds.push(boardId);

  for (const [i, colId] of columnIds.entries()) {
    const column: Column = {
      id: colId,
      board_id: boardId,
      name: `Column ${i + 1}`,
      position: i,
      task_ids: [],
    };
    state.columns.byId[colId] = column;
    state.columns.allIds.push(colId);
  }

  const position: BoardPosition = {
    id: boardId,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    zIndex: state.boardPositions.allIds.length + 1,
    width: 600,
    height: 400,
  };
  state.boardPositions.byId[boardId] = position;
  state.boardPositions.allIds.push(boardId);

  const workspace = state.workspaces.byId[workspaceId];
  if (workspace) {
    workspace.board_ids.push(boardId);
  }

  return { boardId, columnIds };
}

export function addTaskToState(
  state: KanbanState,
  opts: {
    taskId?: string;
    columnId: string;
    boardId: string;
    title?: string;
    priority?: Task["priority"];
    progress?: number;
    position?: number;
  }
): string {
  const taskId = opts.taskId ?? `task-${state.tasks.allIds.length + 1}`;

  const task: Task = {
    id: taskId,
    title: opts.title ?? "Test Task",
    board_id: opts.boardId,
    column_id: opts.columnId,
    created_by: "test-user",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    position: opts.position ?? 0,
    priority: opts.priority ?? "medium",
    progress: opts.progress ?? 0,
    status: "todo",
  };

  state.tasks.byId[taskId] = task;
  state.tasks.allIds.push(taskId);

  const column = state.columns.byId[opts.columnId];
  if (column) {
    column.task_ids.push(taskId);
  }

  return taskId;
}

let singletonState: KanbanState | null = null;

export function getSingletonState(): KanbanState {
  if (!singletonState) {
    singletonState = createInitialState();
  }
  return singletonState;
}

export function resetSingletonState(): void {
  singletonState = null;
}
