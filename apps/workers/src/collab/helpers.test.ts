process.env.DATABASE_URL = "postgres://dummy";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { YJS_MAP_NAMES } from "@lumen/yjs-shared";

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

const mockRoom = {
  doc: {
    getMap: mock((name: string) => {
      const map = new Map();
      if (name === YJS_MAP_NAMES.WORKSPACE) {
        map.set("ws-active", { name: "Active Workspace" });
      }
      return map;
    }),
  },
};

mock.module("./room-manager", () => ({
  roomManager: {
    getRoom: mock((id: string) => (id === "ws-active" ? mockRoom : undefined)),
    getOrCreateRoom: mock(() => mockRoom),
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
    prismaMock.workspace.findUnique.mockClear();
    prismaMock.workspace.create.mockClear();
    prismaMock.workspaceState.findUnique.mockClear();
    prismaMock.workspaceShare.findUnique.mockClear();
    prismaMock.workspaceShare.count.mockClear();
    prismaMock.user.findUnique.mockClear();
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
  });
});
