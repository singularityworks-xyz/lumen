import { describe, expect, it } from "bun:test";
import {
  AreaDialogSchema,
  AreaPositionSchema,
  AreaSchema,
  BoardConnectionSchema,
  BoardDialogSchema,
  BoardPositionSchema,
  BoardQuickActionsSchema,
  BoardSchema,
  CanvasStateSchema,
  ChatMessageSchema,
  ChecklistSchema,
  ColumnDialogSchema,
  ColumnQuickActionsSchema,
  ColumnSchema,
  CommentSchema,
  ConnectionDialogSchema,
  CreateTaskModalSchema,
  createEntityMapSchema,
  getMapStats,
  HandlePositionSchema,
  InteractionModeSchema,
  LineStyleSchema,
  PrioritySchema,
  parseWithDefault,
  TaskDetailModalSchema,
  TaskQuickActionsSchema,
  TaskSchema,
  TaskStatusSchema,
  ViewportStateSchema,
  validateEntity,
  WorkspaceSchema,
  YJS_MAP_NAMES,
} from "../../index";

function validTask() {
  return {
    id: "task-1",
    board_id: "board-1",
    column_id: "col-1",
    title: "Do something",
    priority: "medium",
    progress: 50,
    position: 0,
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    status: "todo",
  };
}

function validColumn() {
  return {
    id: "col-1",
    board_id: "board-1",
    name: "To Do",
    position: 0,
    task_ids: [],
  };
}

function validBoard() {
  return {
    id: "board-1",
    name: "Sprint 1",
    workspace_id: "ws-1",
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    column_ids: [],
  };
}

function validWorkspace() {
  return {
    id: "ws-1",
    name: "My Workspace",
    created_at: "2024-01-01T00:00:00Z",
    board_ids: [],
  };
}

