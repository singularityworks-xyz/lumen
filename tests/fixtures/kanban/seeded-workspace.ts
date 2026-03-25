import type {
  Area,
  Board,
  BoardConnection,
  BoardPosition,
  Column,
  Task,
  Workspace,
} from "../../../apps/web/src/features/kanban/types";

const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

interface SeededWorkspaceState {
  areas: Record<string, Area>;
  boardConnections: Record<string, BoardConnection>;
  boardPositions: Record<string, BoardPosition>;
  boards: Record<string, Board>;
  columns: Record<string, Column>;
  tasks: Record<string, Task>;
  workspaces: Record<string, Workspace>;
}

export function seedWorkspace(): SeededWorkspaceState {
  const workspace: Workspace = {
    id: "ws-1",
    name: "Test Workspace",
    description: "Seeded test workspace",
    created_at: FROZEN_TIMESTAMP,
    board_ids: ["board-1", "board-2"],
  };

  const board1: Board = {
    id: "board-1",
    name: "Board One",
    workspace_id: "ws-1",
    column_ids: ["col-1-1", "col-1-2", "col-1-3"],
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
  };

  const board2: Board = {
    id: "board-2",
    name: "Board Two",
    workspace_id: "ws-1",
    column_ids: ["col-2-1", "col-2-2", "col-2-3"],
    created_by: "test-user",
    created_at: FROZEN_TIMESTAMP,
  };

  const columns: Record<string, Column> = {
    "col-1-1": {
      id: "col-1-1",
      board_id: "board-1",
      name: "To Do",
      position: 0,
      task_ids: ["task-1", "task-2"],
    },
    "col-1-2": {
      id: "col-1-2",
      board_id: "board-1",
      name: "In Progress",
      position: 1,
      task_ids: ["task-3"],
    },
    "col-1-3": {
      id: "col-1-3",
      board_id: "board-1",
      name: "Done",
      position: 2,
      task_ids: ["task-4"],
    },
    "col-2-1": {
      id: "col-2-1",
      board_id: "board-2",
      name: "Backlog",
      position: 0,
      task_ids: ["task-5"],
    },
    "col-2-2": {
      id: "col-2-2",
      board_id: "board-2",
      name: "Active",
      position: 1,
      task_ids: [],
    },
    "col-2-3": {
      id: "col-2-3",
      board_id: "board-2",
      name: "Closed",
      position: 2,
      task_ids: [],
    },
  };

  const tasks: Record<string, Task> = {
    "task-1": {
      id: "task-1",
      title: "First task",
      board_id: "board-1",
      column_id: "col-1-1",
      position: 0,
      priority: "high",
      progress: 0,
      status: "todo",
      created_by: "test-user",
      created_at: FROZEN_TIMESTAMP,
      updated_at: FROZEN_TIMESTAMP,
    },
    "task-2": {
      id: "task-2",
      title: "Second task",
      board_id: "board-1",
      column_id: "col-1-1",
      position: 1,
      priority: "medium",
      progress: 0,
      status: "todo",
      created_by: "test-user",
      created_at: FROZEN_TIMESTAMP,
      updated_at: FROZEN_TIMESTAMP,
    },
    "task-3": {
      id: "task-3",
      title: "Third task",
      board_id: "board-1",
      column_id: "col-1-2",
      position: 0,
      priority: "low",
      progress: 50,
      status: "todo",
      created_by: "test-user",
      created_at: FROZEN_TIMESTAMP,
      updated_at: FROZEN_TIMESTAMP,
    },
    "task-4": {
      id: "task-4",
      title: "Fourth task",
      board_id: "board-1",
      column_id: "col-1-3",
      position: 0,
      priority: "medium",
      progress: 100,
      status: "done",
      created_by: "test-user",
      created_at: FROZEN_TIMESTAMP,
      updated_at: FROZEN_TIMESTAMP,
    },
    "task-5": {
      id: "task-5",
      title: "Fifth task",
      board_id: "board-2",
      column_id: "col-2-1",
      position: 0,
      priority: "high",
      progress: 0,
      status: "todo",
      created_by: "test-user",
      created_at: FROZEN_TIMESTAMP,
      updated_at: FROZEN_TIMESTAMP,
    },
  };

  const boardPositions: Record<string, BoardPosition> = {
    "board-1": {
      id: "board-1",
      x: 0,
      y: 0,
      zIndex: 1,
      width: 600,
      height: 400,
    },
    "board-2": {
      id: "board-2",
      x: 700,
      y: 0,
      zIndex: 2,
      width: 600,
      height: 400,
    },
  };

  const boardConnections: Record<string, BoardConnection> = {
    "conn-1": {
      id: "conn-1",
      source_board_id: "board-1",
      target_board_id: "board-2",
      sourceHandle: "right",
      targetHandle: "left",
      lineStyle: "solid",
      showArrow: true,
      created_at: FROZEN_TIMESTAMP,
    },
  };

  const areas: Record<string, Area> = {
    "area-1": {
      id: "area-1",
      name: "Development",
      workspace_id: "ws-1",
      board_ids: ["board-1"],
      color: "#3b82f6",
      created_at: FROZEN_TIMESTAMP,
    },
  };

  return {
    workspaces: { "ws-1": workspace },
    boards: { "board-1": board1, "board-2": board2 },
    columns,
    tasks,
    boardPositions,
    boardConnections,
    areas,
  };
}
