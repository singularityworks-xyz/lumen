import { beforeEach, describe, expect, it } from "bun:test";

import {
  addBoardToState,
  addTaskToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import type { Board, Column, Task, Workspace } from "../types";
import type { KanbanState } from "./types";

// We test selector logic directly by creating state objects and
// exercising the same lookup/filter/sort patterns the actual selectors use.

function createPopulatedState(): KanbanState {
  const state = createFreshState();
  const wsId = state.currentWorkspaceId ?? "ws-1";

  // Add two boards
  addBoardToState(state, {
    boardId: "board-1",
    name: "Board One",
    workspaceId: wsId,
    columnIds: ["col-1a", "col-1b"],
  });

  addBoardToState(state, {
    boardId: "board-2",
    name: "Board Two",
    workspaceId: wsId,
    columnIds: ["col-2a"],
  });

  // Add tasks to col-1a
  addTaskToState(state, {
    taskId: "task-1",
    columnId: "col-1a",
    boardId: "board-1",
    title: "Task One",
    position: 1,
  });
  addTaskToState(state, {
    taskId: "task-2",
    columnId: "col-1a",
    boardId: "board-1",
    title: "Task Two",
    position: 0,
  });

  // Add task to col-1b
  addTaskToState(state, {
    taskId: "task-3",
    columnId: "col-1b",
    boardId: "board-1",
    title: "Task Three",
    position: 0,
  });

  return state;
}

let state: KanbanState;

beforeEach(() => {
  state = createPopulatedState();
});

// ─── useCurrentWorkspace ───────────────────────────────────────

describe("useCurrentWorkspace logic", () => {
  it("returns the current workspace when set", () => {
    const wsId = state.currentWorkspaceId!;
    const ws = state.workspaces.byId[wsId];
    expect(ws).toBeDefined();
    expect(ws!.name).toBe("Default Workspace");
  });

  it("returns null when currentWorkspaceId is null", () => {
    state.currentWorkspaceId = null;
    const id = state.currentWorkspaceId;
    const ws = id ? (state.workspaces.byId[id] ?? null) : null;
    expect(ws).toBeNull();
  });

  it("returns null when workspace id is set but workspace doesn't exist", () => {
    state.currentWorkspaceId = "nonexistent";
    const id = state.currentWorkspaceId;
    const ws = id ? (state.workspaces.byId[id] ?? null) : null;
    expect(ws).toBeNull();
  });
});

// ─── useWorkspaces ─────────────────────────────────────────────

describe("useWorkspaces logic", () => {
  it("returns all workspaces", () => {
    const workspaces: Workspace[] = state.workspaces.allIds
      .map((id: string) => state.workspaces.byId[id])
      .filter((ws): ws is Workspace => ws !== undefined);

    expect(workspaces.length).toBeGreaterThanOrEqual(1);
    expect(workspaces[0]!.name).toBe("Default Workspace");
  });

  it("filters out undefined entries", () => {
    state.workspaces.allIds.push("ghost-id");
    const workspaces: Workspace[] = state.workspaces.allIds
      .map((id: string) => state.workspaces.byId[id])
      .filter((ws): ws is Workspace => ws !== undefined);

    expect(workspaces.every((ws: Workspace) => ws.id !== "ghost-id")).toBe(
      true
    );
  });
});

// ─── useBoardById ──────────────────────────────────────────────

describe("useBoardById logic", () => {
  it("returns board when found", () => {
    const board = state.boards.byId["board-1"] ?? null;
    expect(board).toBeDefined();
    expect(board!.name).toBe("Board One");
  });

  it("returns null when boardId is null", () => {
    const boardId: string | null = null;
    const board = boardId ? (state.boards.byId[boardId] ?? null) : null;
    expect(board).toBeNull();
  });

  it("returns null when board doesn't exist", () => {
    const boardId = "nonexistent";
    const board = boardId ? (state.boards.byId[boardId] ?? null) : null;
    expect(board).toBeNull();
  });
});

// ─── useBoardsForCurrentWorkspace ──────────────────────────────

describe("useBoardsForCurrentWorkspace logic", () => {
  it("returns boards belonging to the current workspace", () => {
    const workspaceId = state.currentWorkspaceId;
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined &&
          (!board.workspace_id || board.workspace_id === workspaceId)
      );

    expect(boards).toHaveLength(2);
    expect(boards.map((b: Board) => b.name).sort()).toEqual([
      "Board One",
      "Board Two",
    ]);
  });

  it("excludes boards from other workspaces", () => {
    addBoardToState(state, {
      boardId: "board-other",
      name: "Other Board",
      workspaceId: "other-ws",
    });

    const workspaceId = state.currentWorkspaceId!;
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined && board.workspace_id === workspaceId
      );

    expect(boards.map((b: Board) => b.id)).not.toContain("board-other");
  });
});

