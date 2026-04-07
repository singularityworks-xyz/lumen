import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "../index";
import {
  applyStateToDoc,
  buildEmptyDoc,
  buildSeededDoc,
  createTestArea,
  createTestBoard,
  createTestBoardConnection,
  createTestBoardPosition,
  createTestColumn,
  createTestComment,
  createTestTask,
  encodeDocState,
  getStateVector,
} from "./ydoc-fixtures";

describe("createTestTask", () => {
  it("returns correct defaults", () => {
    const task = createTestTask();
    expect(task.id).toBe("task-fixture-1");
    expect(task.board_id).toBe("board-fixture-1");
    expect(task.column_id).toBe("col-fixture-1");
    expect(task.title).toBe("Fixture Task");
    expect(task.priority).toBe("medium");
    expect(task.progress).toBe(0);
    expect(task.position).toBe(0);
    expect(task.status).toBe("todo");
    expect(task.created_by).toBe("test-user");
    expect(task.created_at).toBe("2023-11-15T00:00:00.000Z");
    expect(task.updated_at).toBe("2023-11-15T00:00:00.000Z");
  });

  it("respects overrides", () => {
    const task = createTestTask({
      id: "custom-id",
      title: "Custom Title",
      priority: "high",
      progress: 50,
    });
    expect(task.id).toBe("custom-id");
    expect(task.title).toBe("Custom Title");
    expect(task.priority).toBe("high");
    expect(task.progress).toBe(50);
    // Unchanged defaults
    expect(task.board_id).toBe("board-fixture-1");
    expect(task.status).toBe("todo");
  });
});

describe("createTestColumn", () => {
  it("returns correct defaults", () => {
    const col = createTestColumn();
    expect(col.id).toBe("col-fixture-1");
    expect(col.board_id).toBe("board-fixture-1");
    expect(col.name).toBe("To Do");
    expect(col.position).toBe(0);
    expect(col.task_ids).toEqual([]);
  });

  it("respects overrides", () => {
    const col = createTestColumn({
      id: "custom-col",
      name: "In Progress",
      task_ids: ["t1", "t2"],
    });
    expect(col.id).toBe("custom-col");
    expect(col.name).toBe("In Progress");
    expect(col.task_ids).toEqual(["t1", "t2"]);
    expect(col.board_id).toBe("board-fixture-1");
  });
});

describe("createTestBoard", () => {
  it("returns correct defaults", () => {
    const board = createTestBoard();
    expect(board.id).toBe("board-fixture-1");
    expect(board.name).toBe("Fixture Board");
    expect(board.workspace_id).toBe("ws-fixture-1");
    expect(board.column_ids).toEqual(["col-fixture-1", "col-fixture-2"]);
    expect(board.created_by).toBe("test-user");
    expect(board.created_at).toBe("2023-11-15T00:00:00.000Z");
  });

  it("respects overrides", () => {
    const board = createTestBoard({
      id: "custom-board",
      name: "My Board",
      workspace_id: "ws-custom",
    });
    expect(board.id).toBe("custom-board");
    expect(board.name).toBe("My Board");
    expect(board.workspace_id).toBe("ws-custom");
  });
});

describe("createTestBoardPosition", () => {
  it("returns correct defaults", () => {
    const pos = createTestBoardPosition();
    expect(pos.id).toBe("board-fixture-1");
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.zIndex).toBe(1);
    expect(pos.width).toBe(600);
    expect(pos.height).toBe(400);
  });

  it("respects overrides", () => {
    const pos = createTestBoardPosition({
      id: "custom-pos",
      x: 100,
      y: 200,
      zIndex: 5,
    });
    expect(pos.id).toBe("custom-pos");
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
    expect(pos.zIndex).toBe(5);
    expect(pos.width).toBe(600);
  });
});

describe("createTestBoardConnection", () => {
  it("returns correct defaults", () => {
    const conn = createTestBoardConnection();
    expect(conn.id).toBe("conn-fixture-1");
    expect(conn.source_board_id).toBe("board-fixture-1");
    expect(conn.target_board_id).toBe("board-fixture-2");
    expect(conn.sourceHandle).toBe("right");
    expect(conn.targetHandle).toBe("left");
    expect(conn.lineStyle).toBe("solid");
    expect(conn.showArrow).toBe(true);
    expect(conn.created_at).toBe("2023-11-15T00:00:00.000Z");
  });

  it("respects overrides", () => {
    const conn = createTestBoardConnection({
      id: "custom-conn",
      lineStyle: "dotted",
      showArrow: false,
      sourceHandle: "bottom",
    });
    expect(conn.id).toBe("custom-conn");
    expect(conn.lineStyle).toBe("dotted");
    expect(conn.showArrow).toBe(false);
    expect(conn.sourceHandle).toBe("bottom");
    expect(conn.targetHandle).toBe("left");
  });
});

describe("createTestArea", () => {
  it("returns correct defaults", () => {
    const area = createTestArea();
    expect(area.id).toBe("area-fixture-1");
    expect(area.name).toBe("Fixture Area");
    expect(area.workspace_id).toBe("ws-fixture-1");
    expect(area.board_ids).toEqual(["board-fixture-1"]);
    expect(area.color).toBe("#3b82f6");
    expect(area.created_at).toBe("2023-11-15T00:00:00.000Z");
  });

  it("respects overrides", () => {
    const area = createTestArea({
      id: "custom-area",
      name: "Custom Area",
      color: "#ff0000",
    });
    expect(area.id).toBe("custom-area");
    expect(area.name).toBe("Custom Area");
    expect(area.color).toBe("#ff0000");
    expect(area.workspace_id).toBe("ws-fixture-1");
  });
});

