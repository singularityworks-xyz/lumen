import { describe, expect, it } from "bun:test";
import type { KanbanState } from "@/src/features/kanban/store/types";
import {
  fixAreaBoardIds,
  fixBoardColumnIds,
  fixColumnTaskIds,
  fixMissingBoardPositions,
  fixOrphanedAreaPositions,
  fixOrphanedBoardPositions,
  fixOrphanedColumns,
  fixOrphanedConnections,
  fixOrphanedTasks,
  needsRepair,
  repairState,
} from "./fixer";

const createMinimalState = (): KanbanState => ({
  areaDialogs: {},
  areaDragOrigins: {},
  areaPositions: { byId: {}, allIds: [] },
  areas: { byId: {}, allIds: [] },
  boardConnections: { byId: {}, allIds: [] },
  boardDialogs: {},
  boardPositions: { byId: {}, allIds: [] },
  boardQuickActions: {},
  boards: { byId: {}, allIds: [] },
  canvas: {
    focusedBoardId: null,
    lastInteractionTime: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  chatMessages: { byId: {}, allIds: [] },
  columnDialogs: {},
  columnQuickActions: {},
  columns: { byId: {}, allIds: [] },
  columnUi: {},
  comments: { byId: {}, allIds: [] },
  connectionDialog: null,
  createTaskModals: {},
  currentWorkspaceId: null,
  deletedSharedWorkspaceId: null,
  dialogFocusStack: [],
  draggedTaskId: null,
  interactionMode: "drag",
  isProfileModalOpen: false,
  lastActiveDrawerTab: "comments",
  lastTaskModalPositions: {},
  selectedBoardId: null,
  selectedBoardIds: [],
  selectedTaskIds: [],
  selectionBox: null,
  shakingTaskDetailModalId: null,
  showCommandPalette: false,
  showMiniMap: false,
  shareDialog: null,
  taskDetailModals: {},
  taskQuickActions: {},
  tasks: { byId: {}, allIds: [] },
  textBoardPositions: { byId: {}, allIds: [] },
  textBoards: { byId: {}, allIds: [] },
  welcomeDismissed: false,
  workspaceDialog: null,
  workspaceQuickActions: null,
  workspaceShareUrls: {},
  workspaces: { byId: {}, allIds: [] },
  isGuestMode: false,
  guestToken: null,
});

describe("fixer", () => {
  describe("fixOrphanedTasks", () => {
    it("removes tasks with non-existent columns", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
            "task-orphaned": {
              id: "task-orphaned",
              board_id: "board-1",
              column_id: "col-missing",
              title: "Orphaned",
              position: 1,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1", "task-orphaned"],
        },
      };

      const result = fixOrphanedTasks(state);

      expect(result.tasks.allIds).toEqual(["task-1"]);
      expect(result.tasks.byId["task-orphaned"]).toBeUndefined();
    });

    it("removes tasks with non-existent boards", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
            "task-board-gone": {
              id: "task-board-gone",
              board_id: "board-missing",
              column_id: "col-1",
              title: "Board Gone",
              position: 1,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1", "task-board-gone"],
        },
      };

      const result = fixOrphanedTasks(state);

      expect(result.tasks.allIds).toEqual(["task-1"]);
      expect(result.tasks.byId["task-board-gone"]).toBeUndefined();
    });

    it("returns original state when no orphans", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1"],
        },
      };

      const result = fixOrphanedTasks(state);

      expect(result.tasks.allIds).toEqual(["task-1"]);
    });
  });

  describe("fixOrphanedColumns", () => {
    it("removes columns with non-existent boards", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
            "col-orphaned": {
              id: "col-orphaned",
              board_id: "board-missing",
              name: "Orphaned",
              position: 1,
              task_ids: [],
            },
          },
          allIds: ["col-1", "col-orphaned"],
        },
      };

      const result = fixOrphanedColumns(state);

      expect(result.columns.allIds).toEqual(["col-1"]);
      expect(result.columns.byId["col-orphaned"]).toBeUndefined();
    });
  });

  describe("fixOrphanedBoardPositions", () => {
    it("removes positions for non-existent boards", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        boardPositions: {
          byId: {
            "board-1": { id: "board-1", x: 100, y: 100, zIndex: 1 },
            "pos-orphaned": { id: "board-missing", x: 200, y: 200, zIndex: 2 },
          },
          allIds: ["board-1", "pos-orphaned"],
        },
      };

      const result = fixOrphanedBoardPositions(state);

      expect(result.boardPositions.allIds).toEqual(["board-1"]);
      expect(result.boardPositions.byId["pos-orphaned"]).toBeUndefined();
    });
  });

  describe("fixOrphanedConnections", () => {
    it("removes connections referencing non-existent boards", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
            "board-2": {
              id: "board-2",
              name: "B2",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1", "board-2"],
        },
        boardConnections: {
          byId: {
            "conn-1": {
              id: "conn-1",
              source_board_id: "board-1",
              target_board_id: "board-2",
              sourceHandle: "right" as const,
              targetHandle: "left" as const,
              lineStyle: "solid" as const,
              showArrow: true,
              created_at: "2024-01-01",
            },
            "conn-orphaned": {
              id: "conn-orphaned",
              source_board_id: "board-1",
              target_board_id: "board-missing",
              sourceHandle: "right" as const,
              targetHandle: "left" as const,
              lineStyle: "solid" as const,
              showArrow: true,
              created_at: "2024-01-01",
            },
          },
          allIds: ["conn-1", "conn-orphaned"],
        },
      };

      const result = fixOrphanedConnections(state);

      expect(result.boardConnections.allIds).toEqual(["conn-1"]);
      expect(result.boardConnections.byId["conn-orphaned"]).toBeUndefined();
    });
  });

  describe("fixOrphanedAreaPositions", () => {
    it("removes positions for non-existent areas", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        areas: {
          byId: {
            "area-1": {
              id: "area-1",
              name: "A1",
              workspace_id: "ws-1",
              color: "#fff",
              board_ids: [],
              created_at: "2024-01-01",
            },
          },
          allIds: ["area-1"],
        },
        areaPositions: {
          byId: {
            "area-1": {
              id: "area-1",
              x: 100,
              y: 100,
              width: 200,
              height: 200,
              zIndex: 1,
            },
            "pos-orphaned": {
              id: "area-missing",
              x: 200,
              y: 200,
              width: 200,
              height: 200,
              zIndex: 2,
            },
          },
          allIds: ["area-1", "pos-orphaned"],
        },
      };

      const result = fixOrphanedAreaPositions(state);

      expect(result.areaPositions.allIds).toEqual(["area-1"]);
      expect(result.areaPositions.byId["pos-orphaned"]).toBeUndefined();
    });
  });

  describe("fixColumnTaskIds", () => {
    it("removes non-existent task IDs from column task_ids array", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: ["col-1"],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: ["task-1", "task-missing", "task-2"],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
            "task-2": {
              id: "task-2",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 2",
              position: 1,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1", "task-2"],
        },
      };

      const result = fixColumnTaskIds(state);

      expect(result.columns.byId["col-1"]?.task_ids).toEqual([
        "task-1",
        "task-2",
      ]);
    });
  });

  describe("fixBoardColumnIds", () => {
    it("removes non-existent column IDs from board column_ids array", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: ["col-1", "col-missing", "col-2"],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
            "col-2": {
              id: "col-2",
              board_id: "board-1",
              name: "C2",
              position: 1,
              task_ids: [],
            },
          },
          allIds: ["col-1", "col-2"],
        },
      };

      const result = fixBoardColumnIds(state);

      expect(result.boards.byId["board-1"]?.column_ids).toEqual([
        "col-1",
        "col-2",
      ]);
    });
  });

  describe("fixAreaBoardIds", () => {
    it("removes non-existent board IDs from area board_ids array", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
            "board-2": {
              id: "board-2",
              name: "B2",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1", "board-2"],
        },
        areas: {
          byId: {
            "area-1": {
              id: "area-1",
              name: "A1",
              workspace_id: "ws-1",
              color: "#fff",
              board_ids: ["board-1", "board-missing", "board-2"],
              created_at: "2024-01-01",
            },
          },
          allIds: ["area-1"],
        },
      };

      const result = fixAreaBoardIds(state);

      expect(result.areas.byId["area-1"]?.board_ids).toEqual([
        "board-1",
        "board-2",
      ]);
    });
  });

  describe("fixMissingBoardPositions", () => {
    it("synthesizes missing board positions deterministically", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
            "board-2": {
              id: "board-2",
              name: "B2",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1", "board-2"],
        },
        boardPositions: {
          byId: {},
          allIds: [],
        },
      };

      const result = fixMissingBoardPositions(state);

      expect(result.boardPositions.allIds).toContain("board-1");
      expect(result.boardPositions.allIds).toContain("board-2");
      expect(result.boardPositions.byId["board-1"]?.x).toBe(100);
      expect(result.boardPositions.byId["board-2"]?.x).toBe(500);
      expect(result.boardPositions.byId["board-1"]?.zIndex).toBe(1);
      expect(result.boardPositions.byId["board-2"]?.zIndex).toBe(2);
    });
  });

  describe("repairState", () => {
    it("runs all fixers in correct order", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: ["col-1"],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: ["task-1"],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1"],
        },
        boardPositions: { byId: {}, allIds: [] },
      };

      const result = repairState(state);

      expect(result.boardPositions.byId["board-1"]).toBeDefined();
    });
  });

  describe("needsRepair", () => {
    it("returns false for consistent state", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: ["col-1"],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: ["task-1"],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1"],
        },
        boardPositions: {
          byId: { "board-1": { id: "board-1", x: 100, y: 100, zIndex: 1 } },
          allIds: ["board-1"],
        },
      };

      const result = needsRepair(state);

      expect(result).toBe(false);
    });

    it("returns true when orphaned columns exist", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-orphaned": {
              id: "col-orphaned",
              board_id: "board-missing",
              name: "C1",
              position: 0,
              task_ids: [],
            },
          },
          allIds: ["col-orphaned"],
        },
        tasks: { byId: {}, allIds: [] },
        boardPositions: { byId: {}, allIds: [] },
      };

      const result = needsRepair(state);

      expect(result).toBe(true);
    });

    it("returns true when orphaned tasks exist", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: [],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-orphaned": {
              id: "task-orphaned",
              board_id: "board-missing",
              column_id: "col-missing",
              title: "Orphaned",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-orphaned"],
        },
        boardPositions: { byId: {}, allIds: [] },
      };

      const result = needsRepair(state);

      expect(result).toBe(true);
    });

    it("returns true when board positions are missing", () => {
      const state: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        columns: { byId: {}, allIds: [] },
        tasks: { byId: {}, allIds: [] },
        boardPositions: { byId: {}, allIds: [] },
      };

      const result = needsRepair(state);

      expect(result).toBe(true);
    });

    it("returns true only for genuinely inconsistent state", () => {
      const consistentState: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "B1",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: ["col-1"],
            },
            "board-2": {
              id: "board-2",
              name: "B2",
              workspace_id: "ws-1",
              created_by: "u1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1", "board-2"],
        },
        columns: {
          byId: {
            "col-1": {
              id: "col-1",
              board_id: "board-1",
              name: "C1",
              position: 0,
              task_ids: ["task-1"],
            },
          },
          allIds: ["col-1"],
        },
        tasks: {
          byId: {
            "task-1": {
              id: "task-1",
              board_id: "board-1",
              column_id: "col-1",
              title: "Task 1",
              position: 0,
              priority: "medium" as const,
              progress: 0,
              status: "todo" as const,
              created_by: "u1",
              created_at: "2024-01-01",
              updated_at: "2024-01-01",
            },
          },
          allIds: ["task-1"],
        },
        boardPositions: {
          byId: {
            "board-1": { id: "board-1", x: 100, y: 100, zIndex: 1 },
            "board-2": { id: "board-2", x: 500, y: 100, zIndex: 2 },
          },
          allIds: ["board-1", "board-2"],
        },
      };

      const result = needsRepair(consistentState);

      expect(result).toBe(false);
    });
  });
});
