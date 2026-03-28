import { beforeEach, describe, expect, it, mock } from "bun:test";

const prismaMock = {
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

// Provide a controllable roomManager mock
const mockGetRoom = mock(() => undefined as unknown);
const mockGetOrCreateRoom = mock(
  () =>
    ({
      doc: { getMap: () => new Map() },
    }) as unknown
);

mock.module("../../src/collab/room-manager", () => ({
  roomManager: {
    getRoom: mockGetRoom,
    getOrCreateRoom: mockGetOrCreateRoom,
  },
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
  getWorkspaceCollaboratorCount,
} from "./helpers";

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
    mockGetRoom.mockClear();
    mockGetOrCreateRoom.mockClear();
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
      prismaMock.workspaceCollaborator.findUnique.mockResolvedValueOnce(
        null as any
      );
      const result = await getCollaborator("ws-1", "user-1");
      expect(result).toBeNull();
    });

    it("returns role if collaborator exists", async () => {
      prismaMock.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "EDITOR",
      } as any);
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
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
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
      } as any);
      const result = await checkWorkspaceExistence("ws-1");
      expect(result).toBe(true);
    });

    it("returns true if state exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce({
        id: "ws-1",
      } as any);
      const result = await checkWorkspaceExistence("ws-1");
      expect(result).toBe(true);
    });

    it("returns false if nothing exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(0 as any);
      prismaMock.workspaceShare.count.mockResolvedValueOnce(0 as any);
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
      prismaMock.workspaceShare.findUnique.mockResolvedValueOnce(null as any);
      const result = await getShareInfo("token-1");
      expect(result).toBeNull();
    });

    it("returns aggregated info if share exists", async () => {
      prismaMock.workspaceShare.findUnique.mockResolvedValueOnce({
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
      } as any);
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      } as any);
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "Workspace Name",
      } as any);

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
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(5 as any);
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
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      // Simulate a room with workspace data
      const wsMap = new Map();
      wsMap.set("ws-room", { name: "Room Workspace" });
      mockGetRoom.mockReturnValueOnce({
        doc: {
          getMap: (key: string) => (key === "workspace" ? wsMap : new Map()),
        },
      });
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
      } as any);
      await addCollaborator("ws-existing", "user-1", "OWNER");
      // Should NOT create workspace since it exists
      expect(prismaMock.workspace.create).not.toHaveBeenCalled();
      expect(prismaMock.workspaceCollaborator.upsert).toHaveBeenCalled();
    });
  });

  describe("checkWorkspaceExistence - extended", () => {
    it("returns true if collaborator count > 0", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(3 as any);
      const result = await checkWorkspaceExistence("ws-collab");
      expect(result).toBe(true);
    });

    it("returns true if share count > 0", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspaceCollaborator.count.mockResolvedValueOnce(0 as any);
      prismaMock.workspaceShare.count.mockResolvedValueOnce(2 as any);
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
      } as any);
      const { getUserInfo: getUser } = await import("./helpers");
      const result = await getUser("user-1");
      expect(result).toMatchObject({
        id: "user-1",
        name: "Alice",
        email: "alice@test.com",
      });
    });

    it("returns null when user not found", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null as any);
      const { getUserInfo: getUser } = await import("./helpers");
      const result = await getUser("user-missing");
      expect(result).toBeNull();
    });

    it("returns null on DB error", async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce(new Error("DB fail"));
      const { getUserInfo: getUser } = await import("./helpers");
      const result = await getUser("user-err");
      expect(result).toBeNull();
    });
  });

  describe("getWorkspaceName", () => {
    it("returns name from workspace table", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "My Workspace",
      } as any);
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-1");
      expect(result).toBe("My Workspace");
    });

    it("falls back to active room name", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      const wsMap = new Map();
      wsMap.set("ws-room-fallback", { name: "Room Name" });
      mockGetRoom.mockReturnValueOnce({
        doc: {
          getMap: (key: string) => (key === "workspace" ? wsMap : new Map()),
        },
      });
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-room-fallback");
      expect(result).toBe("Room Name");
    });

    it("falls back to stored state with getOrCreateRoom", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      mockGetRoom.mockReturnValueOnce(undefined);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce({
        yjsState: Buffer.from("state"),
      } as any);
      const wsMap = new Map();
      wsMap.set("ws-stored", { name: "Stored Name" });
      mockGetOrCreateRoom.mockReturnValueOnce({
        doc: {
          getMap: (key: string) => (key === "workspace" ? wsMap : new Map()),
        },
      });
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-stored");
      expect(result).toBe("Stored Name");
    });

    it("returns null when workspace has no name in stored state", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      mockGetRoom.mockReturnValueOnce(undefined);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce({
        yjsState: Buffer.from("state"),
      } as any);
      mockGetOrCreateRoom.mockReturnValueOnce({
        doc: { getMap: () => new Map() },
      });
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-empty");
      expect(result).toBeNull();
    });

    it("returns null when no workspace, room, or state exists", async () => {
      prismaMock.workspace.findUnique.mockResolvedValueOnce(null as any);
      mockGetRoom.mockReturnValueOnce(undefined);
      prismaMock.workspaceState.findUnique.mockResolvedValueOnce(null as any);
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-none");
      expect(result).toBeNull();
    });

    it("returns null on DB error", async () => {
      prismaMock.workspace.findUnique.mockRejectedValueOnce(
        new Error("DB fail")
      );
      const { getWorkspaceName: getName } = await import("./helpers");
      const result = await getName("ws-err");
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
      } as any);
      prismaMock.user.findUnique.mockResolvedValueOnce(null as any);
      prismaMock.workspace.findUnique.mockResolvedValueOnce({
        name: "Test WS",
      } as any);

      const result = await getShareInfo("token-owner-null");
      expect(result).toMatchObject({
        workspaceId: "ws-1",
        workspaceName: "Test WS",
      });
      expect(result?.owner).toBeUndefined();
    });
  });
});
