import { describe, expect, it } from "bun:test";
import { Doc } from "yjs";

import { YJS_MAP_NAMES } from "./entity-sync";
import {
  allSyncs,
  areaDialogSync,
  areaDragOriginSync,
  areaPositionSync,
  areaSync,
  boardConnectionSync,
  boardDialogSync,
  boardPositionSync,
  boardQuickActionsSync,
  boardSync,
  chatMessageSync,
  columnDialogSync,
  columnQuickActionsSync,
  columnSync,
  commentSync,
  connectionDialogSync,
  createTaskModalSync,
  taskDetailModalSync,
  taskQuickActionsSync,
  taskSync,
  workspaceSync,
} from "./syncs";

describe("syncs", () => {
  describe("configured sync map names", () => {
    interface SyncTestCase {
      expectedMap: string;
      name: string;
      sync: {
        setInYjs: (doc: Doc, entity: { id: string }) => void;
        applyFromYjs: (yMap: unknown) => {
          byId: Record<string, { id: string }>;
          allIds: string[];
        };
      };
    }

    const syncMapPairs: SyncTestCase[] = [
      { name: "boardSync", sync: boardSync, expectedMap: YJS_MAP_NAMES.BOARDS },
      {
        name: "workspaceSync",
        sync: workspaceSync,
        expectedMap: YJS_MAP_NAMES.WORKSPACE,
      },
      {
        name: "columnSync",
        sync: columnSync,
        expectedMap: YJS_MAP_NAMES.COLUMNS,
      },
      { name: "taskSync", sync: taskSync, expectedMap: YJS_MAP_NAMES.TASKS },
      {
        name: "boardPositionSync",
        sync: boardPositionSync,
        expectedMap: YJS_MAP_NAMES.BOARD_POSITIONS,
      },
      {
        name: "boardConnectionSync",
        sync: boardConnectionSync,
        expectedMap: YJS_MAP_NAMES.BOARD_CONNECTIONS,
      },
      { name: "areaSync", sync: areaSync, expectedMap: YJS_MAP_NAMES.AREAS },
      {
        name: "areaPositionSync",
        sync: areaPositionSync,
        expectedMap: YJS_MAP_NAMES.AREA_POSITIONS,
      },
      {
        name: "areaDialogSync",
        sync: areaDialogSync,
        expectedMap: YJS_MAP_NAMES.AREA_DIALOGS,
      },
      {
        name: "boardQuickActionsSync",
        sync: boardQuickActionsSync,
        expectedMap: YJS_MAP_NAMES.BOARD_QUICK_ACTIONS,
      },
      {
        name: "boardDialogSync",
        sync: boardDialogSync,
        expectedMap: YJS_MAP_NAMES.BOARD_DIALOGS,
      },
      {
        name: "connectionDialogSync",
        sync: connectionDialogSync,
        expectedMap: YJS_MAP_NAMES.CONNECTION_DIALOGS,
      },
      {
        name: "createTaskModalSync",
        sync: createTaskModalSync,
        expectedMap: YJS_MAP_NAMES.CREATE_TASK_MODALS,
      },
      {
        name: "columnQuickActionsSync",
        sync: columnQuickActionsSync,
        expectedMap: YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS,
      },
      {
        name: "columnDialogSync",
        sync: columnDialogSync,
        expectedMap: YJS_MAP_NAMES.COLUMN_DIALOGS,
      },
      {
        name: "taskQuickActionsSync",
        sync: taskQuickActionsSync,
        expectedMap: YJS_MAP_NAMES.TASK_QUICK_ACTIONS,
      },
      {
        name: "taskDetailModalSync",
        sync: taskDetailModalSync,
        expectedMap: YJS_MAP_NAMES.TASK_DETAIL_MODALS,
      },
      {
        name: "areaDragOriginSync",
        sync: areaDragOriginSync,
        expectedMap: YJS_MAP_NAMES.AREA_DRAG_ORIGINS,
      },
      {
        name: "commentSync",
        sync: commentSync,
        expectedMap: YJS_MAP_NAMES.COMMENTS,
      },
      {
        name: "chatMessageSync",
        sync: chatMessageSync,
        expectedMap: YJS_MAP_NAMES.CHAT_MESSAGES,
      },
    ];

    it.each(syncMapPairs)("$name uses map name '$expectedMap'", ({
      sync,
      expectedMap,
    }) => {
      const doc = new Doc();
      const entity = createValidEntityForMap(expectedMap);
      if (entity) {
        sync.setInYjs(doc, entity);
        const yMap = doc.getMap(expectedMap);
        expect(yMap.size).toBe(1);
        expect(yMap.has(entity.id)).toBe(true);
      }
    });

    it("allSyncs contains all 20 entity types", () => {
      expect(Object.keys(allSyncs)).toHaveLength(20);
    });
  });

  describe("dialog and modal syncs reject malformed data", () => {
    it("areaDialogSync skips data missing required fields", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.AREA_DIALOGS);

      doc.transact(() => {
        yMap.set("bad-1", { id: "bad-1" });
        yMap.set("bad-2", { id: "bad-2", areaId: "a1" });
      });

      const result = areaDialogSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
      expect(Object.keys(result.byId)).toHaveLength(0);
    });

    it("boardDialogSync skips data with invalid type enum", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.BOARD_DIALOGS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "bd-1",
          type: "invalid-type",
          boardId: "b1",
          boardName: "Board",
          position: { x: 0, y: 0 },
          zIndex: 1,
        });
      });

      const result = boardDialogSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("connectionDialogSync skips data missing boardId", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.CONNECTION_DIALOGS);

      doc.transact(() => {
        yMap.set("bad-1", { id: "cd-1", position: { x: 0, y: 0 } });
      });

      const result = connectionDialogSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("createTaskModalSync skips data missing required formData", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.CREATE_TASK_MODALS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "ctm-1",
          boardId: "b1",
          columnId: "c1",
          position: { x: 0, y: 0 },
          zIndex: 1,
        });
      });

      const result = createTaskModalSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("columnDialogSync skips data with invalid type enum", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.COLUMN_DIALOGS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "col-d-1",
          type: "invalid",
          columnId: "c1",
          columnName: "Col",
          boardId: "b1",
          boardName: "Board",
          position: { x: 0, y: 0 },
        });
      });

      const result = columnDialogSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("taskDetailModalSync skips data missing taskId", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.TASK_DETAIL_MODALS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "tdm-1",
          boardId: "b1",
          position: { x: 0, y: 0 },
          zIndex: 1,
          sourceTaskId: "t1",
        });
      });

      const result = taskDetailModalSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("taskQuickActionsSync skips data missing position", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.TASK_QUICK_ACTIONS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "tqa-1",
          taskId: "t1",
          boardId: "b1",
          columnId: "c1",
        });
      });

      const result = taskQuickActionsSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("columnQuickActionsSync skips data with wrong showAddTask type", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS);

      doc.transact(() => {
        yMap.set("bad-1", {
          id: "cqa-1",
          columnId: "c1",
          boardId: "b1",
          showAddTask: "yes",
          position: { x: 0, y: 0 },
        });
      });

      const result = columnQuickActionsSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });

    it("boardQuickActionsSync skips data missing boardId", () => {
      const doc = new Doc();
      const yMap = doc.getMap(YJS_MAP_NAMES.BOARD_QUICK_ACTIONS);

      doc.transact(() => {
        yMap.set("bad-1", { id: "bqa-1", position: { x: 0, y: 0 } });
      });

      const result = boardQuickActionsSync.applyFromYjs(yMap);
      expect(result.allIds).toHaveLength(0);
    });
  });

  describe("entity syncs accept valid data", () => {
    it("boardSync round-trips a valid board through Yjs", () => {
      const doc = new Doc();
      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2025-01-01T00:00:00Z",
        column_ids: ["col-1"],
      };

      boardSync.setInYjs(doc, board);
      const result = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));

      expect(result.allIds).toContain("board-1");
      expect(result.byId["board-1"]!.name).toBe("Test Board");
    });

    it("taskSync round-trips a valid task through Yjs", () => {
      const doc = new Doc();
      const task = {
        id: "task-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Test Task",
        priority: "medium",
        progress: 50,
        position: 0,
        created_by: "user-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        status: "todo",
      };

      taskSync.setInYjs(doc, task);
      const result = taskSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.TASKS));

      expect(result.allIds).toContain("task-1");
      expect(result.byId["task-1"]!.title).toBe("Test Task");
    });

    it("boardDialogSync accepts valid dialog with proper type", () => {
      const doc = new Doc();
      const dialog = {
        id: "bd-1",
        type: "rename" as const,
        boardId: "b1",
        boardName: "Board",
        position: { x: 10, y: 20 },
        zIndex: 1,
      };

      boardDialogSync.setInYjs(doc, dialog);
      const result = boardDialogSync.applyFromYjs(
        doc.getMap(YJS_MAP_NAMES.BOARD_DIALOGS)
      );

      expect(result.allIds).toContain("bd-1");
      expect(result.byId["bd-1"]!.type).toBe("rename");
    });
  });

  describe("batchSetInYjs and deleteFromYjs", () => {
    it("batchSetInYjs sets multiple entities at once", () => {
      const doc = new Doc();
      const boards = [
        {
          id: "b1",
          name: "Board 1",
          workspace_id: "ws-1",
          created_by: "u1",
          created_at: "2025-01-01",
          column_ids: [],
        },
        {
          id: "b2",
          name: "Board 2",
          workspace_id: "ws-1",
          created_by: "u1",
          created_at: "2025-01-01",
          column_ids: [],
        },
      ];

      boardSync.batchSetInYjs(doc, boards);
      const result = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));

      expect(result.allIds).toHaveLength(2);
      expect(result.byId.b1!.name).toBe("Board 1");
      expect(result.byId.b2!.name).toBe("Board 2");
    });

    it("deleteFromYjs removes entity from Y.Map", () => {
      const doc = new Doc();
      const board = {
        id: "b1",
        name: "Board 1",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2025-01-01",
        column_ids: [],
      };

      boardSync.setInYjs(doc, board);
      boardSync.deleteFromYjs(doc, "b1");

      const result = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));
      expect(result.allIds).toHaveLength(0);
    });

    it("initializeYjs seeds empty map but skips non-empty map", () => {
      const doc = new Doc();
      const existingBoard = {
        id: "existing",
        name: "Existing",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2025-01-01",
        column_ids: [],
      };
      boardSync.setInYjs(doc, existingBoard);

      const entityMap = {
        byId: {
          "new-1": {
            id: "new-1",
            name: "New",
            workspace_id: "ws-1",
            created_by: "u1",
            created_at: "2025-01-01",
            column_ids: [],
          },
        },
        allIds: ["new-1"],
      };

      boardSync.initializeYjs(doc, entityMap);
      const result = boardSync.applyFromYjs(doc.getMap(YJS_MAP_NAMES.BOARDS));

      expect(result.allIds).toContain("existing");
      expect(result.allIds).not.toContain("new-1");
    });
  });
});

