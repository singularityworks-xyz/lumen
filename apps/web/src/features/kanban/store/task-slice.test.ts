import { beforeEach, describe, expect, it } from "bun:test";
import {
  addBoardToState,
  addTaskToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import { createTaskSlice } from "./slices/task-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createTaskSlice>;

beforeEach(() => {
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createTaskSlice(set, get);
});

describe("addTask", () => {
  it("appends into column and updates workspace focus", () => {
    const wsId = state.currentWorkspaceId;
    if (!wsId) {
      throw new Error("missing workspace");
    }
    const { boardId, columnIds } = addBoardToState(state, {
      workspaceId: wsId,
    });
    const colId = columnIds[0];
    if (!colId) {
      throw new Error("missing colId");
    }

    const taskId = actions.addTask(colId, boardId, "My Task");

    expect(state.tasks.byId[taskId]).toBeDefined();
    expect(state.tasks.byId[taskId]?.title).toBe("My Task");
    expect(state.tasks.allIds).toContain(taskId);
    expect(state.columns.byId[colId]?.task_ids).toContain(taskId);
    expect(state.workspaces.byId[wsId]?.lastFocusedBoardId).toBe(boardId);
  });

  it("sets priority, description, progress, due_date, tags from options", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0];
    if (!colId) {
      throw new Error("missing colId");
    }

    const taskId = actions.addTask(colId, boardId, "Opts Task", {
      priority: "high",
      description: "desc",
      progress: 50,
      due_date: "2026-01-01",
      tags: ["a", "b"],
    });

    const task = state.tasks.byId[taskId]!;
    expect(task.priority).toBe("high");
    expect(task.description).toBe("desc");
    expect(task.progress).toBe(50);
    expect(task.due_date).toBe("2026-01-01");
    expect(task.tags).toEqual(["a", "b"]);
  });
});

describe("moveTask", () => {
  it("rewires board/column IDs and inherits target column progress when present", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colA = columnIds[0];
    const colB = columnIds[1];
    if (!(colA && colB)) {
      throw new Error("missing colIds");
    }
    state.columns.byId[colB]!.progressValue = 75;

    const taskId = addTaskToState(state, { columnId: colA, boardId });

    actions.moveTask(taskId, colA, colB, boardId);

    const task = state.tasks.byId[taskId]!;
    expect(task.column_id).toBe(colB);
    expect(task.board_id).toBe(boardId);
    expect(task.progress).toBe(75);
    expect(state.columns.byId[colA]?.task_ids).not.toContain(taskId);
    expect(state.columns.byId[colB]?.task_ids).toContain(taskId);
  });
});

describe("deleteTask", () => {
  it("removes from column task_ids and selectedTaskIds", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0];
    if (!colId) {
      throw new Error("missing colId");
    }
    const taskId = addTaskToState(state, { columnId: colId, boardId });
    state.selectedTaskIds.push(taskId);

    actions.deleteTask(taskId);

    expect(state.tasks.byId[taskId]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(taskId);
    expect(state.columns.byId[colId]?.task_ids).not.toContain(taskId);
    expect(state.selectedTaskIds).not.toContain(taskId);
  });
});

describe("bulkDeleteTasks", () => {
  it("removes all specified tasks and cleans selections", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colA = columnIds[0];
    const colB = columnIds[1];
    if (!(colA && colB)) {
      throw new Error("missing colIds");
    }
    const t1 = addTaskToState(state, { columnId: colA, boardId });
    const t2 = addTaskToState(state, { columnId: colB, boardId });
    state.selectedTaskIds.push(t1, t2);

    actions.bulkDeleteTasks([t1, t2]);

    expect(state.tasks.byId[t1]).toBeUndefined();
    expect(state.tasks.byId[t2]).toBeUndefined();
    expect(state.tasks.allIds).not.toContain(t1);
    expect(state.tasks.allIds).not.toContain(t2);
    expect(state.selectedTaskIds).toEqual([]);
  });
});

describe("bulkUpdateTasks", () => {
  it("stamps consistent updated_at on all tasks", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colA = columnIds[0];
    const colB = columnIds[1];
    if (!(colA && colB)) {
      throw new Error("missing colIds");
    }
    const t1 = addTaskToState(state, { columnId: colA, boardId });
    const t2 = addTaskToState(state, { columnId: colB, boardId });

    actions.bulkUpdateTasks([t1, t2], { priority: "high" });

    expect(state.tasks.byId[t1]?.priority).toBe("high");
    expect(state.tasks.byId[t2]?.priority).toBe("high");
    expect(state.tasks.byId[t1]?.updated_at).toBe(
      state.tasks.byId[t2]?.updated_at
    );
  });
});

describe("duplicateTask", () => {
  it("inserts after source task with (Copy) suffix and resets progress/completion state", () => {
    const { boardId, columnIds } = addBoardToState(state);
    const colId = columnIds[0];
    if (!colId) {
      throw new Error("missing colId");
    }
    const taskId = addTaskToState(state, {
      columnId: colId,
      boardId,
      title: "Original",
      progress: 80,
    });
    const sourceTask = state.tasks.byId[taskId];
    expect(sourceTask).toBeDefined();
    if (sourceTask) {
      sourceTask.status = "done";
      sourceTask.checklists = [
        {
          id: "cl-1",
          title: "Item",
          completed: true,
          position: 0,
          task_id: taskId,
        },
      ];
    }

    const result = actions.duplicateTask(taskId);
    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("duplicateTask returned null");
    }

    const newTask = state.tasks.byId[result];
    expect(newTask).toBeDefined();
    if (!newTask) {
      throw new Error("new task missing");
    }
    expect(newTask.title).toBe("Original (Copy)");
    expect(newTask.column_id).toBe(colId);
    expect(newTask.progress).toBe(0);
    expect(newTask.status).toBe("todo");

    const column = state.columns.byId[colId];
    expect(column).toBeDefined();
    if (!column) {
      throw new Error("column missing");
    }
    expect(column.task_ids).toContain(result);

    const srcIdx = column.task_ids.indexOf(taskId);
    const newIdx = column.task_ids.indexOf(result);
    expect(newIdx).toBe(srcIdx + 1);

    const checklists = newTask.checklists;
    expect(checklists).toBeDefined();
    if (!checklists) {
      throw new Error("checklists missing");
    }
    expect(checklists[0]?.completed).toBe(false);
  });
});

describe("setDraggedTask", () => {
  it("sets and clears draggedTaskId", () => {
    actions.setDraggedTask("task-1");
    expect(state.draggedTaskId).toBe("task-1");

    actions.setDraggedTask(null);
    expect(state.draggedTaskId).toBeNull();
  });
});

describe("openTaskQuickActions / closeTaskQuickActions", () => {
  it("manages quick actions state", () => {
    const pos = { x: 10, y: 20 };
    actions.openTaskQuickActions("task-1", "board-1", "col-1", pos);

    expect(state.taskQuickActions["task-1"]).toEqual({
      taskId: "task-1",
      boardId: "board-1",
      columnId: "col-1",
      position: pos,
    });

    actions.closeTaskQuickActions("task-1");

    expect(state.taskQuickActions["task-1"]).toBeUndefined();
  });
});
