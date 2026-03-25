import type {
  Area,
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Comment,
  Task,
} from "../../../apps/web/src/features/kanban/types";

let boardCounter = 0;
let columnCounter = 0;
let taskCounter = 0;
let positionCounter = 0;
let connectionCounter = 0;
let areaCounter = 0;
let commentCounter = 0;

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

export function resetFactoryCounters() {
  boardCounter = 0;
  columnCounter = 0;
  taskCounter = 0;
  positionCounter = 0;
  connectionCounter = 0;
  areaCounter = 0;
  commentCounter = 0;
}

export function createTestBoard(overrides?: Partial<Board>): Board {
  boardCounter++;
  const id = overrides?.id ?? `board-${boardCounter}`;
  return {
    id,
    name: `Test Board ${boardCounter}`,
    workspace_id: "ws-1",
    column_ids: [`${id}-col-1`, `${id}-col-2`, `${id}-col-3`],
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestColumn(overrides?: Partial<Column>): Column {
  columnCounter++;
  return {
    id: `col-${columnCounter}`,
    board_id: "board-1",
    name: `Column ${columnCounter}`,
    position: columnCounter,
    task_ids: [],
    ...overrides,
  };
}

export function createTestTask(overrides?: Partial<Task>): Task {
  taskCounter++;
  return {
    id: `task-${taskCounter}`,
    title: `Test Task ${taskCounter}`,
    board_id: "board-1",
    column_id: "col-1",
    position: taskCounter,
    priority: "medium",
    progress: 0,
    status: "todo",
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
    updated_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestBoardPosition(
  overrides?: Partial<BoardPosition>
): BoardPosition {
  positionCounter++;
  return {
    id: `board-${positionCounter}`,
    x: 0,
    y: 0,
    zIndex: positionCounter,
    width: 600,
    height: 400,
    ...overrides,
  };
}

export function createTestBoardConnection(
  overrides?: Partial<BoardConnection>
): BoardConnection {
  connectionCounter++;
  return {
    id: `conn-${connectionCounter}`,
    source_board_id: "board-1",
    target_board_id: "board-2",
    sourceHandle: "right",
    targetHandle: "left",
    lineStyle: "solid",
    showArrow: true,
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestArea(overrides?: Partial<Area>): Area {
  areaCounter++;
  return {
    id: `area-${areaCounter}`,
    name: `Test Area ${areaCounter}`,
    workspace_id: "ws-1",
    board_ids: [],
    color: "#3b82f6",
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestComment(overrides?: Partial<Comment>): Comment {
  commentCounter++;
  return {
    id: `comment-${commentCounter}`,
    content: `Test comment ${commentCounter}`,
    authorId: "test-user",
    authorName: "Test User",
    workspaceId: "ws-1",
    x: 0,
    y: 0,
    createdAt: FROZEN_TIMESTAMP,
    updatedAt: FROZEN_TIMESTAMP,
    ...overrides,
  };
}
