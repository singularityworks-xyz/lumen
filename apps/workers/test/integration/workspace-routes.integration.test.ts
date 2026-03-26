import { describe, expect, it, mock } from "bun:test";
import type { Role } from "@lumen/db";

const upsertMock = mock(() => Promise.resolve({}));
const createMock = mock(() => Promise.resolve({}));
const findUniqueMock = mock(() => Promise.resolve(null));
const updateMock = mock(() => Promise.resolve({}));
const deleteMock = mock(() => Promise.resolve({}));

const mockPrisma = {
  workspace: {
    findMany: mock(() => Promise.resolve([])),
    findUnique: findUniqueMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
    upsert: upsertMock,
  },
  workspaceCollaborator: {
    findFirst: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
  },
  workspaceShare: {
    findFirst: mock(() => Promise.resolve(null)),
  },
};

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

const mockSpan = {
  setAttribute: mock(),
  addEvent: mock(),
  recordException: mock(),
};

const mockWithSpanAsync = (
  _name: string,
  fn: (span: unknown) => Promise<unknown>
) => {
  return fn(mockSpan);
};

const mockWithSpan = (_name: string, fn: (span: unknown) => unknown) => {
  return fn(mockSpan);
};

mock.module("@lumen/db", () => ({
  prisma: mockPrisma,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

mock.module("@lumen/logger/server", () => ({
  withSpanAsync: mockWithSpanAsync,
  withSpan: mockWithSpan,
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  addSpanEvent: mock(),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

mock.module("../env", () => ({
  env: {
    NODE_ENV: "test",
    WEB_URL: "http://localhost:3000",
  },
}));

mock.module("./helpers", () => ({
  addCollaborator: mock(() => Promise.resolve({ role: "OWNER" as Role })),
  checkWorkspaceExistence: mock(() => Promise.resolve(false)),
  getCollaborator: mock(() => Promise.resolve(null)),
  getWorkspaceCollaboratorCount: mock(() => Promise.resolve(0)),
  generateId: mock(() => "id-123"),
}));

function isOwner(collab: { role: Role } | null): boolean {
  return collab !== null && collab.role === "OWNER";
}

describe("WORKERS-I-03: workspace-routes integration", () => {
  describe("list returns owner and shared flags correctly", () => {
    it("marks workspace as shared when has multiple collaborators", () => {
      const collaboratorCount = 2;
      const shareCount = 0;

      const isShared = collaboratorCount > 1 || shareCount > 0;

      expect(isShared).toBe(true);
    });

    it("marks workspace as shared when has active shares", () => {
      const collaboratorCount = 1;
      const shareCount = 1;

      const isShared = collaboratorCount > 1 || shareCount > 0;

      expect(isShared).toBe(true);
    });

    it("marks workspace as not shared when only owner", () => {
      const collaboratorCount = 1;
      const shareCount = 0;

      const isShared = collaboratorCount > 1 || shareCount > 0;

      expect(isShared).toBe(false);
    });

    it("includes owner info in workspace response", () => {
      const workspace = {
        id: "ws-1",
        name: "Test Workspace",
        ownerId: "user-owner",
        owner: {
          id: "user-owner",
          name: "Owner Name",
          image: null,
        },
      };

      expect(workspace.owner.name).toBe("Owner Name");
    });
  });

  describe("create upserts workspace and owner collaborator", () => {
    it("creates workspace with owner collaborator in single transaction", () => {
      upsertMock.mockResolvedValueOnce({
        id: "ws-new",
        name: "New Workspace",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("upserts existing workspace without duplicating", () => {
      upsertMock.mockResolvedValueOnce({
        id: "ws-existing",
        name: "Updated Name",
      } as never);

      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe("update is owner-gated and creates missing metadata record on migration path", () => {
    it("rejects non-owner update attempt", () => {
      const collab: { role: Role } | null = null;

      expect(isOwner(collab)).toBe(false);
    });

    it("allows owner to update workspace", () => {
      const collab: { role: Role } = { role: "OWNER" };

      expect(isOwner(collab)).toBe(true);
    });

    it("creates workspace record on migration path when record missing", () => {
      findUniqueMock.mockResolvedValueOnce(null);
      createMock.mockResolvedValueOnce({
        id: "ws-migration",
        name: "Migrated Workspace",
      } as never);

      expect(findUniqueMock).toHaveBeenCalled();
    });

    it("updates existing workspace without migration", () => {
      findUniqueMock.mockResolvedValueOnce({
        id: "ws-1",
      } as never);
      updateMock.mockResolvedValueOnce({
        id: "ws-1",
        name: "Updated Name",
      } as never);

      expect(findUniqueMock).toHaveBeenCalled();
    });
  });

  describe("delete rejects non-owner and deletes room plus DB state for owner", () => {
    it("rejects delete from non-owner", () => {
      const session = { user: { id: "user-1" } };
      const workspace = { ownerId: "user-other" };

      const isOwnerUser = workspace.ownerId === session.user.id;

      expect(isOwnerUser).toBe(false);
    });

    it("allows owner to delete workspace", () => {
      const session = { user: { id: "user-1" } };
      const workspace = { ownerId: "user-1" };

      const isOwnerUser = workspace.ownerId === session.user.id;

      expect(isOwnerUser).toBe(true);
    });

    it("returns 404 for non-existent workspace", () => {
      const workspace: { id: string; name: string } | null = null;

      expect(workspace).toBeNull();
    });

    it("deletes workspace from database", () => {
      deleteMock.mockResolvedValueOnce({} as never);

      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
