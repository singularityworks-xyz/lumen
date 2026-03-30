import { describe, expect, it } from "bun:test";
import { seedWorkspace } from "./seeded-workspace";

describe("seedWorkspace", () => {
  it("returns a complete workspace state", () => {
    const state = seedWorkspace();

    expect(state).toHaveProperty("workspaces");
    expect(state).toHaveProperty("boards");
    expect(state).toHaveProperty("columns");
    expect(state).toHaveProperty("tasks");
    expect(state).toHaveProperty("boardPositions");
    expect(state).toHaveProperty("boardConnections");
    expect(state).toHaveProperty("areas");
  });

  it("creates exactly 1 workspace", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.workspaces)).toHaveLength(1);
    expect(state.workspaces["ws-1"]).toBeDefined();
    expect(state.workspaces["ws-1"].name).toBe("Test Workspace");
  });

  it("creates exactly 2 boards", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.boards)).toHaveLength(2);
    expect(state.boards["board-1"]).toBeDefined();
    expect(state.boards["board-2"]).toBeDefined();
  });

  it("creates exactly 6 columns", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.columns)).toHaveLength(6);
  });

  it("creates exactly 5 tasks", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.tasks)).toHaveLength(5);
  });

  it("creates exactly 2 board positions", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.boardPositions)).toHaveLength(2);
  });

  it("creates exactly 1 board connection", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.boardConnections)).toHaveLength(1);
  });

  it("creates exactly 1 area", () => {
    const state = seedWorkspace();

    expect(Object.keys(state.areas)).toHaveLength(1);
  });

  it("links boards to their columns via column_ids", () => {
    const state = seedWorkspace();

    const board1 = state.boards["board-1"];
    expect(board1.column_ids).toEqual(["col-1-1", "col-1-2", "col-1-3"]);

    const board2 = state.boards["board-2"];
    expect(board2.column_ids).toEqual(["col-2-1", "col-2-2", "col-2-3"]);
  });

  it("links columns to their tasks via task_ids", () => {
    const state = seedWorkspace();

    expect(state.columns["col-1-1"].task_ids).toEqual(["task-1", "task-2"]);
    expect(state.columns["col-1-2"].task_ids).toEqual(["task-3"]);
    expect(state.columns["col-1-3"].task_ids).toEqual(["task-4"]);
    expect(state.columns["col-2-1"].task_ids).toEqual(["task-5"]);
    expect(state.columns["col-2-2"].task_ids).toEqual([]);
  });

  it("links tasks to their columns and boards", () => {
    const state = seedWorkspace();

    expect(state.tasks["task-1"].column_id).toBe("col-1-1");
    expect(state.tasks["task-1"].board_id).toBe("board-1");
    expect(state.tasks["task-5"].column_id).toBe("col-2-1");
    expect(state.tasks["task-5"].board_id).toBe("board-2");
  });

  it("links workspace to boards via board_ids", () => {
    const state = seedWorkspace();

    expect(state.workspaces["ws-1"].board_ids).toEqual(["board-1", "board-2"]);
  });

  it("creates tasks with varied priorities", () => {
    const state = seedWorkspace();
    const priorities = Object.values(state.tasks).map((t) => t.priority);

    expect(priorities).toContain("high");
    expect(priorities).toContain("medium");
    expect(priorities).toContain("low");
  });

  it("creates tasks with varied statuses", () => {
    const state = seedWorkspace();
    const statuses = Object.values(state.tasks).map((t) => t.status);

    expect(statuses).toContain("todo");
    expect(statuses).toContain("done");
  });

  it("creates tasks with varied progress values", () => {
    const state = seedWorkspace();
    const progresses = Object.values(state.tasks).map((t) => t.progress);

    expect(progresses).toContain(0);
    expect(progresses).toContain(50);
    expect(progresses).toContain(100);
  });

  it("creates board positions at different coordinates", () => {
    const state = seedWorkspace();

    expect(state.boardPositions["board-1"].x).toBe(0);
    expect(state.boardPositions["board-2"].x).toBe(700);
  });

  it("creates a connection between the two boards", () => {
    const state = seedWorkspace();
    const conn = Object.values(state.boardConnections)[0];

    expect(conn.source_board_id).toBe("board-1");
    expect(conn.target_board_id).toBe("board-2");
  });

  it("returns fresh state on each call", () => {
    const state1 = seedWorkspace();
    const state2 = seedWorkspace();

    // Should be equal in content but different objects
    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2);
    expect(state1.boards).not.toBe(state2.boards);
  });
});
