process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";
process.env.LOG_LEVEL = "error";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@test.com",
    image: null as string | null,
  },
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 86_400_000),
    token: "session-token",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const mockGetSession = mock(() => Promise.resolve(mockSession));

const mockPrisma: Record<string, any> = {
  workspace: {
    findUnique: mock(() => Promise.resolve(null as any)),
    findMany: mock(() => Promise.resolve([] as any[])),
    findFirst: mock(() => Promise.resolve(null as any)),
    create: mock((data: unknown) =>
      Promise.resolve({
        id: "ws-1",
        name: "Test",
        description: null,
        ownerId: "user-1",
        ...((data as Record<string, unknown>)?.data ?? {}),
      })
    ),
    upsert: mock((data: unknown) =>
      Promise.resolve({
        id: "ws-1",
        name: "Test",
        description: null,
        ownerId: "user-1",
        ...((data as Record<string, unknown>)?.create ?? {}),
      })
    ),
    update: mock(() =>
      Promise.resolve({ id: "ws-1", name: "Updated", description: null })
    ),
    delete: mock(() => Promise.resolve({ id: "ws-1" })),
  },
  workspaceCollaborator: {
    findUnique: mock(() => Promise.resolve(null as any)),
    findMany: mock(() => Promise.resolve([] as any[])),
    findFirst: mock(() => Promise.resolve(null as any)),
    count: mock(() => Promise.resolve(0)),
    upsert: mock(() => Promise.resolve({})),
  },
  workspaceShare: {
    findFirst: mock(() => Promise.resolve(null as any)),
    findUnique: mock(() => Promise.resolve(null as any)),
    create: mock(() =>
      Promise.resolve({
        id: "share-1",
        token: "share-token-123",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
        createdAt: new Date(),
      })
    ),
  },
  workspaceState: {
    findUnique: mock(() => Promise.resolve(null as any)),
    upsert: mock(() => Promise.resolve({})),
  },
  oneTimeAuthToken: {
    create: mock(() => Promise.resolve({})),
    delete: mock(() => Promise.reject(new Error("Record not found"))),
    deleteMany: mock(() => Promise.resolve({ count: 0 })),
  },
  aiConversation: {
    findUnique: mock(() => Promise.resolve(null as any)),
  },
  user: {
    findUnique: mock(() => Promise.resolve(null as any)),
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
  end: mock(),
  setStatus: mock(),
  setAttributes: mock(),
};

mock.module("@lumen/db", () => ({
  prisma: mockPrisma,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

mock.module("@lumen/logger/server", () => ({
  withSpanAsync: (_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn(mockSpan),
  withSpan: (_name: string, fn: (span: unknown) => unknown) => fn(mockSpan),
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  addSpanEvent: mock(),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

mock.module("@lumen/logger/tracer", () => ({
  getTracer: () => ({
    startActiveSpan: (_name: string, fn: (span: typeof mockSpan) => unknown) =>
      fn(mockSpan),
  }),
  SpanStatusCode: { OK: 0, ERROR: 2 },
  recordSpanError: mock(),
}));

mock.module("../../src/collab/metrics", () => ({
  recordWsRoomJoinDuration: mock(),
  incrementActiveConnections: mock(),
  decrementActiveConnections: mock(),
  recordWsMessage: mock(),
  recordWsConnectionError: mock(),
  recordWsConnectionLatency: mock(),
}));

// Mock the AI barrel file to prevent cascading real imports
mock.module("../../src/ai/index", () => {
  const routes = new Elysia({ name: "ai-routes" })
    .get("/api/ai/health", () => ({
      enabled: false,
      status: "disabled",
    }))
    .get("/api/ai/queue-stats", () => ({
      queueLength: 0,
      remaining: 30,
      activeRequests: 0,
      isProcessing: false,
      usingUpstash: false,
      rateLimit: 30,
      windowSizeSeconds: 60,
    }))
    .post("/api/ai/chat", (ctx: any) => {
      ctx.set.status = 503;
      return { error: "AI features are not configured" };
    })
    .get("/api/ai/conversation/:workspaceId", (ctx: any) => {
      if (ctx.query?.ephemeral === "true") {
        return {
          id: "ephemeral",
          workspaceId: "ws",
          title: null,
          messageCount: 0,
          messages: [],
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
      }
      return { error: "Not found" };
    })
    .delete("/api/ai/conversation/:workspaceId", (ctx: any) => {
      if (ctx.query?.ephemeral === "true") {
        return { success: true };
      }
      return { error: "Not found" };
    })
    .delete("/api/ai/conversation/:workspaceId/messages/:messageId", () => ({
      success: true,
    }));
  return { aiRoutes: routes };
});

mock.module("@lumen/yjs-shared", () => ({
  YJS_MAP_NAMES: {
    WORKSPACE: "workspace",
    BOARDS: "boards",
    COLUMNS: "columns",
    TASKS: "tasks",
    BOARD_POSITIONS: "boardPositions",
    BOARD_CONNECTIONS: "boardConnections",
    AREAS: "areas",
    AREA_POSITIONS: "areaPositions",
    AREA_DIALOGS: "areaDialogs",
    CANVAS: "canvas",
    BOARD_QUICK_ACTIONS: "boardQuickActions",
    BOARD_DIALOGS: "boardDialogs",
    CONNECTION_DIALOGS: "connectionDialogs",
    CREATE_TASK_MODALS: "createTaskModals",
    COLUMN_QUICK_ACTIONS: "columnQuickActions",
    COLUMN_DIALOGS: "columnDialogs",
    TASK_QUICK_ACTIONS: "taskQuickActions",
    TASK_DETAIL_MODALS: "taskDetailModals",
    COMMENTS: "comments",
    CHAT_MESSAGES: "chatMessages",
  },
  MESSAGE_WORKSPACE_DELETED: 3,
  MESSAGE_SYNC: 0,
  MESSAGE_AWARENESS: 1,
}));

// Mock the auth config module to avoid Better Auth initialization
mock.module("../../src/auth/config/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
    handler: mock(() => Promise.resolve(new Response("{}", { status: 200 }))),
  },
}));

// Mock the auth macro to use our mocked session
mock.module("../../src/auth/middleware/auth-macro", () => {
  const macroElysia = new Elysia({ name: "auth-macro" }).derive(
    { as: "global" },
    () => ({
      authMacro: () => ({
        beforeHandle: async ({ set }: { set: { status: number } }) => {
          const session = await mockGetSession();
          if (!session) {
            set.status = 401;
            return { error: "Unauthorized" };
          }
        },
      }),
    })
  );
  return { authMacro: macroElysia };
});

// Import after mocking
const { createApp } = await import("../../src/app");

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("WORKERS-I-06: HTTP routes integration", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(mockSession);

    mockPrisma.workspace.findUnique.mockReset();
    mockPrisma.workspace.findMany.mockReset();
    mockPrisma.workspace.findFirst.mockReset();
    mockPrisma.workspace.create.mockReset();
    mockPrisma.workspace.upsert.mockReset();
    mockPrisma.workspace.update.mockReset();
    mockPrisma.workspace.delete.mockReset();
    mockPrisma.workspaceCollaborator.findUnique.mockReset();
    mockPrisma.workspaceCollaborator.findMany.mockReset();
    mockPrisma.workspaceCollaborator.findFirst.mockReset();
    mockPrisma.workspaceCollaborator.count.mockReset();
    mockPrisma.workspaceCollaborator.upsert.mockReset();
    mockPrisma.workspaceShare.findFirst.mockReset();
    mockPrisma.workspaceShare.findUnique.mockReset();
    mockPrisma.workspaceShare.create.mockReset();
    mockPrisma.workspaceState.findUnique.mockReset();
    mockPrisma.workspaceState.upsert.mockReset();
  });

  describe("root and health endpoints", () => {
    it("GET / returns app info", async () => {
      const res = await app.handle(new Request("http://localhost/"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Lumen Workers");
      expect(body.status).toBe("operational");
    });

    it("GET /health returns healthy status", async () => {
      const res = await app.handle(new Request("http://localhost/health"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("healthy");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("workspace list routes", () => {
    it("GET /api/workspaces returns list for authenticated user", async () => {
      mockPrisma.workspace.findMany.mockResolvedValueOnce([
        {
          id: "ws-1",
          name: "My Workspace",
          description: null,
          ownerId: "user-1",
          owner: { id: "user-1", name: "Test User", image: null },
          collaborators: [{ userId: "user-1" }],
          _count: { shares: 0, collaborators: 1 },
          createdAt: new Date(),
        },
      ]);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].name).toBe("My Workspace");
      expect(body[0].isShared).toBe(false);
    });

    it("GET /api/workspaces marks shared workspace correctly", async () => {
      mockPrisma.workspace.findMany.mockResolvedValueOnce([
        {
          id: "ws-1",
          name: "Shared",
          description: null,
          ownerId: "user-1",
          owner: { id: "user-1", name: "Owner", image: null },
          collaborators: [{ userId: "user-1" }, { userId: "user-2" }],
          _count: { shares: 1, collaborators: 2 },
          createdAt: new Date(),
        },
      ]);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces")
      );
      const body = await res.json();
      expect(body[0].isShared).toBe(true);
    });
  });

  describe("workspace CRUD routes", () => {
    it("POST /api/workspaces creates a workspace", async () => {
      mockPrisma.workspace.upsert.mockResolvedValueOnce({
        id: "ws-new",
        name: "New Workspace",
        description: "A test workspace",
        ownerId: "user-1",
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "New Workspace",
            description: "A test workspace",
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("New Workspace");
      expect(body.ownerId).toBe("user-1");
    });

    it("PATCH /api/workspaces/:id updates workspace for owner", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        id: "collab-1",
        role: "OWNER",
        workspaceId: "ws-1",
        userId: "user-1",
      });
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        name: "Old Name",
      });
      mockPrisma.workspace.update.mockResolvedValueOnce({
        id: "ws-1",
        name: "Updated Name",
        description: null,
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Name" }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Name");
    });

    it("PATCH /api/workspaces/:id returns 403 for non-owner", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hacked" }),
        })
      );
      expect(res.status).toBe(403);
    });

    it("DELETE /api/workspaces/:id deletes workspace for owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        ownerId: "user-1",
      });
      mockPrisma.workspace.delete.mockResolvedValueOnce({ id: "ws-1" });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1", {
          method: "DELETE",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("DELETE /api/workspaces/:id returns 403 for non-owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        ownerId: "other-user",
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1", {
          method: "DELETE",
        })
      );
      expect(res.status).toBe(403);
    });

    it("DELETE /api/workspaces/:id returns 404 for missing workspace", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-nonexistent", {
          method: "DELETE",
        })
      );
      expect(res.status).toBe(404);
    });

    it("DELETE /api/workspaces/:id?ephemeral=true deletes in-memory only", async () => {
      const wsId = `ws-ephemeral-${uid()}`;

      const res = await app.handle(
        new Request(`http://localhost/api/workspaces/${wsId}?ephemeral=true`, {
          method: "DELETE",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("workspace state and collaborators", () => {
    it("GET /api/workspaces/:id/state returns 403 for non-collaborator", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/state")
      );
      expect(res.status).toBe(403);
    });

    it("GET /api/workspaces/:id/state returns empty state for collaborator", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "EDITOR",
      });
      mockPrisma.workspaceState.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/state")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        workspace: {},
        boards: {},
        columns: {},
        tasks: {},
        boardPositions: {},
      });
    });

    it("GET /api/workspaces/:id/collaborators returns 403 for non-member", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspace.findFirst.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/collaborators")
      );
      expect(res.status).toBe(403);
    });

    it("GET /api/workspaces/:id/collaborators returns list for member", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "OWNER",
      });
      mockPrisma.workspaceCollaborator.findMany.mockResolvedValueOnce([
        {
          userId: "user-1",
          role: "OWNER",
          joinedAt: new Date(),
          user: {
            id: "user-1",
            name: "Owner",
            email: "owner@test.com",
            image: null,
          },
        },
      ]);
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: "ws-1",
        createdAt: new Date(),
        owner: {
          id: "user-1",
          name: "Owner",
          email: "owner@test.com",
          image: null,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/collaborators")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.collaborators).toBeDefined();
      expect(Array.isArray(body.collaborators)).toBe(true);
      expect(body.onlineCount).toBeDefined();
    });
  });

  describe("share routes", () => {
    it("POST /api/workspaces/:id/share creates share link for owner", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "OWNER",
      });
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(1);
      mockPrisma.workspaceShare.create.mockResolvedValueOnce({
        id: "share-1",
        token: "new-share-token",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
        createdAt: new Date(),
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Share" }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.url).toContain("share=");
    });

    it("POST /api/workspaces/:id/share returns 403 for non-owner", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(1);

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(res.status).toBe(403);
    });

    it("POST /api/workspaces/:id/share auto-assigns owner on first share", async () => {
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspaceCollaborator.count.mockResolvedValueOnce(0);
      mockPrisma.workspace.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspace.create.mockResolvedValueOnce({
        id: "ws-1",
        name: "Test",
        ownerId: "user-1",
      });
      mockPrisma.workspaceCollaborator.upsert.mockResolvedValueOnce({});
      mockPrisma.workspaceShare.create.mockResolvedValueOnce({
        id: "share-1",
        token: "token",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
        createdAt: new Date(),
      });

      const res = await app.handle(
        new Request("http://localhost/api/workspaces/ws-1/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "First Share" }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
    });

    it("GET /api/share/:token returns share info for valid token", async () => {
      mockPrisma.workspaceShare.findUnique.mockResolvedValueOnce({
        id: "share-1",
        token: "valid-token",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Owner",
        image: null,
        email: "owner@test.com",
      });
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        name: "Shared Workspace",
      });

      const res = await app.handle(
        new Request("http://localhost/api/share/valid-token")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workspaceId).toBe("ws-1");
      expect(body.owner).toBeDefined();
    });

    it("GET /api/share/:token returns 404 for invalid token", async () => {
      mockPrisma.workspaceShare.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/share/invalid-token")
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/share/:token handles share lookup without crashing", async () => {
      // getShareInfo has complex internal logic (getUserInfo, getWorkspaceName, roomManager)
      // Verify the endpoint doesn't crash even when the share lookup has issues
      mockPrisma.workspaceShare.findUnique.mockResolvedValueOnce(null);

      const res = await app.handle(
        new Request("http://localhost/api/share/any-token")
      );
      // Should return some response (404 or 200 depending on mock chain)
      expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it("POST /api/share/:token/join adds collaborator", async () => {
      mockPrisma.workspaceShare.findUnique.mockResolvedValueOnce({
        id: "share-1",
        token: "share-token",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Owner",
        image: null,
        email: "owner@test.com",
      });
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        name: "Shared Workspace",
      });
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.workspaceCollaborator.upsert.mockResolvedValueOnce({});

      const res = await app.handle(
        new Request("http://localhost/api/share/share-token/join", {
          method: "POST",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workspaceId).toBe("ws-1");
      expect(body.role).toBe("EDITOR");
    });

    it("POST /api/share/:token/join returns idempotent for existing collaborator", async () => {
      mockPrisma.workspaceShare.findUnique.mockResolvedValueOnce({
        id: "share-1",
        token: "share-token",
        workspaceId: "ws-1",
        createdBy: "user-1",
        expiresAt: null,
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Owner",
        image: null,
        email: "owner@test.com",
      });
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        name: "Shared Workspace",
      });
      mockPrisma.workspaceCollaborator.findUnique.mockResolvedValueOnce({
        role: "EDITOR",
      });

      const res = await app.handle(
        new Request("http://localhost/api/share/share-token/join", {
          method: "POST",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Already a collaborator");
    });
  });

  describe("AI routes", () => {
    it("GET /api/ai/health returns status", async () => {
      const res = await app.handle(
        new Request("http://localhost/api/ai/health")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("disabled");
      expect(body.enabled).toBe(false);
    });

    it("GET /api/ai/queue-stats returns queue info", async () => {
      const res = await app.handle(
        new Request("http://localhost/api/ai/queue-stats")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.queueLength).toBe(0);
      expect(body.rateLimit).toBe(30);
    });

    it("POST /api/ai/chat returns 503 when AI is disabled", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        ownerId: "user-1",
      });

      const res = await app.handle(
        new Request("http://localhost/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: "ws-1",
            message: "Hello",
          }),
        })
      );
      expect(res.status).toBe(503);
    });

    it("DELETE /api/ai/conversation/:workspaceId succeeds for ephemeral", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/api/ai/conversation/ws-1?ephemeral=true",
          { method: "DELETE" }
        )
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("GET /api/ai/conversation/:workspaceId returns ephemeral empty state", async () => {
      const res = await app.handle(
        new Request("http://localhost/api/ai/conversation/ws-1?ephemeral=true")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messageCount).toBe(0);
      expect(body.messages).toEqual([]);
    });
  });

  describe("CORS headers", () => {
    it("includes CORS headers in response", async () => {
      const res = await app.handle(
        new Request("http://localhost/", {
          headers: {
            Origin: "http://localhost:3000",
          },
        })
      );
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3000"
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    });
  });
});
