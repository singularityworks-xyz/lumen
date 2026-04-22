import { describe, expect, it } from "bun:test";

// Integration test: schemas + utility functions working together
// Uses deterministic data (no faker) for reliability

let idCounter = 0;
function nextId(prefix = "e") {
  return `${prefix}-${++idCounter}`;
}

const NOW = "2024-01-15T10:00:00Z";
const USER = "user-integration";

import {
  BoardConnectionSchema,
  BoardPositionSchema,
  BoardSchema,
  ChatMessageSchema,
  ChecklistSchema,
  ColumnSchema,
  CommentSchema,
  CreateTaskModalSchema,
  createEntityMapSchema,
  getMapStats,
  parseWithDefault,
  TaskDetailModalSchema,
  TaskSchema,
  validateEntity,
  WorkspaceSchema,
  YJS_MAP_NAMES,
} from "../index";

describe("yjs-shared integration", () => {
  describe("full workspace creation flow", () => {
    it("creates and validates a complete workspace with boards and tasks", () => {
      const workspaceId = nextId("ws");
      const boardId = nextId("board");
      const columnId = nextId("col");
      const taskId = nextId("task");

      const workspace = WorkspaceSchema.parse({
        id: workspaceId,
        name: "Main Workspace",
        description: "Integration test workspace",
        created_at: NOW,
        board_ids: [boardId],
        lastFocusedBoardId: boardId,
        lastViewport: { x: 0, y: 0, zoom: 1 },
        showMiniMap: true,
      });
      expect(workspace.id).toBe(workspaceId);
      expect(workspace.board_ids).toContain(boardId);

      const board = BoardSchema.parse({
        id: boardId,
        name: "Sprint Board",
        workspace_id: workspaceId,
        created_by: USER,
        created_at: NOW,
        column_ids: [columnId],
        accentColor: "#3b82f6",
      });
      expect(board.workspace_id).toBe(workspaceId);

      const column = ColumnSchema.parse({
        id: columnId,
        board_id: boardId,
        name: "To Do",
        position: 0,
        task_ids: [taskId],
        accentColor: "#ef4444",
        icon: "folder",
      });
      expect(column.board_id).toBe(boardId);

      const task = TaskSchema.parse({
        id: taskId,
        board_id: boardId,
        column_id: columnId,
        title: "Implement feature",
        description: "Build the integration tests",
        priority: "high",
        progress: 50,
        position: 0,
        due_date: "2024-12-31",
        created_by: USER,
        assigned_to: nextId("assignee"),
        created_at: NOW,
        updated_at: NOW,
        tags: ["testing", "integration"],
        status: "todo",
      });
      expect(task.board_id).toBe(boardId);
      expect(task.column_id).toBe(columnId);
      expect(task.priority).toBe("high");
    });

    it("validates entity maps for kanban board state", () => {
      const boardMapSchema = createEntityMapSchema(BoardSchema);
      const columnMapSchema = createEntityMapSchema(ColumnSchema);
      const taskMapSchema = createEntityMapSchema(TaskSchema);

      const boardId = nextId("board");
      const col1 = nextId("col");
      const col2 = nextId("col2");
      const task1 = nextId("task");
      const task2 = nextId("task2");

      const boardData = boardMapSchema.parse({
        byId: {
          [boardId]: {
            id: boardId,
            name: "Sprint Board",
            workspace_id: nextId("ws"),
            created_by: USER,
            created_at: NOW,
            column_ids: [col1, col2],
          },
        },
        allIds: [boardId],
      });

      const columnData = columnMapSchema.parse({
        byId: {
          [col1]: {
            id: col1,
            board_id: boardId,
            name: "To Do",
            position: 0,
            task_ids: [task1],
          },
          [col2]: {
            id: col2,
            board_id: boardId,
            name: "Done",
            position: 1,
            task_ids: [task2],
          },
        },
        allIds: [col1, col2],
      });

      const taskData = taskMapSchema.parse({
        byId: {
          [task1]: {
            id: task1,
            board_id: boardId,
            column_id: col1,
            title: "Task 1",
            priority: "low",
            progress: 0,
            position: 0,
            created_by: USER,
            created_at: NOW,
            updated_at: NOW,
            status: "todo",
          },
          [task2]: {
            id: task2,
            board_id: boardId,
            column_id: col2,
            title: "Task 2",
            priority: "high",
            progress: 100,
            position: 0,
            created_by: USER,
            created_at: NOW,
            updated_at: NOW,
            status: "done",
          },
        },
        allIds: [task1, task2],
      });

      expect(Object.keys(boardData.byId)).toHaveLength(1);
      expect(Object.keys(columnData.byId)).toHaveLength(2);
      expect(Object.keys(taskData.byId)).toHaveLength(2);

      const board = boardData.byId[boardId];
      for (const colId of board.column_ids) {
        expect(columnData.byId[colId]).toBeDefined();
        expect(columnData.byId[colId].board_id).toBe(boardId);
      }
    });
  });

  describe("board position and connection flow", () => {
    it("creates boards with positions and connections between them", () => {
      const board1 = nextId("board");
      const board2 = nextId("board");
      const connId = nextId("conn");

      const pos1 = BoardPositionSchema.parse({
        id: board1,
        x: 100,
        y: 200,
        zIndex: 0,
        width: 400,
        height: 300,
        userResized: true,
        lastUserWidth: 400,
        lastUserHeight: 300,
      });

      const pos2 = BoardPositionSchema.parse({
        id: board2,
        x: pos1.x + 500,
        y: pos1.y,
        zIndex: 1,
      });

      const connection = BoardConnectionSchema.parse({
        id: connId,
        source_board_id: board1,
        target_board_id: board2,
        label: "depends on",
        lineStyle: "dotted",
        sourceHandle: "right",
        targetHandle: "left",
        showArrow: true,
        created_at: NOW,
      });

      expect(connection.source_board_id).toBe(board1);
      expect(connection.target_board_id).toBe(board2);
      expect(pos2.x).toBeGreaterThan(pos1.x);
    });
  });

  describe("task with checklists flow", () => {
    it("creates task with multiple checklists", () => {
      const taskId = nextId("task");
      const checklists = [
        ChecklistSchema.parse({
          id: nextId("cl"),
          task_id: taskId,
          title: "Requirements",
          completed: true,
          position: 0,
        }),
        ChecklistSchema.parse({
          id: nextId("cl"),
          task_id: taskId,
          title: "Implementation",
          completed: false,
          position: 1,
        }),
        ChecklistSchema.parse({
          id: nextId("cl"),
          task_id: taskId,
          title: "Tests",
          completed: false,
          position: 2,
        }),
      ];

      const task = TaskSchema.parse({
        id: taskId,
        board_id: nextId("board"),
        column_id: nextId("col"),
        title: "Full feature",
        priority: "medium",
        progress: 33,
        position: 0,
        created_by: USER,
        created_at: NOW,
        updated_at: NOW,
        checklists,
        status: "todo",
      });

      expect(task.checklists).toHaveLength(3);
      expect(task.checklists?.[0].completed).toBe(true);
      expect(task.checklists?.[1].completed).toBe(false);
    });
  });

  describe("collaborative dialog state flow", () => {
    it("creates task detail modal with draft state", () => {
      const taskId = nextId("task");
      const modal = TaskDetailModalSchema.parse({
        id: nextId("modal"),
        taskId,
        boardId: nextId("board"),
        position: { x: 100, y: 200 },
        zIndex: 10,
        sourceTaskId: taskId,
        isEditing: true,
        draftTitle: "Updated title",
        draftPriority: "high",
        draftProgress: 75,
        draftLastUpdatedBy: USER,
        draftLastUpdatedAt: Date.now(),
      });

      expect(modal.isEditing).toBe(true);
      expect(modal.draftTitle).toBe("Updated title");
      expect(modal.draftProgress).toBe(75);
    });

    it("creates task modal with form data", () => {
      const modal = CreateTaskModalSchema.parse({
        id: nextId("modal"),
        boardId: nextId("board"),
        columnId: nextId("col"),
        position: { x: 50, y: 50 },
        formData: {
          title: "New task",
          description: "From modal",
          priority: "medium",
          progress: 0,
          dueDate: "",
          tags: "urgent, feature",
        },
        zIndex: 5,
      });

      expect(modal.formData.priority).toBe("medium");
      expect(modal.formData.tags).toBe("urgent, feature");
    });
  });

  describe("comment and chat message flow", () => {
    it("creates threaded comments", () => {
      const parentId = nextId("comment");
      const workspaceId = nextId("ws");

      const parent = CommentSchema.parse({
        id: parentId,
        x: 100,
        y: 200,
        content: "Parent comment",
        authorId: USER,
        workspaceId,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const reply = CommentSchema.parse({
        id: nextId("comment"),
        x: 100,
        y: 250,
        content: "Reply to parent",
        authorId: nextId("user"),
        workspaceId,
        createdAt: NOW,
        updatedAt: NOW,
        parentId,
      });

      expect(reply.parentId).toBe(parent.id);
    });

    it("creates chat message with mentions", () => {
      const msg = ChatMessageSchema.parse({
        id: nextId("msg"),
        content: "Hey @alice, check this out!",
        authorId: USER,
        authorName: "Bob",
        workspaceId: nextId("ws"),
        createdAt: NOW,
        updatedAt: NOW,
        mentions: [
          {
            userId: nextId("user"),
            userName: "alice",
            startIndex: 4,
            endIndex: 10,
          },
        ],
        isEdited: true,
        lastEditedAt: NOW,
      });

      expect(msg.mentions).toHaveLength(1);
      expect(msg.isEdited).toBe(true);
    });
  });

  describe("validateEntity + parseWithDefault with realistic data", () => {
    it("validateEntity returns typed success for valid board", () => {
      const data = {
        id: nextId("board"),
        name: "My Board",
        workspace_id: nextId("ws"),
        created_by: USER,
        created_at: NOW,
        column_ids: [],
      };

      const result = validateEntity(BoardSchema, data);
      expect(result.success).toBe(true);
    });

    it("validateEntity returns error with details for invalid data", () => {
      const result = validateEntity(TaskSchema, {
        id: 123,
        title: "",
        progress: 200,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("parseWithDefault provides fallback for corrupted sync data", () => {
      const defaultWorkspace = {
        id: "default",
        name: "Recovery Workspace",
        created_at: NOW,
        board_ids: [],
      };

      const corrupted = { id: null, boards: "not-an-array" };
      const result = parseWithDefault(
        WorkspaceSchema,
        corrupted,
        defaultWorkspace
      );
      expect(result).toEqual(defaultWorkspace);
    });
  });

  describe("getMapStats with realistic map sizes", () => {
    it("computes stats for a full workspace", () => {
      const maps = {
        workspace: { size: 1 },
        boards: { size: 5 },
        columns: { size: 15 },
        tasks: { size: 100 },
        boardPositions: { size: 5 },
        boardConnections: { size: 3 },
        areas: { size: 2 },
        comments: { size: 25 },
        chatMessages: { size: 50 },
      };

      const stats = getMapStats(maps);
      expect(stats.tasks).toBe(100);
      expect(stats.boards).toBe(5);
      expect(stats.comments).toBe(25);

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBe(206);
    });
  });

  describe("YJS_MAP_NAMES completeness", () => {
    it("has entries for all entity types used in schemas", () => {
      const values = Object.values(YJS_MAP_NAMES);
      expect(values).toContain("workspace");
      expect(values).toContain("boards");
      expect(values).toContain("columns");
      expect(values).toContain("tasks");
      expect(values).toContain("comments");
      expect(values).toContain("chatMessages");
    });
  });
});
