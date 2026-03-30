import { describe, expect, it } from "bun:test";
import {
  addBoardToState,
  addTaskToState,
  createFreshState,
  getSingletonState,
  resetSingletonState,
} from "../helpers/store-harness";

describe("createFreshState", () => {
  it("returns a KanbanState object", () => {
    const state = createFreshState();

    expect(state).toBeDefined();
    expect(state).toHaveProperty("boards");
    expect(state).toHaveProperty("columns");
    expect(state).toHaveProperty("tasks");
    expect(state).toHaveProperty("workspaces");
  });

  it("returns a new object each time", () => {
    const state1 = createFreshState();
    const state2 = createFreshState();

    expect(state1).not.toBe(state2);
  });

  it("has empty entity maps by default", () => {
    const state = createFreshState();

    expect(state.boards.allIds).toEqual([]);
    expect(state.columns.allIds).toEqual([]);
    expect(state.tasks.allIds).toEqual([]);
  });
});

describe("addBoardToState", () => {
  it("adds a board to the state", () => {
    const state = createFreshState();
    const { boardId } = addBoardToState(state);

    expect(boardId).toBeDefined();
    expect(state.boards.byId[boardId]).toBeDefined();
    expect(state.boards.allIds).toContain(boardId);
  });

  it("creates default columns for the board", () => {
    const state = createFreshState();
    const { columnIds } = addBoardToState(state);

    expect(columnIds).toHaveLength(3);
    for (const colId of columnIds) {
      expect(state.columns.byId[colId]).toBeDefined();
      expect(state.columns.allIds).toContain(colId);
    }
  });

  it("creates a board position", () => {
    const state = createFreshState();
    const { boardId } = addBoardToState(state);

    expect(state.boardPositions.byId[boardId]).toBeDefined();
    expect(state.boardPositions.allIds).toContain(boardId);
  });

  it("uses custom board ID when provided", () => {
    const state = createFreshState();
    const { boardId } = addBoardToState(state, { boardId: "my-board" });

    expect(boardId).toBe("my-board");
    expect(state.boards.byId["my-board"]).toBeDefined();
  });

  it("uses custom column IDs when provided", () => {
    const state = createFreshState();
    const customCols = ["col-a", "col-b"];
    const { columnIds } = addBoardToState(state, { columnIds: customCols });

    expect(columnIds).toEqual(customCols);
    for (const colId of customCols) {
      expect(state.columns.byId[colId]).toBeDefined();
    }
  });

  it("uses custom board name", () => {
    const state = createFreshState();
    addBoardToState(state, { name: "Sprint Board" });

    expect(Object.values(state.boards.byId)[0].name).toBe("Sprint Board");
  });

  it("uses custom position coordinates", () => {
    const state = createFreshState();
    const { boardId } = addBoardToState(state, { x: 500, y: 300 });

    expect(state.boardPositions.byId[boardId].x).toBe(500);
    expect(state.boardPositions.byId[boardId].y).toBe(300);
  });

  it("auto-increments zIndex", () => {
    const state = createFreshState();
    const { boardId: id1 } = addBoardToState(state);
    const { boardId: id2 } = addBoardToState(state);

    expect(state.boardPositions.byId[id1].zIndex).toBe(1);
    expect(state.boardPositions.byId[id2].zIndex).toBe(2);
  });

  it("links board to workspace", () => {
    const state = createFreshState();
    state.currentWorkspaceId = "ws-1";
    state.workspaces.byId["ws-1"] = {
      id: "ws-1",
      name: "Test WS",
      created_at: new Date().toISOString(),
      board_ids: [],
    };
    state.workspaces.allIds.push("ws-1");

    const { boardId } = addBoardToState(state, { workspaceId: "ws-1" });

    expect(state.workspaces.byId["ws-1"].board_ids).toContain(boardId);
  });
});

describe("addTaskToState", () => {
  it("adds a task to the state", () => {
    const state = createFreshState();
    addBoardToState(state, { boardId: "board-1", columnIds: ["col-1"] });

    const taskId = addTaskToState(state, {
      columnId: "col-1",
      boardId: "board-1",
    });

    expect(taskId).toBeDefined();
    expect(state.tasks.byId[taskId]).toBeDefined();
    expect(state.tasks.allIds).toContain(taskId);
  });

  it("links task to its column", () => {
    const state = createFreshState();
    addBoardToState(state, { boardId: "board-1", columnIds: ["col-1"] });

    const taskId = addTaskToState(state, {
      columnId: "col-1",
      boardId: "board-1",
    });

    expect(state.columns.byId["col-1"].task_ids).toContain(taskId);
  });

  it("uses custom task ID when provided", () => {
    const state = createFreshState();
    addBoardToState(state, { boardId: "board-1", columnIds: ["col-1"] });

    const taskId = addTaskToState(state, {
      taskId: "my-task",
      columnId: "col-1",
      boardId: "board-1",
    });

    expect(taskId).toBe("my-task");
    expect(state.tasks.byId["my-task"]).toBeDefined();
  });

  it("uses default values for title, priority, progress", () => {
    const state = createFreshState();
    addBoardToState(state, { boardId: "board-1", columnIds: ["col-1"] });

    const taskId = addTaskToState(state, {
      columnId: "col-1",
      boardId: "board-1",
    });

    const task = state.tasks.byId[taskId];
    expect(task.title).toBe("Test Task");
    expect(task.priority).toBe("medium");
    expect(task.progress).toBe(0);
    expect(task.status).toBe("todo");
  });

  it("accepts custom overrides", () => {
    const state = createFreshState();
    addBoardToState(state, { boardId: "board-1", columnIds: ["col-1"] });

    const taskId = addTaskToState(state, {
      columnId: "col-1",
      boardId: "board-1",
      title: "Deploy v2",
      priority: "high",
      progress: 80,
    });

    const task = state.tasks.byId[taskId];
    expect(task.title).toBe("Deploy v2");
    expect(task.priority).toBe("high");
    expect(task.progress).toBe(80);
  });
});

describe("getSingletonState / resetSingletonState", () => {
  it("returns the same object on repeated calls", () => {
    resetSingletonState();

    const state1 = getSingletonState();
    const state2 = getSingletonState();

    expect(state1).toBe(state2);
  });

  it("resetSingletonState creates a new state on next call", () => {
    const state1 = getSingletonState();
    resetSingletonState();
    const state2 = getSingletonState();

    expect(state1).not.toBe(state2);
  });

  it("resetSingletonState clears previously added data", () => {
    const state = getSingletonState();
    addBoardToState(state, { boardId: "should-be-gone" });

    resetSingletonState();
    const freshState = getSingletonState();

    expect(freshState.boards.byId["should-be-gone"]).toBeUndefined();
  });
});