describe("yjs-shared schemas", () => {
  describe("enum schemas", () => {
    it("PrioritySchema accepts valid values", () => {
      expect(PrioritySchema.parse("low")).toBe("low");
      expect(PrioritySchema.parse("medium")).toBe("medium");
      expect(PrioritySchema.parse("high")).toBe("high");
    });

    it("PrioritySchema rejects invalid values", () => {
      expect(() => PrioritySchema.parse("critical")).toThrow();
      expect(() => PrioritySchema.parse("")).toThrow();
    });

    it("TaskStatusSchema accepts valid values", () => {
      expect(TaskStatusSchema.parse("todo")).toBe("todo");
      expect(TaskStatusSchema.parse("done")).toBe("done");
      expect(TaskStatusSchema.parse("trash")).toBe("trash");
    });

    it("TaskStatusSchema rejects invalid values", () => {
      expect(() => TaskStatusSchema.parse("in-progress")).toThrow();
    });

    it("LineStyleSchema accepts valid values", () => {
      expect(LineStyleSchema.parse("solid")).toBe("solid");
      expect(LineStyleSchema.parse("dotted")).toBe("dotted");
    });

    it("LineStyleSchema rejects invalid values", () => {
      expect(() => LineStyleSchema.parse("dashed")).toThrow();
    });

    it("HandlePositionSchema accepts valid values", () => {
      for (const pos of ["top", "right", "bottom", "left"]) {
        expect(HandlePositionSchema.parse(pos)).toBe(pos);
      }
    });

    it("HandlePositionSchema rejects invalid values", () => {
      expect(() => HandlePositionSchema.parse("center")).toThrow();
    });

    it("InteractionModeSchema accepts valid values", () => {
      expect(InteractionModeSchema.parse("drag")).toBe("drag");
      expect(InteractionModeSchema.parse("select")).toBe("select");
    });
  });

  describe("TaskSchema", () => {
    it("accepts a valid task", () => {
      const task = validTask();
      expect(TaskSchema.parse(task)).toEqual(task);
    });

    it("rejects task with empty title", () => {
      const task = validTask();
      task.title = "";
      expect(() => TaskSchema.parse(task)).toThrow();
    });

    it("rejects task with progress out of range", () => {
      const task = validTask();
      task.progress = 101;
      expect(() => TaskSchema.parse(task)).toThrow();
      task.progress = -1;
      expect(() => TaskSchema.parse(task)).toThrow();
    });

    it("rejects task with missing required fields", () => {
      expect(() => TaskSchema.parse({ id: "t1" })).toThrow();
    });

    it("accepts optional fields when provided", () => {
      const task = validTask();
      task.description = "desc";
      task.due_date = "2024-12-31";
      task.assigned_to = "user-2";
      task.tags = ["urgent"];
      task.checklists = [
        {
          id: "cl-1",
          task_id: "task-1",
          title: "Check",
          completed: false,
          position: 0,
        },
      ];
      const parsed = TaskSchema.parse(task);
      expect(parsed.description).toBe("desc");
      expect(parsed.tags).toEqual(["urgent"]);
      expect(parsed.checklists).toHaveLength(1);
    });

    it("rejects task with invalid priority", () => {
      const task = validTask();
      task.priority = "critical";
      expect(() => TaskSchema.parse(task)).toThrow();
    });
  });

  describe("ColumnSchema", () => {
    it("accepts a valid column", () => {
      const col = validColumn();
      expect(ColumnSchema.parse(col)).toEqual(col);
    });

    it("rejects column with empty name", () => {
      const col = validColumn();
      col.name = "";
      expect(() => ColumnSchema.parse(col)).toThrow();
    });

    it("accepts optional fields", () => {
      const col = validColumn();
      col.description = "desc";
      col.accentColor = "#ff0000";
      col.icon = "folder";
      col.progressValue = 75;
      const parsed = ColumnSchema.parse(col);
      expect(parsed.accentColor).toBe("#ff0000");
    });
  });

  describe("BoardSchema", () => {
    it("accepts a valid board", () => {
      expect(BoardSchema.parse(validBoard())).toBeTruthy();
    });

    it("rejects board with empty name", () => {
      const board = validBoard();
      board.name = "";
      expect(() => BoardSchema.parse(board)).toThrow();
    });

    it("rejects board missing workspace_id", () => {
      const { workspace_id: _, ...board } = validBoard();
      expect(() => BoardSchema.parse(board)).toThrow();
    });
  });

  describe("WorkspaceSchema", () => {
    it("accepts a valid workspace", () => {
      expect(WorkspaceSchema.parse(validWorkspace())).toBeTruthy();
    });

    it("rejects workspace with empty name", () => {
      const ws = validWorkspace();
      ws.name = "";
      expect(() => WorkspaceSchema.parse(ws)).toThrow();
    });

    it("accepts optional viewport and focus fields", () => {
      const ws = validWorkspace();
      ws.lastFocusedBoardId = "board-1";
      ws.lastViewport = { x: 10, y: 20, zoom: 1.5 };
      ws.showMiniMap = true;
      ws.customColors = ["#fff"];
      ws.colorUsage = { "#fff": 3 };
      ws.iconUsage = { star: 1 };
      const parsed = WorkspaceSchema.parse(ws);
      expect(parsed.lastViewport!.zoom).toBe(1.5);
      expect(parsed.colorUsage!["#fff"]).toBe(3);
    });

    it("ViewportStateSchema rejects zoom out of range", () => {
      expect(() =>
        ViewportStateSchema.parse({ x: 0, y: 0, zoom: 0.05 })
      ).toThrow();
      expect(() =>
        ViewportStateSchema.parse({ x: 0, y: 0, zoom: 5 })
      ).toThrow();
    });
  });

  describe("ChecklistSchema", () => {
    it("accepts a valid checklist", () => {
      const cl = {
        id: "cl-1",
        task_id: "t-1",
        title: "Step 1",
        completed: false,
        position: 0,
      };
      expect(ChecklistSchema.parse(cl)).toEqual(cl);
    });

    it("rejects checklist missing required fields", () => {
      expect(() => ChecklistSchema.parse({ id: "cl-1" })).toThrow();
    });
  });

  describe("BoardPositionSchema", () => {
    it("accepts valid position", () => {
      const pos = { id: "bp-1", x: 100, y: 200, zIndex: 1 };
      expect(BoardPositionSchema.parse(pos)).toEqual(pos);
    });

    it("accepts optional resize fields", () => {
      const pos = {
        id: "bp-1",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        zIndex: 0,
        userResized: true,
        lastUserWidth: 400,
        lastUserHeight: 300,
      };
      const parsed = BoardPositionSchema.parse(pos);
      expect(parsed.userResized).toBe(true);
    });
  });

  describe("BoardConnectionSchema", () => {
    it("accepts a valid connection", () => {
      const conn = {
        id: "c-1",
        source_board_id: "b-1",
        target_board_id: "b-2",
        lineStyle: "solid",
        sourceHandle: "right",
        targetHandle: "left",
        showArrow: true,
        created_at: "2024-01-01T00:00:00Z",
      };
      expect(BoardConnectionSchema.parse(conn)).toEqual(conn);
    });

    it("rejects invalid handle positions", () => {
      const conn = {
        id: "c-1",
        source_board_id: "b-1",
        target_board_id: "b-2",
        lineStyle: "solid",
        sourceHandle: "center",
        targetHandle: "left",
        showArrow: true,
        created_at: "2024-01-01T00:00:00Z",
      };
      expect(() => BoardConnectionSchema.parse(conn)).toThrow();
    });
  });

  describe("AreaSchema", () => {
    it("accepts a valid area", () => {
      const area = {
        id: "a-1",
        name: "Area 1",
        workspace_id: "ws-1",
        color: "#f00",
        board_ids: [],
        created_at: "2024-01-01T00:00:00Z",
      };
      expect(AreaSchema.parse(area)).toEqual(area);
    });

    it("rejects area with empty name", () => {
      const area = {
        id: "a-1",
        name: "",
        workspace_id: "ws-1",
        color: "#f00",
        board_ids: [],
        created_at: "2024-01-01T00:00:00Z",
      };
      expect(() => AreaSchema.parse(area)).toThrow();
    });
  });

  describe("AreaPositionSchema", () => {
    it("accepts valid area position", () => {
      const pos = {
        id: "ap-1",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 0,
      };
      expect(AreaPositionSchema.parse(pos)).toEqual(pos);
    });
  });

  describe("AreaDialogSchema", () => {
    it("accepts valid area dialog", () => {
      const dialog = {
        id: "ad-1",
        areaId: "a-1",
        areaName: "Test",
        position: { x: 0, y: 0 },
      };
      expect(AreaDialogSchema.parse(dialog)).toEqual(dialog);
    });
  });

  describe("CanvasStateSchema", () => {
    it("accepts valid canvas state", () => {
      const state = {
        viewport: { x: 0, y: 0, zoom: 1 },
        focusedBoardId: null,
        lastInteractionTime: 0,
      };
      expect(CanvasStateSchema.parse(state)).toEqual(state);
    });
  });

  describe("BoardQuickActionsSchema", () => {
    it("accepts valid quick actions", () => {
      const qa = { id: "qa-1", boardId: "b-1", position: { x: 0, y: 0 } };
      expect(BoardQuickActionsSchema.parse(qa)).toEqual(qa);
    });
  });

  describe("ColumnQuickActionsSchema", () => {
    it("accepts valid column quick actions", () => {
      const qa = {
        id: "cqa-1",
        columnId: "c-1",
        boardId: "b-1",
        showAddTask: true,
        position: { x: 0, y: 0 },
      };
      expect(ColumnQuickActionsSchema.parse(qa)).toEqual(qa);
    });
  });

  describe("ColumnDialogSchema", () => {
    it("accepts valid column dialog", () => {
      const dialog = {
        id: "cd-1",
        type: "rename",
        columnId: "c-1",
        columnName: "Col",
        boardId: "b-1",
        boardName: "Board",
        position: { x: 0, y: 0 },
      };
      expect(ColumnDialogSchema.parse(dialog)).toEqual(dialog);
    });

    it("rejects invalid dialog type", () => {
      const dialog = {
        id: "cd-1",
        type: "move-all",
        columnId: "c-1",
        columnName: "Col",
        boardId: "b-1",
        boardName: "Board",
        position: { x: 0, y: 0 },
      };
      expect(() => ColumnDialogSchema.parse(dialog)).toThrow();
    });
  });

  describe("BoardDialogSchema", () => {
    it("accepts valid board dialog", () => {
      const dialog = {
        id: "bd-1",
        type: "rename",
        boardId: "b-1",
        boardName: "Board",
        position: { x: 0, y: 0 },
        zIndex: 10,
      };
      expect(BoardDialogSchema.parse(dialog)).toEqual(dialog);
    });

    it("rejects invalid board dialog type", () => {
      const dialog = {
        id: "bd-1",
        type: "archive",
        boardId: "b-1",
        boardName: "Board",
        position: { x: 0, y: 0 },
        zIndex: 10,
      };
      expect(() => BoardDialogSchema.parse(dialog)).toThrow();
    });
  });

  describe("ConnectionDialogSchema", () => {
    it("accepts valid connection dialog", () => {
      const dialog = { id: "cod-1", boardId: "b-1", position: { x: 0, y: 0 } };
      expect(ConnectionDialogSchema.parse(dialog)).toEqual(dialog);
    });
  });

  describe("CreateTaskModalSchema", () => {
    it("accepts valid create task modal", () => {
      const modal = {
        id: "ctm-1",
        boardId: "b-1",
        columnId: "c-1",
        position: { x: 0, y: 0 },
        formData: {
          title: "T",
          description: "",
          priority: "low",
          progress: 0,
          dueDate: "",
          tags: "",
        },
        zIndex: 10,
      };
      expect(CreateTaskModalSchema.parse(modal)).toEqual(modal);
    });
  });

  describe("TaskQuickActionsSchema", () => {
    it("accepts valid task quick actions", () => {
      const qa = {
        id: "tqa-1",
        taskId: "t-1",
        boardId: "b-1",
        columnId: "c-1",
        position: { x: 0, y: 0 },
      };
      expect(TaskQuickActionsSchema.parse(qa)).toEqual(qa);
    });
  });

  describe("TaskDetailModalSchema", () => {
    it("accepts valid task detail modal", () => {
      const modal = {
        id: "tdm-1",
        taskId: "t-1",
        boardId: "b-1",
        position: { x: 0, y: 0 },
        zIndex: 10,
        sourceTaskId: "t-1",
      };
      expect(TaskDetailModalSchema.parse(modal)).toEqual(modal);
    });

    it("accepts optional draft fields", () => {
      const modal = {
        id: "tdm-1",
        taskId: "t-1",
        boardId: "b-1",
        position: { x: 0, y: 0 },
        zIndex: 10,
        sourceTaskId: "t-1",
        draftTitle: "Draft",
        draftPriority: "high",
        draftProgress: 75,
      };
      const parsed = TaskDetailModalSchema.parse(modal);
      expect(parsed.draftTitle).toBe("Draft");
      expect(parsed.draftPriority).toBe("high");
    });
  });

  describe("CommentSchema", () => {
    it("accepts valid comment", () => {
      const comment = {
        id: "cm-1",
        x: 0,
        y: 0,
        content: "Hello",
        authorId: "u-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      expect(CommentSchema.parse(comment)).toEqual(comment);
    });
  });

  describe("ChatMessageSchema", () => {
    it("accepts valid chat message", () => {
      const msg = {
        id: "chm-1",
        content: "Hello world",
        authorId: "u-1",
        authorName: "User",
        workspaceId: "ws-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      expect(ChatMessageSchema.parse(msg)).toEqual(msg);
    });

    it("accepts mentions array", () => {
      const msg = {
        id: "chm-1",
        content: "Hello @user",
        authorId: "u-1",
        authorName: "User",
        workspaceId: "ws-1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        mentions: [
          { userId: "u-2", userName: "Other", startIndex: 6, endIndex: 11 },
        ],
      };
      const parsed = ChatMessageSchema.parse(msg);
      expect(parsed.mentions).toHaveLength(1);
    });
  });

  describe("YJS_MAP_NAMES", () => {
    it("contains all expected map names", () => {
      const keys = Object.keys(YJS_MAP_NAMES);
      expect(keys).toContain("WORKSPACE");
      expect(keys).toContain("BOARDS");
      expect(keys).toContain("COLUMNS");
      expect(keys).toContain("TASKS");
      expect(keys).toContain("COMMENTS");
      expect(keys).toContain("CHAT_MESSAGES");
      expect(keys.length).toBeGreaterThanOrEqual(18);
    });

    it("has unique string values", () => {
      const values = Object.values(YJS_MAP_NAMES);
      const unique = new Set(values);
      expect(values.length).toBe(unique.size);
    });
  });

  describe("validateEntity", () => {
    it("returns success for valid data", () => {
      const result = validateEntity(TaskSchema, validTask());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Do something");
      }
    });

    it("returns error for invalid data", () => {
      const result = validateEntity(TaskSchema, { id: 123 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it("returns error for null input", () => {
      const result = validateEntity(TaskSchema, null);
      expect(result.success).toBe(false);
    });

    it("is deterministic", () => {
      const data = validTask();
      const r1 = validateEntity(TaskSchema, data);
      const r2 = validateEntity(TaskSchema, data);
      expect(r1.success).toBe(r2.success);
    });
  });

  describe("parseWithDefault", () => {
    it("returns parsed data for valid input", () => {
      const task = validTask();
      const fallback = { ...task, title: "fallback" };
      const result = parseWithDefault(TaskSchema, task, fallback);
      expect(result.title).toBe("Do something");
    });

    it("returns default for invalid input", () => {
      const fallback = validTask();
      const result = parseWithDefault(TaskSchema, { bad: "data" }, fallback);
      expect(result).toEqual(fallback);
    });

    it("returns default for null", () => {
      const fallback = validTask();
      const result = parseWithDefault(TaskSchema, null, fallback);
      expect(result).toEqual(fallback);
    });

    it("is deterministic for same inputs", () => {
      const fallback = validTask();
      const r1 = parseWithDefault(TaskSchema, null, fallback);
      const r2 = parseWithDefault(TaskSchema, null, fallback);
      expect(r1).toEqual(r2);
    });
  });

  describe("createEntityMapSchema", () => {
    it("creates a schema that validates entity maps", () => {
      const mapSchema = createEntityMapSchema(TaskSchema);
      const data = {
        byId: { "task-1": validTask() },
        allIds: ["task-1"],
      };
      expect(mapSchema.parse(data)).toEqual(data);
    });

    it("accepts mismatched allIds", () => {
      const mapSchema = createEntityMapSchema(TaskSchema);
      const data = {
        byId: { "task-1": validTask() },
        allIds: ["task-1", "task-2"],
      };
      expect(mapSchema.parse(data)).toBeTruthy();
    });

    it("rejects invalid entities in byId", () => {
      const mapSchema = createEntityMapSchema(TaskSchema);
      const data = {
        byId: { "task-1": { bad: "data" } },
        allIds: ["task-1"],
      };
      expect(() => mapSchema.parse(data)).toThrow();
    });

    it("works with empty maps", () => {
      const mapSchema = createEntityMapSchema(BoardSchema);
      const data = { byId: {}, allIds: [] };
      expect(mapSchema.parse(data)).toEqual(data);
    });
  });

  describe("getMapStats", () => {
    it("returns size for each map", () => {
      const maps = {
        tasks: { size: 5 },
        boards: { size: 2 },
        columns: { size: 10 },
      };
      const stats = getMapStats(maps);
      expect(stats.tasks).toBe(5);
      expect(stats.boards).toBe(2);
      expect(stats.columns).toBe(10);
    });

    it("returns zero for empty maps", () => {
      const maps = { tasks: { size: 0 } };
      const stats = getMapStats(maps);
      expect(stats.tasks).toBe(0);
    });

    it("handles empty input", () => {
      const stats = getMapStats({});
      expect(stats).toEqual({});
    });

    it("is deterministic", () => {
      const maps = { a: { size: 3 }, b: { size: 7 } };
      expect(getMapStats(maps)).toEqual(getMapStats(maps));
    });
  });
});
