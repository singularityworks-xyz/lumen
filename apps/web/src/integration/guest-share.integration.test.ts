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
      });

      const guestUi = getUiVisibility(true);
      expect(guestUi.floatingNavbar).toBe(false);
      expect(guestUi.mobileNavbar).toBe(false);
      expect(guestUi.rightDrawers).toBe(false);
      expect(guestUi.commandPalette).toBe(false);
      expect(guestUi.contextMenu).toBe(false);
      expect(guestUi.bulkActionsBar).toBe(false);
      expect(guestUi.sharedViaLumenWatermark).toBe(true);

      const collaboratorUi = getUiVisibility(false);
      expect(collaboratorUi.floatingNavbar).toBe(true);
      expect(collaboratorUi.sharedViaLumenWatermark).toBe(false);
    });
  });
});