// ─── useBoardsByWorkspace ──────────────────────────────────────

describe("useBoardsByWorkspace logic", () => {
  it("returns boards for a given workspace id", () => {
    const wsId = state.currentWorkspaceId!;
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined && board.workspace_id === wsId
      );

    expect(boards).toHaveLength(2);
  });

  it("returns empty for a workspace with no boards", () => {
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined && board.workspace_id === "empty-ws"
      );

    expect(boards).toHaveLength(0);
  });
});

// ─── useColumnById ─────────────────────────────────────────────

describe("useColumnById logic", () => {
  it("returns column when found", () => {
    const col = state.columns.byId["col-1a"] ?? null;
    expect(col).toBeDefined();
    expect(col!.board_id).toBe("board-1");
  });

  it("returns null when columnId is null", () => {
    const colId: string | null = null;
    const col = colId ? (state.columns.byId[colId] ?? null) : null;
    expect(col).toBeNull();
  });
});

// ─── useColumnsByBoard ─────────────────────────────────────────

describe("useColumnsByBoard logic", () => {
  it("returns columns sorted by position", () => {
    const board = state.boards.byId["board-1"]!;
    const columns: Column[] = board.column_ids
      .map((id: string) => state.columns.byId[id])
      .filter((col): col is Column => col !== undefined)
      .sort((a: Column, b: Column) => a.position - b.position);

    expect(columns).toHaveLength(2);
    expect(columns[0]!.position).toBeLessThanOrEqual(columns[1]!.position);
  });

  it("filters out undefined columns from column_ids", () => {
    state.boards.byId["board-1"]!.column_ids.push("ghost-col");
    const board = state.boards.byId["board-1"]!;
    const columns: Column[] = board.column_ids
      .map((id: string) => state.columns.byId[id])
      .filter((col): col is Column => col !== undefined);

    expect(columns).toHaveLength(2);
  });
});

// ─── useTaskById ───────────────────────────────────────────────

describe("useTaskById logic", () => {
  it("returns task when found", () => {
    const task = state.tasks.byId["task-1"] ?? null;
    expect(task).toBeDefined();
    expect(task!.title).toBe("Task One");
  });

  it("returns null when taskId is null", () => {
    const taskId: string | null = null;
    const task = taskId ? (state.tasks.byId[taskId] ?? null) : null;
    expect(task).toBeNull();
  });
});

// ─── useTasksByColumn ──────────────────────────────────────────

describe("useTasksByColumn logic", () => {
  it("returns tasks sorted by position", () => {
    const column = state.columns.byId["col-1a"]!;
    const tasks: Task[] = column.task_ids
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined)
      .sort((a: Task, b: Task) => a.position - b.position);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.id).toBe("task-2");
    expect(tasks[1]!.id).toBe("task-1");
  });
});

// ─── useTasksByIds ─────────────────────────────────────────────

describe("useTasksByIds logic", () => {
  it("returns tasks for given ids", () => {
    const taskIds = ["task-1", "task-3"];
    const tasks: Task[] = taskIds
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t: Task) => t.title).sort()).toEqual([
      "Task One",
      "Task Three",
    ]);
  });

  it("filters out nonexistent task ids", () => {
    const taskIds = ["task-1", "nonexistent"];
    const tasks: Task[] = taskIds
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe("task-1");
  });

  it("returns empty for empty input", () => {
    const tasks: Task[] = ([] as string[])
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined);

    expect(tasks).toHaveLength(0);
  });
});

// ─── useDenormalizedBoard ──────────────────────────────────────

