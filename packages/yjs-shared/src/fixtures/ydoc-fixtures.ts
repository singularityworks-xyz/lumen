/** biome-ignore-all lint/performance/noNamespaceImport: yjs requires namespace import */

import * as Y from "yjs";
import { YJS_MAP_NAMES } from "../index";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

interface TaskFixture {
  board_id: string;
  column_id: string;
  created_at: string;
  created_by: string;
  id: string;
  position: number;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "todo" | "done" | "trash";
  title: string;
  updated_at: string;
}

interface ColumnFixture {
  board_id: string;
  id: string;
  name: string;
  position: number;
  task_ids: string[];
}

interface BoardFixture {
  column_ids: string[];
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  workspace_id: string;
}

interface BoardPositionFixture {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}

interface BoardConnectionFixture {
  created_at: string;
  id: string;
  lineStyle: "solid" | "dotted";
  showArrow: boolean;
  source_board_id: string;
  sourceHandle: "top" | "right" | "bottom" | "left";
  target_board_id: string;
  targetHandle: "top" | "right" | "bottom" | "left";
}

interface AreaFixture {
  board_ids: string[];
  color: string;
  created_at: string;
  id: string;
  name: string;
  workspace_id: string;
}

interface CommentFixture {
  authorId: string;
  content: string;
  createdAt: string;
  id: string;
  updatedAt: string;
  workspaceId: string;
  x: number;
  y: number;
}

export function createTestTask(overrides?: Partial<TaskFixture>): TaskFixture {
  return {
    id: "task-fixture-1",
    board_id: "board-fixture-1",
    column_id: "col-fixture-1",
    title: "Fixture Task",
    priority: "medium",
    progress: 0,
    position: 0,
    status: "todo",
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
    updated_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestColumn(
  overrides?: Partial<ColumnFixture>
): ColumnFixture {
  return {
    id: "col-fixture-1",
    board_id: "board-fixture-1",
    name: "To Do",
    position: 0,
    task_ids: [],
    ...overrides,
  };
}

export function createTestBoard(
  overrides?: Partial<BoardFixture>
): BoardFixture {
  return {
    id: "board-fixture-1",
    name: "Fixture Board",
    workspace_id: "ws-fixture-1",
    column_ids: ["col-fixture-1", "col-fixture-2"],
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestBoardPosition(
  overrides?: Partial<BoardPositionFixture>
): BoardPositionFixture {
  return {
    id: "board-fixture-1",
    x: 0,
    y: 0,
    zIndex: 1,
    width: 600,
    height: 400,
    ...overrides,
  };
}

export function createTestBoardConnection(
  overrides?: Partial<BoardConnectionFixture>
): BoardConnectionFixture {
  return {
    id: "conn-fixture-1",
    source_board_id: "board-fixture-1",
    target_board_id: "board-fixture-2",
    sourceHandle: "right",
    targetHandle: "left",
    lineStyle: "solid",
    showArrow: true,
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestArea(overrides?: Partial<AreaFixture>): AreaFixture {
  return {
    id: "area-fixture-1",
    name: "Fixture Area",
    workspace_id: "ws-fixture-1",
    board_ids: ["board-fixture-1"],
    color: "#3b82f6",
    created_at: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function createTestComment(
  overrides?: Partial<CommentFixture>
): CommentFixture {
  return {
    id: "comment-fixture-1",
    content: "Fixture comment",
    authorId: "test-user",
    workspaceId: "ws-fixture-1",
    x: 0,
    y: 0,
    createdAt: FROZEN_TIMESTAMP,
    updatedAt: FROZEN_TIMESTAMP,
    ...overrides,
  };
}

export function buildSeededDoc(workspaceId = "ws-fixture-1"): Y.Doc {
  const doc = new Y.Doc();

  const boardsMap = doc.getMap(YJS_MAP_NAMES.BOARDS);
  const columnsMap = doc.getMap(YJS_MAP_NAMES.COLUMNS);
  const tasksMap = doc.getMap(YJS_MAP_NAMES.TASKS);
  const boardPositionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
  const boardConnectionsMap = doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS);
  const areasMap = doc.getMap(YJS_MAP_NAMES.AREAS);
  const commentsMap = doc.getMap(YJS_MAP_NAMES.COMMENTS);
  const workspaceMap = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

  workspaceMap.set(workspaceId, {
    id: workspaceId,
    name: "Fixture Workspace",
    created_at: FROZEN_TIMESTAMP,
    board_ids: ["board-fixture-1", "board-fixture-2"],
  });

  boardsMap.set("board-fixture-1", createTestBoard());
  boardsMap.set(
    "board-fixture-2",
    createTestBoard({
      id: "board-fixture-2",
      name: "Fixture Board 2",
      column_ids: ["col-fixture-3"],
    })
  );

  columnsMap.set(
    "col-fixture-1",
    createTestColumn({ task_ids: ["task-fixture-1", "task-fixture-2"] })
  );
  columnsMap.set(
    "col-fixture-2",
    createTestColumn({
      id: "col-fixture-2",
      name: "In Progress",
      position: 1,
      task_ids: ["task-fixture-3"],
    })
  );
  columnsMap.set(
    "col-fixture-3",
    createTestColumn({
      id: "col-fixture-3",
      board_id: "board-fixture-2",
      name: "Backlog",
      position: 0,
    })
  );

  tasksMap.set("task-fixture-1", createTestTask());
  tasksMap.set(
    "task-fixture-2",
    createTestTask({
      id: "task-fixture-2",
      title: "Second Fixture Task",
      position: 1,
      priority: "high",
    })
  );
  tasksMap.set(
    "task-fixture-3",
    createTestTask({
      id: "task-fixture-3",
      column_id: "col-fixture-2",
      title: "Third Fixture Task",
      progress: 50,
    })
  );

  boardPositionsMap.set("board-fixture-1", createTestBoardPosition());
  boardPositionsMap.set(
    "board-fixture-2",
    createTestBoardPosition({
      id: "board-fixture-2",
      x: 700,
      zIndex: 2,
    })
  );

  boardConnectionsMap.set("conn-fixture-1", createTestBoardConnection());

  areasMap.set("area-fixture-1", createTestArea());

  commentsMap.set("comment-fixture-1", createTestComment());

  return doc;
}

export function buildEmptyDoc(): Y.Doc {
  const doc = new Y.Doc();

  for (const mapName of Object.values(YJS_MAP_NAMES)) {
    doc.getMap(mapName);
  }

  return doc;
}

export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function getStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

export function applyStateToDoc(doc: Y.Doc, state: Uint8Array): void {
  Y.applyUpdate(doc, state);
}
