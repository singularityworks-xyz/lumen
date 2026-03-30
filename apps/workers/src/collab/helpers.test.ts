import { beforeEach, describe, expect, it, mock } from "bun:test";

type MockFn = ReturnType<typeof mock<() => Promise<unknown>>>;

const prismaMock: {
  workspaceCollaborator: { findUnique: MockFn; upsert: MockFn; count: MockFn };
  workspace: { findUnique: MockFn; create: MockFn; update: MockFn };
  workspaceState: { findUnique: MockFn };
  workspaceShare: { findUnique: MockFn; create: MockFn; count: MockFn };
  user: { findUnique: MockFn };
} = {
  workspaceCollaborator: {
    findUnique: mock(() => Promise.resolve(null)),
    upsert: mock(() => Promise.resolve()),
    count: mock(() => Promise.resolve(0)),
  },
  workspace: {
    findUnique: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve()),
    update: mock(() => Promise.resolve()),
  },
  workspaceState: {
    findUnique: mock(() => Promise.resolve(null)),
  },
  workspaceShare: {
    findUnique: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve()),
    count: mock(() => Promise.resolve(0)),
  },
  user: {
    findUnique: mock(() => Promise.resolve(null)),
  },
};

mock.module("@lumen/db", () => ({
  prisma: prismaMock,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

mock.module("@lumen/logger/server", () => ({
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  withSpanAsync: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn(null),
}));

mock.module("@lumen/yjs-shared", () => ({
  YJS_MAP_NAMES: { WORKSPACE: "workspace" },
}));

import {
  addCollaborator,
  CURSOR_COLORS,
  checkWorkspaceExistence,
  createShareToken,
  generateId,
  getCollaborator,
  getColorForUser,
  getShareInfo,
  getUserInfo,
  getWorkspaceCollaboratorCount,
  getWorkspaceName,
} from "./helpers";

import { roomManager } from "./room-manager";

describe("collab/helpers", () => {
  beforeEach(() => {
    prismaMock.workspaceCollaborator.findUnique.mockClear();
    prismaMock.workspaceCollaborator.upsert.mockClear();
    prismaMock.workspaceCollaborator.count.mockClear();
    prismaMock.workspace.findUnique.mockClear();
    prismaMock.workspace.create.mockClear();
    prismaMock.workspaceState.findUnique.mockClear();
    prismaMock.workspaceShare.findUnique.mockClear();
    prismaMock.workspaceShare.create.mockClear();
    prismaMock.workspaceShare.count.mockClear();
    prismaMock.user.findUnique.mockClear();
    roomManager.reset();
  });

  describe("generateId", () => {
    it("generates string of requested length", () => {
      expect(generateId(8).length).toBe(8);
      expect(generateId(16).length).toBe(16);
    });

    it("generates unique strings", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("getColorForUser", () => {
    it("returns consistent color for same ID", () => {
      const color1 = getColorForUser("user-1");
      const color2 = getColorForUser("user-1");
      expect(color1).toBe(color2);
    });

    it("returns valid color from palette", () => {
      const color = getColorForUser("user-abc");
      expect(CURSOR_COLORS).toContain(color);
    });
  });

  describe("getCollaborator", () => {
    it("returns null if no collaborator found", async () => {
      prismaMock.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      const result = await getCollaborator("ws-1", "user-1");
      expect(result).toBeNull();
    });

    it("returns role if collaborator exists", async () => {
      prismaMock.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "EDITOR",
      });
      const result = await getCollaborator("ws-1", "user-1");
      expect(result).toEqual({ role: "EDITOR" });
    });
  });

  describe("addCollaborator", () => {
    it("upserts collaborator record", async () => {
      await addCollaborator("ws-1", "user-1", "VIEWER");
      expect(prismaMock.workspaceCollaborator.upsert).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: { workspaceId: "ws-1", userId: "user-1" },
        },
        update: { role: "VIEWER" },
        create: { workspaceId: "ws-1", userId: "user-1", role: "VIEWER" },
      });
    });

    it("creates workspace lazily if adding OWNER and workspace doesn't exist", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      await addCollaborator("ws-1", "user-1", "OWNER");
      expect(prismaMock.workspace.create).toHaveBeenCalledWith({
        data: {
          id: "ws-1",
          name: "Untitled Workspace",
          ownerId: "user-1",
        },
      });
    });
  });

  describe("checkWorkspaceExistence", () => {
    it("returns true if workspace record exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
      });
      const result = await checkWorkspaceExistence("ws-1");
      expect(result).toBe(true);
    });

    it("returns true if state exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce({
        id: "ws-1",
      });
      const result = await checkWorkspaceExistence("ws-1");
      expect(result).toBe(true);
    });

    it("returns false if nothing exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(0);
      prismaMock.workspaceShare.count.mockResolvedValueOnce(0);
      const result = await checkWorkspaceExistence("ws-1");
      expect(result).toBe(false);
    });
  });

  describe("createShareToken", () => {
    it("creates share record and returns token", async () => {
      const token = await createShareToken("ws-1", "user-1");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(prismaMock.workspaceShare.create).toHaveBeenCalled();
    });
  });

  describe("getShareInfo", () => {
    it("returns null if share not found", async () => {
      prismaMock.workspaceShare.findUnique.mockResolvedValueOnce(null);
      const result = await getShareInfo("token-1");
      expect(result).toBeNull();
    });

    it("returns aggregated info if share exists", async () => {
      prismaMock.workspaceShare.findUnique.mockResolvedValueOnce({
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
      });
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      });
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "Workspace Name",
      });

      const result = await getShareInfo("token-1");
      expect(result).toMatchObject({
        workspaceId: "ws-1",
        createdBy: "user-1",
        workspaceName: "Workspace Name",
        owner: expect.any(Object),
      });
    });
  });

  describe("getWorkspaceCollaboratorCount", () => {
    it("returns count from DB", async () => {
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(5);
      const count = await getWorkspaceCollaboratorCount("ws-1");
      expect(count).toBe(5);
    });

    it("returns 0 on DB error", async () => {
      prismaMock.workspaceCollaborator.count.mockRejectedValueOnce(
        new Error("DB down")
      );
      const count = await getWorkspaceCollaboratorCount("ws-1");
      expect(count).toBe(0);
    });
  });

  describe("getCollaborator - error path", () => {
    it("throws on DB error", async () => {
      prismaMock.workspaceCollaborator.findUnique.mockRejectedValueOnce(
        new Error("DB connection failed")
      );
      await expect(getCollaborator("ws-1", "user-1")).rejects.toThrow(
        "DB connection failed"
      );
    });
  });

  describe("addCollaborator - error path", () => {
    it("throws on upsert error", async () => {
      prismaMock.workspaceCollaborator.upsert.mockRejectedValueOnce(
        new Error("upsert failed")
      );
      await expect(addCollaborator("ws-1", "user-1", "VIEWER")).rejects.toThrow(
        "upsert failed"
      );
    });

    it("creates workspace lazily with room name when available", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      // Create a real room with workspace data
      const room = roomManager.getOrCreateRoom("ws-room");
      const workspaceMap = room.doc.getMap("workspace");
      workspaceMap.set("ws-room", { name: "Room Workspace" });
      await addCollaborator("ws-room", "user-1", "OWNER");
      expect(prismaMock.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Room Workspace" }),
        })
      );
    });

    it("handles OWNER role when workspace already exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-existing",
      });
      await addCollaborator("ws-existing", "user-1", "OWNER");
      // Should NOT create workspace since it exists
      expect(prismaMock.workspace.create).not.toHaveBeenCalled();
      expect(prismaMock.workspaceCollaborator.upsert).toHaveBeenCalled();
    });
  });

  describe("checkWorkspaceExistence - extended", () => {
    it("returns true if collaborator count > 0", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(3);
      const result = await checkWorkspaceExistence("ws-collab");
      expect(result).toBe(true);
    });

    it("returns true if share count > 0", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(0);
      prismaMock.workspaceShare.count.mockResolvedValueOnce(2);
      const result = await checkWorkspaceExistence("ws-share");
      expect(result).toBe(true);
    });

    it("throws on DB error", async () => {
      prismaMock.workspace.findUnique.mockRejectedValueOnce(
        new Error("DB error")
      );
      await expect(checkWorkspaceExistence("ws-err")).rejects.toThrow(
        "DB error"
      );
    });
  });

  describe("createShareToken - extended", () => {
    it("creates share record with expiresAt", async () => {
      const expiresAt = new Date("2025-12-31");
      const token = await createShareToken("ws-1", "user-1", expiresAt);
      expect(token).toBeDefined();
      expect(prismaMock.workspaceShare.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt }),
        })
      );
    });

    it("throws on create error", async () => {
      prismaMock.workspaceShare.create.mockRejectedValueOnce(
        new Error("create failed")
      );
      await expect(createShareToken("ws-1", "user-1")).rejects.toThrow(
        "create failed"
      );
    });
  });

  describe("getUserInfo", () => {
    it("returns user info from DB", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Alice",
        image: "https://img.com/a.png",
        email: "alice@test.com",
      });
      const result = await getUserInfo("user-1");
      expect(result).toMatchObject({
        id: "user-1",
        name: "Alice",
        email: "alice@test.com",
      });
    });

    it("returns null when user not found", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      const result = await getUserInfo("user-missing");
      expect(result).toBeNull();
    });

    it("returns null on DB error", async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce(new Error("DB fail"));
      const result = await getUserInfo("user-err");
      expect(result).toBeNull();
    });
  });

  describe("getWorkspaceName", () => {
    it("returns name from workspace table", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "My Workspace",
      });
      const result = await getWorkspaceName("ws-1");
      expect(result).toBe("My Workspace");
    });

    it("falls back to active room name", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      // Create a real room with workspace data
      const room = roomManager.getOrCreateRoom("ws-room-fallback");
      const workspaceMap = room.doc.getMap("workspace");
      workspaceMap.set("ws-room-fallback", { name: "Room Name" });
      const result = await getWorkspaceName("ws-room-fallback");
      expect(result).toBe("Room Name");
    });

    it("falls back to stored state with getOrCreateRoom", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      // No active room - getRoom returns undefined
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      const room = roomManager.getOrCreateRoom("ws-stored");
      const workspaceMap = room.doc.getMap("workspace");
      workspaceMap.set("ws-stored", { name: "Stored Name" });
      const result = await getWorkspaceName("ws-stored");
      expect(result).toBe("Stored Name");
    });

    it("returns null when workspace has no name in stored state", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      // No active room
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      // Create room with empty workspace map
      const room = roomManager.getOrCreateRoom("ws-empty");
      room.doc.getMap("workspace"); // empty map
      const result = await getWorkspaceName("ws-empty");
      expect(result).toBeNull();
    });

    it("returns null when no workspace, room, or state exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null);
      const result = await getWorkspaceName("ws-none");
      expect(result).toBeNull();
    });

    it("returns null on DB error", async () => {
      prismaMock.workspace.findUnique.mockRejectedValueOnce(
        new Error("DB fail")
      );
      const result = await getWorkspaceName("ws-err");
      expect(result).toBeNull();
    });
  });

  describe("getShareInfo - error path", () => {
    it("returns null on DB error", async () => {
      prismaMock.workspaceShare.findUnique.mockRejectedValueOnce(
        new Error("DB down")
      );
      const result = await getShareInfo("token-err");
      expect(result).toBeNull();
    });

    it("returns info with null owner when getUserInfo fails", async () => {
      prismaMock.workspaceShare.findUnique.mockResolvedValueOnce({
        workspaceId: "ws-1",
        createdBy: "user-missing",
        expiresAt: new Date("2025-12-31"),
      });
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "Test WS",
      });

      const result = await getShareInfo("token-owner-null");
      expect(result).toMatchObject({
        workspaceId: "ws-1",
        workspaceName: "Test WS",
      });
      expect(result?.owner).toBeUndefined();
    });
  });
});
