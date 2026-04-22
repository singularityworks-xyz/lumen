import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import {
  applyYjsToStateWithRepair,
  initializeYjsForWorkspace,
} from "@/src/features/collab/sync/state-sync";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";

// ──────────────────────────────────────────────────────────────
// Integration test: AI tool execution → Yjs mutation → store sync
//
// Simulates the flow: AI returns a tool call with params → server
// executor writes to Yjs doc → client syncs Yjs → Zustand store
// ──────────────────────────────────────────────────────────────

const TS = "2024-01-15T00:00:00.000Z";

// Use unique IDs per invocation to avoid METADATA collision with other
// Yjs-based test files running in the same Bun process.
let _aiToolCounter = 0;

function createWorkspaceWithBoard(): {
  state: KanbanState;
  doc: Y.Doc;
  wsId: string;
  boardId: string;
  colTodoId: string;
  colDoneId: string;
  taskId: string;
} {
  _aiToolCounter += 1;
  const n = _aiToolCounter;
  const wsId = `ws-aitool-${n}`;
  const boardId = `board-aitool-${n}`;
  const colTodoId = `col-todo-aitool-${n}`;
  const colDoneId = `col-done-aitool-${n}`;
  const taskId = `task-existing-aitool-${n}`;

  const state = createInitialState();

  state.workspaces.byId[wsId] = {
    id: wsId,
    name: "AI Test Workspace",
    created_at: TS,
    board_ids: [boardId],
  };
  state.workspaces.allIds.push(wsId);

  state.boards.byId[boardId] = {
    id: boardId,
    name: "Main Board",
    workspace_id: wsId,
    column_ids: [colTodoId, colDoneId],
    created_by: "user-1",
    created_at: TS,
  };
  state.boards.allIds.push(boardId);

  state.columns.byId[colTodoId] = {
    id: colTodoId,
    board_id: boardId,
    name: "To Do",
    position: 0,
    task_ids: [taskId],
  };
  state.columns.byId[colDoneId] = {
    id: colDoneId,
    board_id: boardId,
    name: "Done",
    position: 1,
    task_ids: [],
  };
  state.columns.allIds.push(colTodoId, colDoneId);

  state.tasks.byId[taskId] = {
    id: taskId,
    title: "Existing Task",
    board_id: boardId,
    column_id: colTodoId,
    position: 0,
    priority: "medium",
    progress: 0,
    status: "todo",
    created_by: "user-1",
    created_at: TS,
    updated_at: TS,
  };
  state.tasks.allIds.push(taskId);

  state.boardPositions.byId[boardId] = {
    id: boardId,
    x: 0,
    y: 0,
    zIndex: 1,
  };
  state.boardPositions.allIds.push(boardId);

  // Initialize Y.Doc and establish metadata tracking
  const doc = new Y.Doc();
  initializeYjsForWorkspace(doc, state, wsId);
  const synced = applyYjsToStateWithRepair(doc, state, wsId) as KanbanState;

  return { state: synced, doc, wsId, boardId, colTodoId, colDoneId, taskId };
}

// ─── createTask tool ───────────────────────────────────────────