describe("useDenormalizedBoard logic", () => {
  it("denormalizes board with columns and tasks", () => {
    const board = state.boards.byId["board-1"]!;
    const columnsMap = state.columns.byId;
    const tasksMap = state.tasks.byId;

    const columns = board.column_ids
      .map((colId: string) => {
        const column = columnsMap[colId];
        if (!column) {
          return null;
        }

        const tasks: Task[] = column.task_ids
          .map((taskId: string) => tasksMap[taskId])
          .filter((task): task is Task => task !== undefined)
          .sort((a: Task, b: Task) => a.position - b.position);

        return {
          id: column.id,
          board_id: column.board_id,
          name: column.name,
          position: column.position,
          tasks,
        };
      })
      .filter((col): col is NonNullable<typeof col> => col !== null)
      .sort((a, b) => a.position - b.position);

    expect(columns).toHaveLength(2);
    expect(columns[0]!.tasks).toHaveLength(2);
    expect(columns[0]!.tasks[0]!.id).toBe("task-2");
    expect(columns[0]!.tasks[1]!.id).toBe("task-1");
    expect(columns[1]!.tasks).toHaveLength(1);
    expect(columns[1]!.tasks[0]!.id).toBe("task-3");
  });

  it("returns null when boardId is null", () => {
    const boardId: string | null = null;
    const board = boardId ? (state.boards.byId[boardId] ?? null) : null;
    expect(board).toBeNull();
  });
});

// ─── useBoardPosition ──────────────────────────────────────────

describe("useBoardPosition logic", () => {
  it("returns position when found", () => {
    const pos = state.boardPositions.byId["board-1"] ?? null;
    expect(pos).toBeDefined();
    expect(pos!.x).toBeDefined();
    expect(pos!.y).toBeDefined();
  });

  it("returns null when boardId is null", () => {
    const boardId: string | null = null;
    const pos = boardId ? (state.boardPositions.byId[boardId] ?? null) : null;
    expect(pos).toBeNull();
  });
});

// ─── useBoardPositionsForCurrentWorkspace ──────────────────────

describe("useBoardPositionsForCurrentWorkspace logic", () => {
  it("returns positions for boards in current workspace", () => {
    const workspaceId = state.currentWorkspaceId!;
    const boardIds = state.boards.allIds.filter((id: string) => {
      const board = state.boards.byId[id];
      return (
        board && (!board.workspace_id || board.workspace_id === workspaceId)
      );
    });

    const positions = boardIds
      .map((id: string) => state.boardPositions.byId[id])
      .filter((pos): pos is NonNullable<typeof pos> => pos !== undefined);

    expect(positions).toHaveLength(2);
  });
});

// ─── useIsTaskSelected ─────────────────────────────────────────

describe("useIsTaskSelected logic", () => {
  it("returns true when task is selected", () => {
    state.selectedTaskIds = ["task-1", "task-2"];
    expect(state.selectedTaskIds.includes("task-1")).toBe(true);
  });

  it("returns false when task is not selected", () => {
    state.selectedTaskIds = ["task-1"];
    expect(state.selectedTaskIds.includes("task-2")).toBe(false);
  });

  it("returns false when no tasks are selected", () => {
    state.selectedTaskIds = [];
    expect(state.selectedTaskIds.includes("task-1")).toBe(false);
  });
});

// ─── useSelectedTasks ──────────────────────────────────────────

describe("useSelectedTasks logic", () => {
  it("returns selected task objects", () => {
    state.selectedTaskIds = ["task-1", "task-3"];
    const tasks: Task[] = state.selectedTaskIds
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t: Task) => t.title).sort()).toEqual([
      "Task One",
      "Task Three",
    ]);
  });

  it("filters out nonexistent selected ids", () => {
    state.selectedTaskIds = ["task-1", "nonexistent"];
    const tasks: Task[] = state.selectedTaskIds
      .map((id: string) => state.tasks.byId[id])
      .filter((task): task is Task => task !== undefined);

    expect(tasks).toHaveLength(1);
  });
});

// ─── useIsBoardSelected ────────────────────────────────────────

describe("useIsBoardSelected logic", () => {
  it("returns true when board is selected", () => {
    state.selectedBoardIds = ["board-1"];
    expect(state.selectedBoardIds.includes("board-1")).toBe(true);
  });

  it("returns false when board is not selected", () => {
    state.selectedBoardIds = [];
    expect(state.selectedBoardIds.includes("board-1")).toBe(false);
  });
});

// ─── useDraggedTask ────────────────────────────────────────────

