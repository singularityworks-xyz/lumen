import { afterEach, describe, expect, it } from "bun:test";
import {
  createTestArea,
  createTestBoard,
  createTestBoardConnection,
  createTestBoardPosition,
  createTestColumn,
  createTestComment,
  createTestTask,
  resetFactoryCounters,
} from "./factories";

afterEach(() => {
  resetFactoryCounters();
});

describe("resetFactoryCounters", () => {
  it("resets IDs back to starting values", () => {
    createTestBoard();
    createTestColumn();
    createTestTask();

    resetFactoryCounters();

    const board = createTestBoard();
    const column = createTestColumn();
    const task = createTestTask();

    expect(board.id).toBe("board-1");
    expect(column.id).toBe("col-1");
    expect(task.id).toBe("task-1");
  });
});

describe("createTestBoard", () => {
  it("creates a board with defaults", () => {
    const board = createTestBoard();

    expect(board.id).toBe("board-1");
    expect(board.name).toBe("Test Board 1");
    expect(board.workspace_id).toBe("ws-1");
    expect(board.column_ids).toHaveLength(3);
    expect(board.created_by).toBe("test-user");
    expect(board.created_at).toBeDefined();
  });

  it("auto-increments board IDs", () => {
    const b1 = createTestBoard();
    const b2 = createTestBoard();
    const b3 = createTestBoard();

    expect(b1.id).toBe("board-1");
    expect(b2.id).toBe("board-2");
    expect(b3.id).toBe("board-3");
  });

  it("accepts overrides", () => {
    const board = createTestBoard({
      id: "custom-board",
      name: "My Custom Board",
      workspace_id: "ws-custom",
    });

    expect(board.id).toBe("custom-board");
    expect(board.name).toBe("My Custom Board");
    expect(board.workspace_id).toBe("ws-custom");
  });

  it("uses default name when id is overridden but name is not", () => {
    const board = createTestBoard({ id: "special" });
    expect(board.name).toBe("Test Board 1");
  });
});

describe("createTestColumn", () => {
  it("creates a column with defaults", () => {
    const col = createTestColumn();

    expect(col.id).toBe("col-1");
    expect(col.board_id).toBe("board-1");
    expect(col.name).toBe("Column 1");
    expect(col.position).toBe(1);
    expect(col.task_ids).toEqual([]);
  });

  it("auto-increments column IDs and positions", () => {
    const c1 = createTestColumn();
    const c2 = createTestColumn();

    expect(c1.id).toBe("col-1");
    expect(c2.id).toBe("col-2");
    expect(c2.position).toBe(2);
  });

  it("accepts overrides", () => {
    const col = createTestColumn({
      id: "custom-col",
      board_id: "board-5",
      name: "Done",
      position: 3,
      task_ids: ["task-1", "task-2"],
    });

    expect(col.id).toBe("custom-col");
    expect(col.board_id).toBe("board-5");
    expect(col.name).toBe("Done");
    expect(col.position).toBe(3);
    expect(col.task_ids).toEqual(["task-1", "task-2"]);
  });
});

describe("createTestTask", () => {
  it("creates a task with defaults", () => {
    const task = createTestTask();

    expect(task.id).toBe("task-1");
    expect(task.title).toBe("Test Task 1");
    expect(task.board_id).toBe("board-1");
    expect(task.column_id).toBe("col-1");
    expect(task.priority).toBe("medium");
    expect(task.progress).toBe(0);
    expect(task.status).toBe("todo");
    expect(task.created_by).toBe("test-user");
  });

  it("auto-increments task IDs", () => {
    const t1 = createTestTask();
    const t2 = createTestTask();

    expect(t1.id).toBe("task-1");
    expect(t2.id).toBe("task-2");
  });

  it("accepts overrides", () => {
    const task = createTestTask({
      title: "Deploy to production",
      priority: "high",
      progress: 75,
      status: "done",
    });

    expect(task.title).toBe("Deploy to production");
    expect(task.priority).toBe("high");
    expect(task.progress).toBe(75);
    expect(task.status).toBe("done");
  });
});