describe("AI tool → Yjs → Store: createTask", () => {
  it("AI creates a task in Yjs, client sees it after sync", () => {
    const { state, doc, wsId, boardId, colTodoId, taskId } =
      createWorkspaceWithBoard();

    const newTaskId = `task-ai-${_aiToolCounter}`;
    const newTask = {
      id: newTaskId,
      title: "Fix login bug",
      board_id: boardId,
      column_id: colTodoId,
      position: 1,
      priority: "high",
      progress: 0,
      status: "todo",
      created_by: "ai-assistant",
      created_at: TS,
      updated_at: TS,
      description: "User reported login failures on mobile",
    };

    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.TASKS).set(newTaskId, newTask);
      const col = doc.getMap(YJS_MAP_NAMES.COLUMNS).get(colTodoId) as Record<
        string,
        unknown
      >;
      if (col) {
        doc.getMap(YJS_MAP_NAMES.COLUMNS).set(colTodoId, {
          ...col,
          task_ids: [...(col.task_ids as string[]), newTaskId],
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);

    expect(result.tasks?.byId[newTaskId]).toBeDefined();
    expect(result.tasks?.byId[newTaskId]?.title).toBe("Fix login bug");
    expect(result.tasks?.byId[newTaskId]?.priority).toBe("high");
    expect(result.tasks?.byId[newTaskId]?.description).toBe(
      "User reported login failures on mobile"
    );
    expect(result.tasks?.allIds).toContain(newTaskId);
    expect(result.tasks?.byId[taskId]).toBeDefined();
  });

  it("AI creates multiple tasks in a single transaction", () => {
    const { state, doc, wsId, boardId, colTodoId } = createWorkspaceWithBoard();
    const n = _aiToolCounter;

    doc.transact(() => {
      const newTasks = [
        { id: `task-batch-a-${n}`, title: "Task A", priority: "high" },
        { id: `task-batch-b-${n}`, title: "Task B", priority: "medium" },
        { id: `task-batch-c-${n}`, title: "Task C", priority: "low" },
      ];

      for (const t of newTasks) {
        doc.getMap(YJS_MAP_NAMES.TASKS).set(t.id, {
          ...t,
          board_id: boardId,
          column_id: colTodoId,
          position: 0,
          progress: 0,
          status: "todo",
          created_by: "ai",
          created_at: TS,
          updated_at: TS,
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.tasks?.byId[`task-batch-a-${n}`]?.title).toBe("Task A");
    expect(result.tasks?.byId[`task-batch-b-${n}`]?.title).toBe("Task B");
    expect(result.tasks?.byId[`task-batch-c-${n}`]?.title).toBe("Task C");
  });
});

// ─── updateTask tool ───────────────────────────────────────────

describe("AI tool → Yjs → Store: updateTask", () => {
  it("AI updates task priority and description", () => {
    const { state, doc, wsId, taskId } = createWorkspaceWithBoard();

    const existing = doc.getMap(YJS_MAP_NAMES.TASKS).get(taskId) as Record<
      string,
      unknown
    >;
    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.TASKS).set(taskId, {
        ...existing,
        priority: "high",
        description: "Updated by AI: needs urgent attention",
        updated_at: "2024-01-16T00:00:00.000Z",
      });
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.tasks?.byId[taskId]?.priority).toBe("high");
    expect(result.tasks?.byId[taskId]?.description).toBe(
      "Updated by AI: needs urgent attention"
    );
  });

  it("AI updates task status to done", () => {
    const { state, doc, wsId, taskId } = createWorkspaceWithBoard();

    const existing = doc.getMap(YJS_MAP_NAMES.TASKS).get(taskId) as Record<
      string,
      unknown
    >;
    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.TASKS).set(taskId, {
        ...existing,
        status: "done",
        progress: 100,
      });
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.tasks?.byId[taskId]?.status).toBe("done");
    expect(result.tasks?.byId[taskId]?.progress).toBe(100);
  });
});

// ─── deleteTask tool ───────────────────────────────────────────

describe("AI tool → Yjs → Store: deleteTask", () => {
  it("AI deletes task from Yjs, client removes it after sync", () => {
    const { state, doc, wsId, colTodoId, taskId } = createWorkspaceWithBoard();

    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.TASKS).delete(taskId);
      const col = doc.getMap(YJS_MAP_NAMES.COLUMNS).get(colTodoId) as Record<
        string,
        unknown
      >;
      if (col) {
        doc.getMap(YJS_MAP_NAMES.COLUMNS).set(colTodoId, {
          ...col,
          task_ids: [],
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.tasks?.byId[taskId]).toBeUndefined();
    expect(result.tasks?.allIds).not.toContain(taskId);
  });
});

// ─── moveTask tool ─────────────────────────────────────────────

describe("AI tool → Yjs → Store: moveTask", () => {
  it("AI moves task from To Do to Done column", () => {
    const { state, doc, wsId, colTodoId, colDoneId, taskId } =
      createWorkspaceWithBoard();

    doc.transact(() => {
      const existing = doc.getMap(YJS_MAP_NAMES.TASKS).get(taskId) as Record<
        string,
        unknown
      >;
      doc.getMap(YJS_MAP_NAMES.TASKS).set(taskId, {
        ...existing,
        column_id: colDoneId,
        position: 0,
      });

      const srcCol = doc.getMap(YJS_MAP_NAMES.COLUMNS).get(colTodoId) as Record<
        string,
        unknown
      >;
      if (srcCol) {
        doc.getMap(YJS_MAP_NAMES.COLUMNS).set(colTodoId, {
          ...JSON.parse(JSON.stringify(srcCol)),
          task_ids: [],
        });
      }

      const dstCol = doc.getMap(YJS_MAP_NAMES.COLUMNS).get(colDoneId) as Record<
        string,
        unknown
      >;
      if (dstCol) {
        doc.getMap(YJS_MAP_NAMES.COLUMNS).set(colDoneId, {
          ...JSON.parse(JSON.stringify(dstCol)),
          task_ids: [taskId],
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.tasks?.byId[taskId]?.column_id).toBe(colDoneId);
    expect(result.columns?.byId[colTodoId]?.task_ids).not.toContain(taskId);
    expect(result.columns?.byId[colDoneId]?.task_ids).toContain(taskId);
  });
});

// ─── createBoard tool ──────────────────────────────────────────

describe("AI tool → Yjs → Store: createBoard", () => {
  it("AI creates a new board in workspace", () => {
    const { state, doc, wsId, boardId } = createWorkspaceWithBoard();
    const newBoardId = `board-ai-new-${_aiToolCounter}`;

    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.BOARDS).set(newBoardId, {
        id: newBoardId,
        name: "Sprint Planning",
        workspace_id: wsId,
        column_ids: [],
        created_by: "ai-assistant",
        created_at: TS,
      });
      doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).set(newBoardId, {
        id: newBoardId,
        x: 500,
        y: 0,
        zIndex: 2,
      });
      const ws = doc.getMap(YJS_MAP_NAMES.WORKSPACE).get(wsId) as Record<
        string,
        unknown
      >;
      if (ws) {
        doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(wsId, {
          ...JSON.parse(JSON.stringify(ws)),
          board_ids: [...(ws.board_ids as string[]), newBoardId],
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.boards?.byId[newBoardId]).toBeDefined();
    expect(result.boards?.byId[newBoardId]?.name).toBe("Sprint Planning");
    expect(result.boards?.byId[boardId]).toBeDefined();
  });
});

// ─── deleteBoard tool ──────────────────────────────────────────

describe("AI tool → Yjs → Store: deleteBoard", () => {
  it("AI deletes board with cascade cleanup", () => {
    const { state, doc, wsId, boardId, colTodoId, colDoneId, taskId } =
      createWorkspaceWithBoard();

    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.BOARDS).delete(boardId);
      doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(colTodoId);
      doc.getMap(YJS_MAP_NAMES.COLUMNS).delete(colDoneId);
      doc.getMap(YJS_MAP_NAMES.TASKS).delete(taskId);
      doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).delete(boardId);

      const ws = doc.getMap(YJS_MAP_NAMES.WORKSPACE).get(wsId) as Record<
        string,
        unknown
      >;
      if (ws) {
        doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(wsId, {
          ...JSON.parse(JSON.stringify(ws)),
          board_ids: [],
        });
      }
    });

    const result = applyYjsToStateWithRepair(doc, state, wsId);
    expect(result.boards?.byId[boardId]).toBeUndefined();
    expect(result.columns?.byId[colTodoId]).toBeUndefined();
    expect(result.columns?.byId[colDoneId]).toBeUndefined();
    expect(result.tasks?.byId[taskId]).toBeUndefined();
  });
});

// ─── bulkUpdateTasks tool ──────────────────────────────────────

describe("AI tool → Yjs → Store: bulkUpdateTasks", () => {
  it("AI bulk-updates priority for multiple tasks", () => {
    const { state, doc, wsId, boardId, colTodoId, taskId } =
      createWorkspaceWithBoard();
    const task2Id = `task-bulk-2-${_aiToolCounter}`;

    // First add second task
    doc.transact(() => {
      doc.getMap(YJS_MAP_NAMES.TASKS).set(task2Id, {
        id: task2Id,
        title: "Task Two",
        board_id: boardId,
        column_id: colTodoId,
        position: 1,
        priority: "low",
        progress: 0,
        status: "todo",
        created_by: "user-1",
        created_at: TS,
        updated_at: TS,
      });
    });

    // Sync to establish metadata
    const stateAfterAdd = applyYjsToStateWithRepair(
      doc,
      state,
      wsId
    ) as KanbanState;

    // Now bulk update both tasks to high priority
    doc.transact(() => {
      for (const id of [taskId, task2Id]) {
        const task = doc.getMap(YJS_MAP_NAMES.TASKS).get(id) as Record<
          string,
          unknown
        >;
        if (task) {
          doc.getMap(YJS_MAP_NAMES.TASKS).set(id, {
            ...task,
            priority: "high",
            updated_at: "2024-01-16T00:00:00.000Z",
          });
        }
      }
    });

    const result = applyYjsToStateWithRepair(doc, stateAfterAdd, wsId);
    expect(result.tasks?.byId[taskId]?.priority).toBe("high");
    expect(result.tasks?.byId[task2Id]?.priority).toBe("high");
  });
});