describe("createTestComment", () => {
  it("returns correct defaults", () => {
    const comment = createTestComment();
    expect(comment.id).toBe("comment-fixture-1");
    expect(comment.content).toBe("Fixture comment");
    expect(comment.authorId).toBe("test-user");
    expect(comment.workspaceId).toBe("ws-fixture-1");
    expect(comment.x).toBe(0);
    expect(comment.y).toBe(0);
    expect(comment.createdAt).toBe("2023-11-15T00:00:00.000Z");
    expect(comment.updatedAt).toBe("2023-11-15T00:00:00.000Z");
  });

  it("respects overrides", () => {
    const comment = createTestComment({
      id: "custom-comment",
      content: "Custom content",
      authorId: "user-2",
    });
    expect(comment.id).toBe("custom-comment");
    expect(comment.content).toBe("Custom content");
    expect(comment.authorId).toBe("user-2");
    expect(comment.workspaceId).toBe("ws-fixture-1");
  });
});

describe("buildSeededDoc", () => {
  it("creates doc with expected maps populated", () => {
    const doc = buildSeededDoc();

    const boards = doc.getMap(YJS_MAP_NAMES.BOARDS);
    const columns = doc.getMap(YJS_MAP_NAMES.COLUMNS);
    const tasks = doc.getMap(YJS_MAP_NAMES.TASKS);
    const positions = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
    const connections = doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS);
    const areas = doc.getMap(YJS_MAP_NAMES.AREAS);
    const comments = doc.getMap(YJS_MAP_NAMES.COMMENTS);
    const workspace = doc.getMap(YJS_MAP_NAMES.WORKSPACE);

    expect(workspace.size).toBe(1);
    expect(workspace.has("ws-fixture-1")).toBe(true);

    expect(boards.size).toBe(2);
    expect(boards.has("board-fixture-1")).toBe(true);
    expect(boards.has("board-fixture-2")).toBe(true);

    expect(columns.size).toBe(3);
    expect(columns.has("col-fixture-1")).toBe(true);
    expect(columns.has("col-fixture-2")).toBe(true);
    expect(columns.has("col-fixture-3")).toBe(true);

    expect(tasks.size).toBe(3);
    expect(tasks.has("task-fixture-1")).toBe(true);
    expect(tasks.has("task-fixture-2")).toBe(true);
    expect(tasks.has("task-fixture-3")).toBe(true);

    expect(positions.size).toBe(2);
    expect(positions.has("board-fixture-1")).toBe(true);
    expect(positions.has("board-fixture-2")).toBe(true);

    expect(connections.size).toBe(1);
    expect(connections.has("conn-fixture-1")).toBe(true);

    expect(areas.size).toBe(1);
    expect(areas.has("area-fixture-1")).toBe(true);

    expect(comments.size).toBe(1);
    expect(comments.has("comment-fixture-1")).toBe(true);
  });

  it("accepts custom workspace id", () => {
    const doc = buildSeededDoc("custom-ws");
    const workspace = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
    expect(workspace.has("custom-ws")).toBe(true);
  });
});

describe("buildEmptyDoc", () => {
  it("creates doc with all maps empty", () => {
    const doc = buildEmptyDoc();

    const mapNames = Object.values(YJS_MAP_NAMES);
    for (const name of mapNames) {
      const map = doc.getMap(name);
      expect(map.size).toBe(0);
    }
  });
});

describe("encodeDocState", () => {
  it("returns Uint8Array", () => {
    const doc = new Y.Doc();
    const state = encodeDocState(doc);
    expect(state).toBeInstanceOf(Uint8Array);
    expect(state.length).toBeGreaterThan(0);
  });
});

describe("getStateVector", () => {
  it("returns Uint8Array", () => {
    const doc = new Y.Doc();
    const sv = getStateVector(doc);
    expect(sv).toBeInstanceOf(Uint8Array);
    expect(sv.length).toBeGreaterThan(0);
  });
});

describe("applyStateToDoc", () => {
  it("correctly applies state", () => {
    const sourceDoc = buildSeededDoc();
    const state = encodeDocState(sourceDoc);

    const targetDoc = buildEmptyDoc();
    applyStateToDoc(targetDoc, state);

    const sourceBoards = sourceDoc.getMap(YJS_MAP_NAMES.BOARDS);
    const targetBoards = targetDoc.getMap(YJS_MAP_NAMES.BOARDS);
    expect(targetBoards.size).toBe(sourceBoards.size);

    const sourceWorkspace = sourceDoc.getMap(YJS_MAP_NAMES.WORKSPACE);
    const targetWorkspace = targetDoc.getMap(YJS_MAP_NAMES.WORKSPACE);
    expect(targetWorkspace.size).toBe(sourceWorkspace.size);

    const sourceTasks = sourceDoc.getMap(YJS_MAP_NAMES.TASKS);
    const targetTasks = targetDoc.getMap(YJS_MAP_NAMES.TASKS);
    expect(targetTasks.size).toBe(sourceTasks.size);
  });
});