describe("createTestBoardPosition", () => {
  it("creates a position with defaults", () => {
    const pos = createTestBoardPosition();

    expect(pos.id).toBe("board-1");
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.zIndex).toBe(1);
    expect(pos.width).toBe(600);
    expect(pos.height).toBe(400);
  });

  it("auto-increments zIndex", () => {
    const p1 = createTestBoardPosition();
    const p2 = createTestBoardPosition();

    expect(p1.zIndex).toBe(1);
    expect(p2.zIndex).toBe(2);
  });

  it("accepts overrides", () => {
    const pos = createTestBoardPosition({
      x: 100,
      y: 200,
      width: 800,
      height: 600,
    });

    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
    expect(pos.width).toBe(800);
    expect(pos.height).toBe(600);
  });
});

describe("createTestBoardConnection", () => {
  it("creates a connection with defaults", () => {
    const conn = createTestBoardConnection();

    expect(conn.id).toBe("conn-1");
    expect(conn.source_board_id).toBe("board-1");
    expect(conn.target_board_id).toBe("board-2");
    expect(conn.sourceHandle).toBe("right");
    expect(conn.targetHandle).toBe("left");
    expect(conn.lineStyle).toBe("solid");
    expect(conn.showArrow).toBe(true);
  });

  it("auto-increments connection IDs", () => {
    const c1 = createTestBoardConnection();
    const c2 = createTestBoardConnection();

    expect(c1.id).toBe("conn-1");
    expect(c2.id).toBe("conn-2");
  });

  it("accepts overrides", () => {
    const conn = createTestBoardConnection({
      source_board_id: "board-a",
      target_board_id: "board-b",
      lineStyle: "dotted",
      showArrow: false,
    });

    expect(conn.source_board_id).toBe("board-a");
    expect(conn.target_board_id).toBe("board-b");
    expect(conn.lineStyle).toBe("dotted");
    expect(conn.showArrow).toBe(false);
  });
});

describe("createTestArea", () => {
  it("creates an area with defaults", () => {
    const area = createTestArea();

    expect(area.id).toBe("area-1");
    expect(area.name).toBe("Test Area 1");
    expect(area.workspace_id).toBe("ws-1");
    expect(area.board_ids).toEqual([]);
    expect(area.color).toBe("#3b82f6");
  });

  it("auto-increments area IDs", () => {
    const a1 = createTestArea();
    const a2 = createTestArea();

    expect(a1.id).toBe("area-1");
    expect(a2.id).toBe("area-2");
  });

  it("accepts overrides", () => {
    const area = createTestArea({
      name: "Production",
      color: "#ef4444",
      board_ids: ["board-1", "board-2"],
    });

    expect(area.name).toBe("Production");
    expect(area.color).toBe("#ef4444");
    expect(area.board_ids).toEqual(["board-1", "board-2"]);
  });
});

describe("createTestComment", () => {
  it("creates a comment with defaults", () => {
    const comment = createTestComment();

    expect(comment.id).toBe("comment-1");
    expect(comment.content).toBe("Test comment 1");
    expect(comment.authorId).toBe("test-user");
    expect(comment.authorName).toBe("Test User");
    expect(comment.workspaceId).toBe("ws-1");
    expect(comment.x).toBe(0);
    expect(comment.y).toBe(0);
  });

  it("auto-increments comment IDs", () => {
    const c1 = createTestComment();
    const c2 = createTestComment();

    expect(c1.id).toBe("comment-1");
    expect(c2.id).toBe("comment-2");
  });

  it("accepts overrides", () => {
    const comment = createTestComment({
      content: "Great work!",
      authorId: "user-42",
      x: 50,
      y: 100,
    });

    expect(comment.content).toBe("Great work!");
    expect(comment.authorId).toBe("user-42");
    expect(comment.x).toBe(50);
    expect(comment.y).toBe(100);
  });
});
