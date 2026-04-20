process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

import { describe, expect, it, mock } from "bun:test";

// Set up minimal mocks before importing routes
// This prevents module caching issues when running tests together
mock.module("@lumen/db", () => ({
  prisma: {
    workspace: {
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({})),
      update: mock(() => Promise.resolve({})),
      delete: mock(() => Promise.resolve({})),
      findMany: mock(() => Promise.resolve([])),
      upsert: mock(() => Promise.resolve({})),
    },
    workspaceState: {
      findUnique: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve({})),
    },
    workspaceCollaborator: {
      findUnique: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
      upsert: mock(() => Promise.resolve({})),
    },
    workspaceShare: {
      findFirst: mock(() => Promise.resolve(null)),
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ token: "share-token" })),
    },
    user: {
      findUnique: mock(() => Promise.resolve(null)),
    },
  },
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
  withSpan: (_name: string, fn: (span: unknown) => unknown) => fn(null),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

describe("collabRoutes", () => {
  it("exports an Elysia instance", async () => {
    const mod = await import("./routes");
    expect(mod.collabRoutes).toBeDefined();
  });
});
