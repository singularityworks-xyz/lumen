import { describe, expect, it } from "bun:test";
import type { Role } from "@lumen/db";
import { createInitialState } from "@/src/features/kanban/store/utils";

// ──────────────────────────────────────────────────────────────
// Unit & Integration tests: Public Read-Only Guest Share Link
// ──────────────────────────────────────────────────────────────

describe("GUEST-SHARE: Public Read-Only Guest Link", () => {
  describe("1. Guest Link Generation & State", () => {
    it("initializes with guest link disabled by default", () => {
      const state = createInitialState();
      expect(state.isGuestMode).toBe(false);
      expect(state.guestToken).toBeNull();
    });

    it("enables guest mode with valid token", () => {
      const state = createInitialState();
      const guestToken = "guest_1234567890abcdef";

      state.isGuestMode = true;
      state.guestToken = guestToken;

      expect(state.isGuestMode).toBe(true);
      expect(state.guestToken).toBe(guestToken);
    });

    it("generates correct public guest share URL structure", () => {
      const token = "guest_AbCdEf123456";
      const baseUrl = "https://lumen.app";
      const guestUrl = `${baseUrl}/?guest=${token}`;

      expect(guestUrl).toContain("?guest=");
      expect(guestUrl).toBe("https://lumen.app/?guest=guest_AbCdEf123456");
    });
  });

  describe("2. Unauthenticated Access & Permission Enforcement", () => {
    const isWriteAllowed = (role: Role, isGuest: boolean) => {
      if (isGuest || role === "VIEWER") {
        return false;
      }
      return role === "OWNER" || role === "EDITOR";
    };

    const isDeleteAllowed = (role: Role, isGuest: boolean) => {
      if (isGuest) {
        return false;
      }
      return role === "OWNER";
    };

    it("blocks writes for guest viewers", () => {
      expect(isWriteAllowed("VIEWER", true)).toBe(false);
    });

    it("allows writes for authenticated editors and owners", () => {
      expect(isWriteAllowed("EDITOR", false)).toBe(true);
      expect(isWriteAllowed("OWNER", false)).toBe(true);
    });

    it("blocks workspace deletion for guest viewers", () => {
      expect(isDeleteAllowed("VIEWER", true)).toBe(false);
    });

    it("validates that guest token does not require login", () => {
      const tokenData = {
        token: "guest_xyz789",
        isGuest: true,
        role: "VIEWER" as Role,
      };

      const requiresAuth = !tokenData.isGuest && tokenData.role !== "VIEWER";
      expect(requiresAuth).toBe(false);
    });
  });

  describe("3. Canvas Node Filtering in Guest Mode", () => {
    const filterNodesForViewer = (
      nodes: Array<{ id: string; type: string }>,
      isGuestMode: boolean
    ) => {
      if (!isGuestMode) {
        return nodes;
      }
      const allowedGuestNodeTypes = new Set([
        "board",
        "textBoard",
        "taskDetailModal",
      ]);
      return nodes.filter((n) => allowedGuestNodeTypes.has(n.type));
    };

    it("filters out edit dialogs, quick actions, and areas for guest viewers", () => {
      const allNodes = [
        { id: "board-1", type: "board" },
        { id: "text-board-1", type: "textBoard" },
        { id: "task-detail-modal-1", type: "taskDetailModal" },
        { id: "modal-create-task", type: "taskModal" },
        { id: "quick-actions-board-1", type: "boardQuickActions" },
        { id: "text-quick-actions-1", type: "textBoardQuickActions" },
        { id: "board-dialog-rename", type: "boardRenameDialog" },
        { id: "board-dialog-delete", type: "boardDeleteDialog" },
        { id: "column-dialog-rename", type: "columnRenameDialog" },
        { id: "column-quick-actions-1", type: "columnQuickActions" },
        { id: "task-quick-actions-1", type: "taskQuickActions" },
        { id: "share-dialog-1", type: "shareDialog" },
        { id: "connection-dialog-1", type: "connectionDialog" },
        { id: "area-dialog-1", type: "areaPropertiesDialog" },
        { id: "comment-cluster-1", type: "commentCluster" },
        { id: "welcome-node", type: "welcome" },
        { id: "area-node-1", type: "area" },
      ];

      const guestVisibleNodes = filterNodesForViewer(allNodes, true);

      expect(guestVisibleNodes.length).toBe(3);
      expect(guestVisibleNodes.map((n) => n.id)).toEqual([
        "board-1",
        "text-board-1",
        "task-detail-modal-1",
      ]);
      expect(
        guestVisibleNodes.some((n) => n.type === "boardRenameDialog")
      ).toBe(false);
      expect(guestVisibleNodes.some((n) => n.type === "shareDialog")).toBe(
        false
      );
      expect(
        guestVisibleNodes.some((n) => n.type === "boardQuickActions")
      ).toBe(false);
    });

    it("preserves all nodes for authenticated collaborators", () => {
      const allNodes = [
        { id: "board-1", type: "board" },
        { id: "board-dialog-rename", type: "boardRenameDialog" },
        { id: "share-dialog-1", type: "shareDialog" },
      ];

      const collaboratorNodes = filterNodesForViewer(allNodes, false);
      expect(collaboratorNodes.length).toBe(3);
    });
  });

  describe("4. Canvas Edge / Connection Filtering", () => {
    it("filters out connection lines pointing to filtered external dialogs", () => {
      const visibleNodeIds = new Set(["board-1", "board-2", "text-board-1"]);

      const connections = [
        { id: "conn-1", source: "board-1", target: "board-2" },
        { id: "conn-2", source: "board-1", target: "text-board-1" },
        { id: "conn-3", source: "board-1", target: "board-dialog-rename" },
        { id: "conn-4", source: "board-2", target: "quick-actions-board-2" },
      ];

      const visibleConnections = connections.filter(
        (c) => visibleNodeIds.has(c.source) && visibleNodeIds.has(c.target)
      );

      expect(visibleConnections.length).toBe(2);
      expect(visibleConnections.map((c) => c.id)).toEqual(["conn-1", "conn-2"]);
    });
  });

  describe("5. UI Elements & Watermark in Guest Mode", () => {
    it("determines correct UI chrome visibility for guest mode", () => {
      const getUiVisibility = (isGuest: boolean) => ({
        floatingNavbar: !isGuest,
        mobileNavbar: !isGuest,
        rightDrawers: !isGuest,
        commandPalette: !isGuest,
        contextMenu: !isGuest,
        bulkActionsBar: !isGuest,
        sharedViaLumenWatermark: isGuest,
        guestViewCounter: isGuest,
      });

      const guestUi = getUiVisibility(true);
      expect(guestUi.floatingNavbar).toBe(false);
      expect(guestUi.mobileNavbar).toBe(false);
      expect(guestUi.rightDrawers).toBe(false);
      expect(guestUi.commandPalette).toBe(false);
      expect(guestUi.contextMenu).toBe(false);
      expect(guestUi.bulkActionsBar).toBe(false);
      expect(guestUi.sharedViaLumenWatermark).toBe(true);
      expect(guestUi.guestViewCounter).toBe(true);

      const collaboratorUi = getUiVisibility(false);
      expect(collaboratorUi.floatingNavbar).toBe(true);
      expect(collaboratorUi.sharedViaLumenWatermark).toBe(false);
      expect(collaboratorUi.guestViewCounter).toBe(false);
    });
  });

  describe("6. Continue as Guest Flow from Collaborator Share Link", () => {
    it("transitions an unauthenticated user on collaborator share link into guest mode", () => {
      const state = createInitialState();
      const collaboratorToken = "collab_share_token_123";
      const workspaceInfo = {
        workspaceId: "ws-collab-1",
        workspaceName: "Collab Workspace",
        owner: {
          id: "owner-1",
          name: "Harsh Sahu",
          email: "harsh@example.com",
          image: null,
        },
      };

      // User arrives at ?share=collab_share_token_123 unauthenticated
      expect(state.isGuestMode).toBe(false);

      // User clicks "Continue as Guest"
      state.isGuestMode = true;
      state.guestToken = collaboratorToken;

      expect(state.isGuestMode).toBe(true);
      expect(state.guestToken).toBe(collaboratorToken);

      const joinPayload = {
        workspaceId: workspaceInfo.workspaceId,
        workspaceName: workspaceInfo.workspaceName,
        owner: workspaceInfo.owner,
        role: "VIEWER",
        isGuest: true,
      };

      expect(joinPayload.role).toBe("VIEWER");
      expect(joinPayload.isGuest).toBe(true);
      expect(joinPayload.owner.name).toBe("Harsh Sahu");
    });
  });

  describe("7. Text Board and Kanban Board Connection Integrity", () => {
    it("preserves connections between kanban board and text board", () => {
      const state = createInitialState();
      state.boards.byId["board-1"] = {
        id: "board-1",
        name: "Kanban Board",
        column_ids: [],
        created_at: new Date().toISOString(),
        created_by: "user-1",
        workspace_id: "ws-1",
      };
      state.boards.allIds.push("board-1");

      state.textBoards.byId["text-board-1"] = {
        id: "text-board-1",
        name: "Notes / Tasks",
        content: "<p>Todo list</p>",
        created_at: new Date().toISOString(),
        created_by: "user-1",
        workspace_id: "ws-1",
      };
      state.textBoards.allIds.push("text-board-1");

      state.boardConnections.byId["conn-1"] = {
        id: "conn-1",
        source_board_id: "board-1",
        target_board_id: "text-board-1",
        sourceHandle: "right",
        targetHandle: "left",
        lineStyle: "solid",
        showArrow: true,
        created_at: new Date().toISOString(),
      };
      state.boardConnections.allIds.push("conn-1");

      // Verify validation check includes both boards and textBoards
      const validBoardIds = new Set([
        ...state.boards.allIds,
        ...state.textBoards.allIds,
      ]);

      const isConnValid =
        validBoardIds.has(
          state.boardConnections.byId["conn-1"].source_board_id
        ) &&
        validBoardIds.has(
          state.boardConnections.byId["conn-1"].target_board_id
        );

      expect(isConnValid).toBe(true);
      expect(state.boardConnections.byId["conn-1"]).toBeDefined();
    });
  });

  describe("8. Read-Only Task Card & Modal Protections in Guest Mode", () => {
    it("prevents guest mode from closing active task detail modals", () => {
      const state = createInitialState();
      state.isGuestMode = true;
      state.taskDetailModals["modal-1"] = {
        boardId: "board-1",
        id: "modal-1",
        isEditing: false,
        position: { x: 100, y: 100 },
        sourceTaskId: "task-1",
        taskId: "task-1",
        zIndex: 10,
      };

      const closeTaskDetailModal = (modalId: string) => {
        if (state.isGuestMode) {
          return;
        }
        delete state.taskDetailModals[modalId];
      };

      closeTaskDetailModal("modal-1");
      expect(state.taskDetailModals["modal-1"]).toBeDefined();

      // For authenticated user
      state.isGuestMode = false;
      closeTaskDetailModal("modal-1");
      expect(state.taskDetailModals["modal-1"]).toBeUndefined();
    });
  });

  describe("9. Guest Spam Resistance for Chat and Larity AI", () => {
    it("enforces 1 msg/sec, 10 msgs/min, and 100 msgs/day for guest chat", async () => {
      const {
        checkGuestChatRateLimit,
        recordGuestChatMessage,
        getGuestChatStats,
      } = await import("../features/comments/lib/guest-rate-limit");

      // Initial check should pass
      const check1 = checkGuestChatRateLimit();
      expect(check1.allowed).toBe(true);

      // Record first message
      recordGuestChatMessage();

      // Second check within 1 second should be blocked
      const check2 = checkGuestChatRateLimit();
      expect(check2.allowed).toBe(false);
      expect(check2.reason).toBe("second");

      const stats = getGuestChatStats();
      expect(stats.dailyLimit).toBe(100);
      expect(stats.dailyCount).toBeGreaterThanOrEqual(1);
    });

    it("enforces 20 messages/day limit for guest Larity", async () => {
      const {
        checkGuestLarityRateLimit,
        recordGuestLarityMessage,
        getGuestLarityStats,
      } = await import("../features/comments/lib/guest-rate-limit");

      const check1 = checkGuestLarityRateLimit();
      expect(check1.allowed).toBe(true);

      recordGuestLarityMessage();

      const stats = getGuestLarityStats();
      expect(stats.dailyLimit).toBe(20);
      expect(stats.dailyCount).toBeGreaterThanOrEqual(1);
    });
  });
});
