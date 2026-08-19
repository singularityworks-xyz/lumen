import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { YJS_MAP_NAMES } from "./entity-sync";
import { applyYjsToState, applyYjsToStateWithRepair } from "./state-sync";

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
});

describe("state-sync", () => {
  describe("applyYjsToState", () => {
    it("returns empty when no workspace ID provided", () => {
      const doc = new Y.Doc();
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-1", {
        id: "ws-1",
        name: "Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      const result = applyYjsToState(doc, undefined, null);

      expect(result).toEqual({});
    });

    it("returns empty when workspace ID is undefined", () => {
      const doc = new Y.Doc();
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-1", {
        id: "ws-1",
        name: "Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      const result = applyYjsToState(doc, undefined, undefined);

      expect(result).toEqual({});
    });

    it("only imports entities from current workspace", () => {
      const doc = new Y.Doc();
      const currentWorkspaceId = "ws-current";

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-1"],
      });
      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-other", {
        id: "ws-other",
        name: "Other Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-2"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });
      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-2", {
        id: "board-2",
        name: "Board 2",
        workspace_id: "ws-other",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      const result = applyYjsToState(
        doc,
        createMinimalState(),
        currentWorkspaceId
      );

      expect(result.boards?.allIds).toEqual(["board-1"]);
      expect(result.boards?.byId["board-1"]).toBeDefined();
      expect(result.boards?.byId["board-2"]).toBeUndefined();
    });

    it("preserves local-only entities outside synced workspace", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-1"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Synced Board",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-local": {
              id: "board-local",
              name: "Local Board",
              workspace_id: "ws-local-only",
              created_by: "user-1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-local"],
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.boards?.allIds).toContain("board-local");
      expect(result.boards?.byId["board-local"]).toBeDefined();
    });

    it("removes synced entities only when raw Yjs absence confirmed", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-1"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Synced Board",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      // Mark board-deleted as previously synced so the merge logic removes it
      doc.getMap(YJS_MAP_NAMES.METADATA).set("syncedEntities", {
        boards: ["board-1", "board-deleted"],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "Synced Board",
              workspace_id: "ws-current",
              created_by: "user-1",
              created_at: "2024-01-01",
              column_ids: [],
            },
            "board-deleted": {
              id: "board-deleted",
              name: "Deleted Board",
              workspace_id: "ws-current",
              created_by: "user-1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1", "board-deleted"],
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.boards?.byId["board-1"]).toBeDefined();
      expect(result.boards?.byId["board-deleted"]).toBeUndefined();
    });

    it("removes workspace comments missing from Yjs even without metadata", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        comments: {
          byId: {
            "comment-1": {
              id: "comment-1",
              x: 120,
              y: 80,
              content: "Local comment",
              authorId: "user-1",
              workspaceId: "ws-current",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
            },
          },
          allIds: ["comment-1"],
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.comments?.byId["comment-1"]).toBeUndefined();
      expect(result.comments?.allIds).not.toContain("comment-1");
    });

    it("preserves comments from other workspaces when syncing current workspace", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        comments: {
          byId: {
            "comment-other": {
              id: "comment-other",
              x: 20,
              y: 40,
              content: "Other workspace comment",
              authorId: "user-1",
              workspaceId: "ws-other",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
            },
          },
          allIds: ["comment-other"],
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.comments?.byId["comment-other"]).toBeDefined();
      expect(result.comments?.allIds).toContain("comment-other");
    });

    it("removes workspace chat messages missing from Yjs even without metadata", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        chatMessages: {
          byId: {
            "message-1": {
              id: "message-1",
              content: "Local message",
              authorId: "user-1",
              authorName: "User One",
              workspaceId: "ws-current",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
            },
          },
          allIds: ["message-1"],
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.chatMessages?.byId["message-1"]).toBeUndefined();
      expect(result.chatMessages?.allIds).not.toContain("message-1");
    });

    it("preserves board when task-detail modal references it", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-1"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-modal", {
        id: "board-modal",
        name: "Board with Modal",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-modal": {
              id: "board-modal",
              name: "Board with Modal",
              workspace_id: "ws-current",
              created_by: "user-1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-modal"],
        },
        taskDetailModals: {
          "modal-1": {
            id: "modal-1",
            taskId: "task-1",
            boardId: "board-modal",
            position: { x: 100, y: 100 },
            zIndex: 100,
            sourceTaskId: "task-1",
          },
        },
      };

      const result = applyYjsToState(doc, currentState, currentWorkspaceId);

      expect(result.boards?.byId["board-modal"]).toBeDefined();
      expect(result.boards?.allIds).toContain("board-modal");
    });

    it("converts ephemeral dialog maps to store shape correctly", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      });

      doc.getMap(YJS_MAP_NAMES.AREA_DIALOGS).set("dialog-1", {
        id: "dialog-1",
        areaId: "area-1",
        areaName: "Area 1",
        position: { x: 50, y: 60 },
        inputValue: "new name",
      });

      const result = applyYjsToState(
        doc,
        createMinimalState(),
        currentWorkspaceId
      );

      expect(result.areaDialogs?.["dialog-1"]).toEqual({
        id: "dialog-1",
        areaId: "area-1",
        areaName: "Area 1",
        position: { x: 50, y: 60 },
        inputValue: "new name",
      });
    });
  });

  describe("applyYjsToStateWithRepair", () => {
    it("applies Yjs state and runs repair when needed", () => {
      const currentWorkspaceId = "ws-current";
      const doc = new Y.Doc();

      doc.getMap(YJS_MAP_NAMES.WORKSPACE).set("ws-current", {
        id: "ws-current",
        name: "Current Workspace",
        created_at: "2024-01-01",
        board_ids: ["board-1"],
      });

      doc.getMap(YJS_MAP_NAMES.BOARDS).set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-current",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS).set("board-1", {
        id: "board-1",
        x: 100,
        y: 100,
        zIndex: 1,
      });

      const currentState: KanbanState = {
        ...createMinimalState(),
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "Board 1",
              workspace_id: "ws-current",
              created_by: "user-1",
              created_at: "2024-01-01",
              column_ids: [],
            },
          },
          allIds: ["board-1"],
        },
        boardPositions: {
          byId: {},
          allIds: [],
        },
      };

      const result = applyYjsToStateWithRepair(
        doc,
        currentState,
        currentWorkspaceId
      );

      expect(result.boards).toBeDefined();
      expect(result.boardPositions?.byId["board-1"]).toBeDefined();
    });
  });
});
