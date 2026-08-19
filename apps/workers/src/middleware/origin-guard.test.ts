import { describe, expect, it } from "bun:test";

process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3002";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.INTERNAL_API_KEY = "test-internal-key";

const { Elysia } = await import("elysia");
const { isAllowedOrigin, originGuard } = await import("./origin-guard");

describe("isAllowedOrigin", () => {
  it("allows exact match for default origins", () => {
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedOrigin("tauri://localhost")).toBe(true);
    expect(isAllowedOrigin("http://tauri.localhost")).toBe(true);
    expect(isAllowedOrigin("https://tauri.localhost")).toBe(true);
  });

  it("allows configured custom origins", () => {
    expect(
      isAllowedOrigin("https://app.lumen.dev", ["https://app.lumen.dev"])
    ).toBe(true);
  });

  it("allows loopback aliases for local dev", () => {
    expect(isAllowedOrigin("http://0.0.0.0:3000")).toBe(true);
  });

  it("blocks untrusted external origins", () => {
    expect(isAllowedOrigin("http://evil.com")).toBe(false);
    expect(isAllowedOrigin("https://attacker.org")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});

describe("originGuard middleware", () => {
  const createTestApp = () =>
    new Elysia()
      .use(originGuard)
      .get("/test", () => ({ success: true }))
      .get("/api/auth/jwks", () => ({ keys: [] }))
      .get("/api/auth/callback/github", () => ({ callback: true }));

  it("allows requests from allowed origin", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: {
          origin: "http://localhost:3000",
        },
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  it("allows requests with allowed referer header", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: {
          referer: "http://localhost:3000/boards/ws-1",
        },
      })
    );

    expect(res.status).toBe(200);
  });

  it("blocks requests with untrusted origin", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: {
          origin: "http://evil.com",
        },
      })
    );

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Forbidden");
  });

  it("blocks direct browser navigation requests (sec-fetch-dest: document)", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: {
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
        },
      })
    );

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string; message: string };
    expect(data.message).toBe("Direct browser access is blocked");
  });

  it("allows OAuth callback endpoints even on browser navigation", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/api/auth/callback/github", {
        headers: {
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
        },
      })
    );

    expect(res.status).toBe(200);
  });

  it("allows /api/auth/jwks endpoint without Origin header for JWT verification", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/api/auth/jwks", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { keys: unknown[] };
    expect(data.keys).toBeDefined();
  });

  it("allows internal service calls with x-internal-key", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: {
          "x-internal-key": "test-internal-key",
        },
      })
    );

    expect(res.status).toBe(200);
  });

  it("allows CORS OPTIONS preflight", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/test", {
        method: "OPTIONS",
      })
    );

    expect(res.status).not.toBe(403);
  });
});
