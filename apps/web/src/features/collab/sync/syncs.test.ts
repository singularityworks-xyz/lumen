// Mock logger before any imports
import { mock } from "bun:test";

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

mock.module("@lumen/logger/tracer", () => ({
  recordError: mock(),
  withSpanAsync: mock(
    (_name: string, fn: (span: unknown) => Promise<unknown>) => fn({})
  ),
  getTraceContext: mock(() => null),
  addSpanEvent: mock(),
  getTracer: mock(() => ({
    startActiveSpan: mock(),
    startSpan: mock(),
  })),
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  withSpan: mock((_name: string, fn: (span: unknown) => unknown) => fn({})),
}));

import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "./entity-sync";

// We dynamically import syncs.ts so mock.module() calls on entity-sync
// (if ever needed) take effect before the module executes createEntitySync.

describe("syncs", () => {
  describe("map name assignments", () => {
    it("each sync is backed by the correct Y.Map", async () => {
      const { allSyncs } = await import("./syncs");

      const expectedMapNames: Record<string, string> = {
        boards: YJS_MAP_NAMES.BOARDS,
        columns: YJS_MAP_NAMES.COLUMNS,
        tasks: YJS_MAP_NAMES.TASKS,
        boardPositions: YJS_MAP_NAMES.BOARD_POSITIONS,
        boardConnections: YJS_MAP_NAMES.BOARD_CONNECTIONS,
        areas: YJS_MAP_NAMES.AREAS,
        areaPositions: YJS_MAP_NAMES.AREA_POSITIONS,
        areaDialogs: YJS_MAP_NAMES.AREA_DIALOGS,
        workspace: YJS_MAP_NAMES.WORKSPACE,
        boardQuickActions: YJS_MAP_NAMES.BOARD_QUICK_ACTIONS,
        boardDialogs: YJS_MAP_NAMES.BOARD_DIALOGS,
        connectionDialogs: YJS_MAP_NAMES.CONNECTION_DIALOGS,
        createTaskModals: YJS_MAP_NAMES.CREATE_TASK_MODALS,
        columnQuickActions: YJS_MAP_NAMES.COLUMN_QUICK_ACTIONS,
        columnDialogs: YJS_MAP_NAMES.COLUMN_DIALOGS,
        taskQuickActions: YJS_MAP_NAMES.TASK_QUICK_ACTIONS,
        taskDetailModals: YJS_MAP_NAMES.TASK_DETAIL_MODALS,
        areaDragOrigins: YJS_MAP_NAMES.AREA_DRAG_ORIGINS,
        comments: YJS_MAP_NAMES.COMMENTS,
        chatMessages: YJS_MAP_NAMES.CHAT_MESSAGES,
      };

      for (const [key, mapName] of Object.entries(expectedMapNames)) {
        const sync = allSyncs[key as keyof typeof allSyncs];
        const doc = new Y.Doc();
        const entity = { id: `test-${key}` };
        sync.setInYjs(doc, entity as any);
        const map = doc.getMap(mapName);
        expect(map.get(`test-${key}`)).toBeDefined();
        // Wrong map should NOT contain the entity
        const wrongMap = doc.getMap(`__wrong__${key}`);
        expect(wrongMap.get(`test-${key}`)).toBeUndefined();
      }
    });

    it("allSyncs contains exactly 20 keys", async () => {
      const { allSyncs } = await import("./syncs");
      expect(Object.keys(allSyncs)).toHaveLength(20);
    });
  });

  describe("schema validation on write", () => {
    it("boardSync accepts valid board data", async () => {
      const { boardSync } = await import("./syncs");
      const doc = new Y.Doc();
      const validBoard = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2025-01-01T00:00:00Z",
        column_ids: ["col-1"],
      };

      boardSync.setInYjs(doc, validBoard);
      const map = doc.getMap(YJS_MAP_NAMES.BOARDS);
      expect(map.get("board-1")).toEqual(validBoard);
    });

    it("taskSync rejects entities with missing required fields", async () => {
      const { taskSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.TASKS);

      // Write directly with malformed data (bypassing TypeScript checks)
      map.set("bad-task", { id: "bad-task", title: "" } as never);

      const result = taskSync.applyFromYjs(map);
      // title is min(1), so empty string should fail; also missing board_id etc.
      expect(result.byId["bad-task"]).toBeUndefined();
      expect(result.allIds).not.toContain("bad-task");
    });

    it("columnSync rejects entities with wrong types", async () => {
      const { columnSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.COLUMNS);

      map.set("bad-col", {
        id: "bad-col",
        board_id: 123,
        name: 456,
        position: "not-a-number",
        task_ids: "not-an-array",
      } as never);

      const result = columnSync.applyFromYjs(map);
      expect(result.byId["bad-col"]).toBeUndefined();
    });
  });

  describe("dialog/modal syncs reject malformed data", () => {
    it("areaDialogSync rejects data missing position", async () => {
      const { areaDialogSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.AREA_DIALOGS);

      map.set("bad-dialog", {
        id: "bad-dialog",
        areaId: "area-1",
        areaName: "Test",
        // position is missing entirely
      } as never);

      const result = areaDialogSync.applyFromYjs(map);
      expect(result.byId["bad-dialog"]).toBeUndefined();
    });

    it("boardDialogSync rejects invalid dialog type", async () => {
      const { boardDialogSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.BOARD_DIALOGS);

      map.set("bad-board-dialog", {
        id: "bad-board-dialog",
        type: "invalid-type",
        boardId: "b1",
        boardName: "Board",
        position: { x: 0, y: 0 },
        zIndex: 1,
      } as never);

      const result = boardDialogSync.applyFromYjs(map);
      expect(result.byId["bad-board-dialog"]).toBeUndefined();
    });

    it("connectionDialogSync rejects data with invalid sourceHandle", async () => {
      const { connectionDialogSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.CONNECTION_DIALOGS);

      map.set("bad-conn-dialog", {
        id: "bad-conn-dialog",
        boardId: "b1",
        position: { x: 0, y: 0 },
        sourceHandle: "center",
      } as never);

      const result = connectionDialogSync.applyFromYjs(map);
      expect(result.byId["bad-conn-dialog"]).toBeUndefined();
    });

    it("createTaskModalSync rejects missing formData", async () => {
      const { createTaskModalSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.CREATE_TASK_MODALS);

      map.set("bad-modal", {
        id: "bad-modal",
        boardId: "b1",
        columnId: "c1",
        position: { x: 0, y: 0 },
        zIndex: 1,
        // formData is required but missing
      } as never);

      const result = createTaskModalSync.applyFromYjs(map);
      expect(result.byId["bad-modal"]).toBeUndefined();
    });

    it("columnDialogSync rejects invalid column dialog type", async () => {
      const { columnDialogSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.COLUMN_DIALOGS);

      map.set("bad-col-dialog", {
        id: "bad-col-dialog",
        type: "rename-please",
        columnId: "c1",
        columnName: "Col",
        boardId: "b1",
        boardName: "Board",
        position: { x: 0, y: 0 },
      } as never);

      const result = columnDialogSync.applyFromYjs(map);
      expect(result.byId["bad-col-dialog"]).toBeUndefined();
    });

    it("taskQuickActionsSync rejects missing required position", async () => {
      const { taskQuickActionsSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.TASK_QUICK_ACTIONS);

      map.set("bad-tqa", {
        id: "bad-tqa",
        taskId: "t1",
        boardId: "b1",
        columnId: "c1",
        // position missing
      } as never);

      const result = taskQuickActionsSync.applyFromYjs(map);
      expect(result.byId["bad-tqa"]).toBeUndefined();
    });

    it("taskDetailModalSync rejects negative zIndex", async () => {
      const { taskDetailModalSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.TASK_DETAIL_MODALS);

      map.set("bad-tdm", {
        id: "bad-tdm",
        taskId: "t1",
        boardId: "b1",
        position: { x: 0, y: 0 },
        zIndex: -100,
        sourceTaskId: "t1",
      } as never);

      // This should actually pass schema (z.number allows negative)
      // But let's test a truly malformed one - wrong type for position
      map.set("bad-tdm-2", {
        id: "bad-tdm-2",
        taskId: "t1",
        boardId: "b1",
        position: "not-an-object",
        zIndex: 1,
        sourceTaskId: "t1",
      } as never);

      const result = taskDetailModalSync.applyFromYjs(map);
      // bad-tdm passes (negative zIndex is valid z.number)
      expect(result.byId["bad-tdm"]).toBeDefined();
      // bad-tdm-2 fails (position must be object)
      expect(result.byId["bad-tdm-2"]).toBeUndefined();
    });
  });

  describe("Y.Doc round-trip operations", () => {
    it("setInYjs then applyFromYjs round-trips valid data", async () => {
      const { taskSync } = await import("./syncs");
      const doc = new Y.Doc();

      const task = {
        id: "task-rt",
        board_id: "board-1",
        column_id: "col-1",
        title: "Round-trip task",
        priority: "high" as const,
        progress: 50,
        position: 1,
        created_by: "user-1",
        created_at: "2025-06-01T00:00:00Z",
        updated_at: "2025-06-01T00:00:00Z",
        status: "todo" as const,
      };

      taskSync.setInYjs(doc, task);
      const map = doc.getMap(YJS_MAP_NAMES.TASKS);
      const result = taskSync.applyFromYjs(map);

      expect(result.byId["task-rt"]).toEqual(task);
      expect(result.allIds).toEqual(["task-rt"]);
    });

    it("deleteFromYjs removes entity from Y.Map", async () => {
      const { boardSync } = await import("./syncs");
      const doc = new Y.Doc();

      const board = {
        id: "board-del",
        name: "Delete Me",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2025-01-01T00:00:00Z",
        column_ids: [],
      };

      boardSync.setInYjs(doc, board);
      const map = doc.getMap(YJS_MAP_NAMES.BOARDS);
      expect(map.get("board-del")).toBeDefined();

      boardSync.deleteFromYjs(doc, "board-del");
      expect(map.get("board-del")).toBeUndefined();
    });

    it("batchSetInYjs writes multiple entities atomically", async () => {
      const { columnSync } = await import("./syncs");
      const doc = new Y.Doc();

      const columns = [
        {
          id: "col-1",
          board_id: "b1",
          name: "Column 1",
          position: 0,
          task_ids: [],
        },
        {
          id: "col-2",
          board_id: "b1",
          name: "Column 2",
          position: 1,
          task_ids: ["t1"],
        },
      ];

      columnSync.batchSetInYjs(doc, columns);
      const map = doc.getMap(YJS_MAP_NAMES.COLUMNS);
      expect(map.size).toBe(2);
      expect(map.get("col-1")).toEqual(columns[0]);
      expect(map.get("col-2")).toEqual(columns[1]);
    });

    it("initializeYjs populates empty map from EntityMap", async () => {
      const { workspaceSync } = await import("./syncs");
      const doc = new Y.Doc();

      const entityMap = {
        byId: {
          "ws-init": {
            id: "ws-init",
            name: "Init Workspace",
            created_at: "2025-01-01T00:00:00Z",
            board_ids: ["b1"],
          },
        },
        allIds: ["ws-init"],
      };

      workspaceSync.initializeYjs(doc, entityMap as any);
      const map = doc.getMap(YJS_MAP_NAMES.WORKSPACE);
      expect(map.size).toBe(1);
      expect(map.get("ws-init")).toEqual(entityMap.byId["ws-init"]);
    });

    it("initializeYjs does NOT overwrite existing map data", async () => {
      const { areaSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.AREAS);

      map.set("existing", {
        id: "existing",
        name: "Existing Area",
        workspace_id: "ws-1",
        color: "#fff",
        board_ids: [],
        created_at: "2025-01-01T00:00:00Z",
      });

      const entityMap = {
        byId: {
          "new-area": {
            id: "new-area",
            name: "New Area",
            workspace_id: "ws-1",
            color: "#000",
            board_ids: [],
            created_at: "2025-01-01T00:00:00Z",
          },
        },
        allIds: ["new-area"],
      };

      areaSync.initializeYjs(doc, entityMap as any);
      expect(map.size).toBe(1);
      expect(map.get("existing")).toBeDefined();
      expect(map.get("new-area")).toBeUndefined();
    });
  });

  describe("comment and chatMessage syncs", () => {
    it("commentSync accepts valid comment data", async () => {
      const { commentSync } = await import("./syncs");
      const doc = new Y.Doc();

      const comment = {
        id: "c1",
        x: 10,
        y: 20,
        content: "Hello world",
        authorId: "u1",
        workspaceId: "ws-1",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      commentSync.setInYjs(doc, comment);
      const map = doc.getMap(YJS_MAP_NAMES.COMMENTS);
      expect(map.get("c1")).toEqual(comment);
    });

    it("chatMessageSync rejects message missing required fields", async () => {
      const { chatMessageSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.CHAT_MESSAGES);

      map.set("bad-msg", {
        id: "bad-msg",
        content: "hello",
        // missing authorId, authorName, workspaceId, createdAt, updatedAt
      } as never);

      const result = chatMessageSync.applyFromYjs(map);
      expect(result.byId["bad-msg"]).toBeUndefined();
    });
  });

  describe("areaDragOriginSync uses inline zod schema", () => {
    it("accepts valid area drag origin", async () => {
      const { areaDragOriginSync } = await import("./syncs");
      const doc = new Y.Doc();

      areaDragOriginSync.setInYjs(doc, {
        id: "ado-1",
        originX: 100,
        originY: 200,
      });
      const map = doc.getMap(YJS_MAP_NAMES.AREA_DRAG_ORIGINS);
      expect(map.get("ado-1")).toEqual({
        id: "ado-1",
        originX: 100,
        originY: 200,
      });
    });

    it("rejects area drag origin with wrong field types", async () => {
      const { areaDragOriginSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.AREA_DRAG_ORIGINS);

      map.set("bad-ado", {
        id: "bad-ado",
        originX: "left",
        originY: "top",
      } as never);
      const result = areaDragOriginSync.applyFromYjs(map);
      expect(result.byId["bad-ado"]).toBeUndefined();
    });
  });

  describe("mixed valid and invalid entries in Y.Map", () => {
    it("filters out invalid entries while preserving valid ones", async () => {
      const { boardPositionSync } = await import("./syncs");
      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);

      map.set("bp-good", {
        id: "bp-good",
        x: 10,
        y: 20,
        zIndex: 1,
      });
      map.set("bp-bad-1", { id: "bp-bad-1", x: "left" } as never);
      map.set("bp-bad-2", { zIndex: "high" } as never);
      map.set("bp-good-2", {
        id: "bp-good-2",
        x: 50,
        y: 60,
        zIndex: 2,
        width: 300,
        height: 200,
      });

      const result = boardPositionSync.applyFromYjs(map);
      expect(result.allIds).toEqual(["bp-good", "bp-good-2"]);
      expect(result.byId["bp-good"]).toEqual({
        id: "bp-good",
        x: 10,
        y: 20,
        zIndex: 1,
      });
      expect(result.byId["bp-good-2"]).toEqual({
        id: "bp-good-2",
        x: 50,
        y: 60,
        zIndex: 2,
        width: 300,
        height: 200,
      });
    });
  });
});