describe("useDraggedTask logic", () => {
  it("returns the dragged task", () => {
    state.draggedTaskId = "task-1";
    const task = state.draggedTaskId
      ? (state.tasks.byId[state.draggedTaskId] ?? null)
      : null;
    expect(task).toBeDefined();
    expect(task!.title).toBe("Task One");
  });

  it("returns null when no task is dragged", () => {
    state.draggedTaskId = null;
    const task = state.draggedTaskId
      ? (state.tasks.byId[state.draggedTaskId] ?? null)
      : null;
    expect(task).toBeNull();
  });

  it("returns null when dragged task id doesn't exist", () => {
    state.draggedTaskId = "nonexistent";
    const task = state.draggedTaskId
      ? (state.tasks.byId[state.draggedTaskId] ?? null)
      : null;
    expect(task).toBeNull();
  });
});

// ─── useHasBoardsInCurrentWorkspace ────────────────────────────

describe("useHasBoardsInCurrentWorkspace logic", () => {
  it("returns true when boards exist", () => {
    const wsId = state.currentWorkspaceId!;
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined && board.workspace_id === wsId
      );
    expect(boards.length > 0).toBe(true);
  });

  it("returns false when no boards exist", () => {
    state.boards.allIds = [];
    state.boards.byId = {};
    const wsId = state.currentWorkspaceId!;
    const boards: Board[] = state.boards.allIds
      .map((id: string) => state.boards.byId[id])
      .filter(
        (board): board is Board =>
          board !== undefined && board.workspace_id === wsId
      );
    expect(boards.length > 0).toBe(false);
  });
});

// ─── useTaskCountForColumn ─────────────────────────────────────

describe("useTaskCountForColumn logic", () => {
  it("returns task count for column", () => {
    const column = state.columns.byId["col-1a"];
    const count = column?.task_ids.length ?? 0;
    expect(count).toBe(2);
  });

  it("returns 0 for empty column", () => {
    const column = state.columns.byId["col-2a"];
    const count = column?.task_ids.length ?? 0;
    expect(count).toBe(0);
  });

  it("returns 0 for nonexistent column", () => {
    const column = state.columns.byId.nonexistent;
    const count = column?.task_ids.length ?? 0;
    expect(count).toBe(0);
  });
});

// ─── useColumnCountForBoard ────────────────────────────────────

describe("useColumnCountForBoard logic", () => {
  it("returns column count for board", () => {
    const board = state.boards.byId["board-1"];
    const count = board?.column_ids.length ?? 0;
    expect(count).toBe(2);
  });

  it("returns 0 for nonexistent board", () => {
    const board = state.boards.byId.nonexistent;
    const count = board?.column_ids.length ?? 0;
    expect(count).toBe(0);
  });
});

// ─── useShowWelcomeScreen ──────────────────────────────────────

describe("useShowWelcomeScreen logic", () => {
  it("returns false when workspace has boards", () => {
    const wsId = state.currentWorkspaceId!;
    const workspace = state.workspaces.byId[wsId];
    const show = (workspace?.board_ids.length ?? 0) === 0;
    expect(show).toBe(false);
  });

  it("returns true when workspace has no boards", () => {
    const wsId = state.currentWorkspaceId!;
    state.workspaces.byId[wsId]!.board_ids = [];
    const workspace = state.workspaces.byId[wsId];
    const show = (workspace?.board_ids.length ?? 0) === 0;
    expect(show).toBe(true);
  });
});

// ─── useDenormalizedBoardsForCurrentWorkspace ──────────────────

describe("useDenormalizedBoardsForCurrentWorkspace logic", () => {
  it("denormalizes all boards in current workspace", () => {
    const wsId = state.currentWorkspaceId!;
    const boardsMap = state.boards.byId;
    const columnsMap = state.columns.byId;
    const tasksMap = state.tasks.byId;

    const results = state.boards.allIds
      .map((boardId: string) => {
        const board = boardsMap[boardId];
        if (!board || (board.workspace_id && board.workspace_id !== wsId)) {
          return null;
        }

        const columns = board.column_ids
          .map((colId: string) => {
            const column = columnsMap[colId];
            if (!column) {
              return null;
            }
            const tasks: Task[] = column.task_ids
              .map((taskId: string) => tasksMap[taskId])
              .filter((task): task is Task => task !== undefined)
              .sort((a: Task, b: Task) => a.position - b.position);
            return {
              id: column.id,
              name: column.name,
              position: column.position,
              tasks,
            };
          })
          .filter((col): col is NonNullable<typeof col> => col !== null)
          .sort((a, b) => a.position - b.position);

        return { id: board.id, name: board.name, columns };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    expect(results).toHaveLength(2);
    expect(results[0]!.columns).toHaveLength(2);
    expect(results[1]!.columns).toHaveLength(1);
  });
});