function createValidEntityForMap(mapName: string): { id: string } | null {
  switch (mapName) {
    case YJS_MAP_NAMES.BOARDS:
      return {
        id: "b1",
        name: "Board",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2025-01-01",
        column_ids: [],
      };
    case YJS_MAP_NAMES.WORKSPACE:
      return {
        id: "ws-1",
        name: "Workspace",
        created_at: "2025-01-01",
        board_ids: [],
      };
    case YJS_MAP_NAMES.COLUMNS:
      return {
        id: "c1",
        board_id: "b1",
        name: "Col",
        position: 0,
        task_ids: [],
      };
    case YJS_MAP_NAMES.TASKS:
      return {
        id: "t1",
        board_id: "b1",
        column_id: "c1",
        title: "Task",
        priority: "medium",
        progress: 0,
        position: 0,
        created_by: "u1",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
        status: "todo",
      };
    case YJS_MAP_NAMES.BOARD_POSITIONS:
      return { id: "b1", x: 0, y: 0, zIndex: 1 };
    case YJS_MAP_NAMES.BOARD_CONNECTIONS:
      return {
        id: "bc1",
        source_board_id: "b1",
        target_board_id: "b2",
        lineStyle: "solid",
        sourceHandle: "right",
        targetHandle: "left",
        showArrow: true,
        created_at: "2025-01-01",
      };
    case YJS_MAP_NAMES.AREAS:
      return {
        id: "a1",
        name: "Area",
        workspace_id: "ws-1",
        color: "#fff",
        board_ids: [],
        created_at: "2025-01-01",
      };
    case YJS_MAP_NAMES.AREA_POSITIONS:
      return { id: "a1", x: 0, y: 0, width: 100, height: 100, zIndex: 1 };
    case YJS_MAP_NAMES.AREA_DIALOGS:
      return {
        id: "ad1",
        areaId: "a1",
        areaName: "Area",
        position: { x: 0, y: 0 },
      };
    case YJS_MAP_NAMES.BOARD_QUICK_ACTIONS:
      return { id: "bqa1", boardId: "b1", position: { x: 0, y: 0 } };
    case YJS_MAP_NAMES.BOARD_DIALOGS:
      return {
        id: "bd1",
        type: "rename",
        boardId: "b1",
        boardName: "Board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      };
    case YJS_MAP_NAMES.CONNECTION_DIALOGS:
      return { id: "cd1", boardId: "b1", position: { x: 0, y: 0 } };
    case YJS_MAP_NAMES.CREATE_TASK_MODALS:
      return {
        id: "ctm1",
        boardId: "b1",
        columnId: "c1",
        position: { x: 0, y: 0 },
        zIndex: 1,
        formData: {
          title: "",
          description: "",
          priority: "medium",
          progress: 0,
          dueDate: "",
          tags: "",
        },
      };
    case YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS:
      return {
        id: "cqa1",
        columnId: "c1",
        boardId: "b1",
        showAddTask: true,
        position: { x: 0, y: 0 },
      };
    case YJS_MAP_NAMES.COLUMN_DIALOGS:
      return {
        id: "colD1",
        type: "rename",
        columnId: "c1",
        columnName: "Col",
        boardId: "b1",
        boardName: "Board",
        position: { x: 0, y: 0 },
      };
    case YJS_MAP_NAMES.TASK_QUICK_ACTIONS:
      return {
        id: "tqa1",
        taskId: "t1",
        boardId: "b1",
        columnId: "c1",
        position: { x: 0, y: 0 },
      };
    case YJS_MAP_NAMES.TASK_DETAIL_MODALS:
      return {
        id: "tdm1",
        taskId: "t1",
        boardId: "b1",
        position: { x: 0, y: 0 },
        zIndex: 1,
        sourceTaskId: "t1",
      };
    case YJS_MAP_NAMES.AREA_DRAG_ORIGINS:
      return { id: "ado1", originX: 0, originY: 0 };
    case YJS_MAP_NAMES.COMMENTS:
      return {
        id: "cm1",
        x: 0,
        y: 0,
        content: "Hello",
        authorId: "u1",
        workspaceId: "ws-1",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
      };
    case YJS_MAP_NAMES.CHAT_MESSAGES:
      return {
        id: "chm1",
        content: "Hello",
        authorId: "u1",
        authorName: "User",
        workspaceId: "ws-1",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
      };
    default:
      return null;
  }
}
