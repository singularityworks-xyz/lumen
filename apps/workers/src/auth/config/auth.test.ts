import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Set up environment variables BEFORE any imports that use them
process.env.NODE_ENV = "development";
process.env.BETTER_AUTH_URL = "http://localhost:3001";
process.env.BETTER_AUTH_SECRET = "test-secret-key-min-length-32-abc123";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "http://localhost:3000";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.LOG_LEVEL = "info";
process.env.DATABASE_URL = "postgres://localhost:5432/test";

// ============================================================================
// MOCKS SETUP - Must be defined before importing the module under test
// ============================================================================

// Track calls to betterAuth and its configuration
const betterAuthCalls: unknown[] = [];

// Original getSession mock - this will be wrapped by E2E bypass
const originalGetSessionMock = mock((req: unknown) =>
  Promise.resolve({
    user: { id: "original-user", email: "original@example.com", name: "Original User" },
    session: { id: "original-session", token: "original-token", expiresAt: new Date() },
  })
);

// Mock prisma adapter
const mockPrismaAdapterResult = { type: "prisma-adapter", provider: "postgresql" };
const mockPrismaAdapter = mock(() => mockPrismaAdapterResult);

// Mock plugins
const mockBearerResult = { type: "bearer" };
const mockBearer = mock(() => mockBearerResult);

const mockJwtResult = { type: "jwt" };
const mockJwt = mock((config: unknown) => ({ ...mockJwtResult, config }));

// Mock betterAuth function
const mockBetterAuth = mock((config: Record<string, unknown>) => {
  betterAuthCalls.push(config);
  // Return a fresh mock auth object
  return {
    api: {
      getSession: originalGetSessionMock,
    },
    handler: mock(() => Promise.resolve(new Response("{}", { status: 200 }))),
  };
});

// Setup module mocks BEFORE importing auth.ts
mock.module("@lumen/db", () => ({
  prisma: {
    user: {},
    session: {},
    account: {},
    verification: {},
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

mock.module("better-auth", () => ({
  betterAuth: mockBetterAuth,
}));

mock.module("better-auth/adapters/prisma", () => ({
  prismaAdapter: mockPrismaAdapter,
}));

mock.module("better-auth/plugins", () => ({
  bearer: mockBearer,
  jwt: mockJwt,
}));

// Now import the module under test - it will use the mocked dependencies
const { auth } = await import("./auth");

// Store the initial call counts before tests clear them
const initialBetterAuthCalls = [...betterAuthCalls];
const initialPrismaAdapterCalls = [...mockPrismaAdapter.mock.calls];
const initialBearerCalls = [...mockBearer.mock.calls];
const initialJwtCalls = [...mockJwt.mock.calls];

// ============================================================================
// TEST SUITES
// ============================================================================

describe("auth/config/auth - Auth initialization", () => {
  beforeEach(() => {
    // Clear all mock call counts for isolated tests
    mockBetterAuth.mockClear();
    originalGetSessionMock.mockClear();
  });

  it("should create auth object with correct structure", () => {
    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.getSession).toBe("function");
    expect(auth.handler).toBeDefined();
    expect(typeof auth.handler).toBe("function");
  });

  it("should verify betterAuth was called during module initialization", () => {
    // The module was already imported, so we verify it was called by checking
    // that we have captured calls
    expect(initialBetterAuthCalls.length).toBeGreaterThan(0);

    const config = initialBetterAuthCalls[0] as Record<string, unknown>;
    expect(config).toBeDefined();
    expect(config.baseURL).toBe("http://localhost:3001");
    expect(config.secret).toBe("test-secret-key-min-length-32-abc123");
    expect(config.trustedOrigins).toEqual(["http://localhost:3000"]);
  });

  describe("Prisma adapter integration", () => {
    it("should verify Prisma adapter was configured during initialization", () => {
      // Verify that prismaAdapter was called during module load
      expect(initialPrismaAdapterCalls.length).toBeGreaterThan(0);
      const callArgs = initialPrismaAdapterCalls[0] as [unknown, { provider: string }];
      expect(callArgs[1]).toEqual({
        provider: "postgresql",
      });
    });

    it("should have database configured in betterAuth config", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.database).toBe(mockPrismaAdapterResult);
    });
  });

  describe("JWT plugin configuration", () => {
    it("should verify JWT plugin was called during initialization", () => {
      expect(initialJwtCalls.length).toBeGreaterThan(0);
      expect(initialJwtCalls[0][0]).toEqual({
        jwt: {
          expirationTime: "1h",
        },
        jwks: {
          disablePrivateKeyEncryption: true,
        },
      });
    });

    it("should verify bearer plugin was called during initialization", () => {
      expect(initialBearerCalls.length).toBeGreaterThan(0);
    });

    it("should have plugins array configured in betterAuth", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
      expect((config.plugins as unknown[]).length).toBe(2);
    });
  });

  describe("Session configuration", () => {
    it("should configure session with 7 day expiration", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.session).toBeDefined();
      expect((config.session as { expiresIn: number }).expiresIn).toBe(
        60 * 60 * 24 * 7
      );
    });

    it("should configure session update age to 1 day", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect((config.session as { updateAge: number }).updateAge).toBe(
        60 * 60 * 24
      );
    });

    it("should enable cookie cache with compact strategy", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      const cookieCache = (config.session as { cookieCache: { enabled: boolean; strategy: string; maxAge: number } }).cookieCache;
      expect(cookieCache).toBeDefined();
      expect(cookieCache.enabled).toBe(true);
      expect(cookieCache.strategy).toBe("compact");
      expect(cookieCache.maxAge).toBe(5 * 60);
    });
  });

  describe("Social providers configuration", () => {
    it("should configure GitHub provider with correct client ID", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.socialProviders).toBeDefined();
      expect((config.socialProviders as { github: { clientId: string } }).github.clientId).toBe(
        "test-github-client-id"
      );
    });

    it("should configure GitHub provider with correct client secret", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect((config.socialProviders as { github: { clientSecret: string } }).github.clientSecret).toBe(
        "test-github-client-secret"
      );
    });

    it("should configure GitHub provider with correct redirect URI", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect((config.socialProviders as { github: { redirectURI: string } }).github.redirectURI).toBe(
        "http://localhost:3001/api/auth/callback/github"
      );
    });
  });

  describe("Advanced configuration", () => {
    it("should configure logger with correct level and settings", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.logger).toBeDefined();
      const logger = config.logger as { level: string; disabled: boolean; verboseLogging: boolean };
      expect(logger.level).toBe("info");
      expect(logger.disabled).toBe(false);
    });

    it("should set verbose logging based on NODE_ENV", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      const logger = config.logger as { verboseLogging: boolean };
      expect(logger.verboseLogging).toBe(true); // development
    });

    it("should configure advanced cookie settings based on NODE_ENV", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.advanced).toBeDefined();
      const advanced = config.advanced as { useSecureCookies: boolean; cookieSameSite: string };
      // In development
      expect(advanced.useSecureCookies).toBe(false);
      expect(advanced.cookieSameSite).toBe("lax");
    });
  });

  describe("Email and password configuration", () => {
    it("should enable email/password auth based on NODE_ENV", () => {
      const config = initialBetterAuthCalls[0] as Record<string, unknown>;
      expect(config.emailAndPassword).toBeDefined();
      // In development, it should be enabled
      expect((config.emailAndPassword as { enabled: boolean }).enabled).toBe(true);
    });
  });
});

describe("auth/config/auth - E2E session bypass logic", () => {
  beforeEach(() => {
    originalGetSessionMock.mockClear();
  });

  describe("E2E bypass in non-production environment", () => {
    it("should return fake session when e2e-session-* cookie is present (using Headers.get)", async () => {
      const mockReq = {
        headers: new Headers({
          cookie: "e2e-session-e2e-user-abc123-some-other-data=value",
        }),
      };

      // The actual getSession has been wrapped by the E2E bypass logic
      // We need to verify the behavior by calling it
      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string; name: string; email: string; emailVerified: boolean; image: null };
        session: { id: string; token: string; userId: string };
      } | null;

      // Should return E2E bypass session, not call original
      expect(originalGetSessionMock).not.toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result!.user).toBeDefined();
      expect(result!.user.id).toBe("e2e-user-abc123");
      expect(result!.user.name).toBe("E2E User");
      expect(result!.user.email).toBe("e2e-user-abc123@e2e.test");
      expect(result!.user.emailVerified).toBe(true);
      expect(result!.user.image).toBeNull();
      expect(result!.session).toBeDefined();
      expect(result!.session.token).toBe("e2e-token");
    });

    it("should return fake session when x-e2e-bypass header is present", async () => {
      const mockReq = {
        headers: new Headers({
          "x-e2e-bypass": "true",
          "x-e2e-user-id": "custom-e2e-user",
        }),
      };

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string; name: string; email: string };
        session: { id: string; token: string };
      } | null;

      expect(result).toBeDefined();
      expect(result!.user.id).toBe("custom-e2e-user");
      expect(result!.user.name).toBe("E2E User");
      expect(result!.user.email).toBe("custom-e2e-user@e2e.test");
      expect(result!.session.id).toBe("e2e-session");
    });

    it("should call original getSession when no E2E bypass indicators present", async () => {
      const mockReq = {
        headers: new Headers({
          cookie: "regular-session=value; other-cookie=data",
        }),
      };

      // Setup the original mock to return a specific value
      originalGetSessionMock.mockResolvedValueOnce({
        user: { id: "original-user", email: "original@example.com", name: "Original User" },
        session: { id: "original-session", token: "original-token", expiresAt: new Date() },
      });

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string };
        session: { token: string };
      } | null;

      // Should get the original response
      expect(originalGetSessionMock).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result!.user.id).toBe("original-user");
      expect(result!.session.token).toBe("original-token");
    });

    it("should handle plain object headers (non-Headers instance)", async () => {
      const mockReq = {
        headers: {
          "x-e2e-bypass": "true",
          "x-e2e-user-id": "plain-object-user",
          cookie: "some=value",
        },
      };

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string };
      } | null;

      expect(result).toBeDefined();
      expect(result!.user.id).toBe("plain-object-user");
    });

    it("should extract user ID from various e2e-session cookie patterns", async () => {
      const testCases = [
        {
          cookie: "e2e-session-e2e-user-abc123-value",
          expectedId: "e2e-user-abc123",
        },
        {
          cookie: "e2e-session-e2e-user-deadbeef7890-more-data",
          expectedId: "e2e-user-deadbeef7890",
        },
      ];

      for (const { cookie, expectedId } of testCases) {
        originalGetSessionMock.mockClear();

        const mockReq = {
          headers: new Headers({ cookie }),
        };

        const result = (await auth.api.getSession(mockReq)) as {
          user: { id: string };
        } | null;

        expect(result).toBeDefined();
        expect(result!.user.id).toBe(expectedId);
      }
    });

    it("should handle missing headers gracefully", async () => {
      const mockReq = {};

      // Setup the original mock
      originalGetSessionMock.mockResolvedValueOnce({
        user: { id: "fallback-user", email: "fallback@example.com", name: "Fallback User" },
        session: { id: "fallback-session", token: "fallback-token", expiresAt: new Date() },
      });

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string };
      } | null;

      // Should call original and return its response
      expect(originalGetSessionMock).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result!.user.id).toBe("fallback-user");
    });

    it("should use default e2e-user ID when no specific user ID in cookie", async () => {
      const mockReq = {
        headers: new Headers({
          cookie: "e2e-session-e2e-user-=value; other=data",
        }),
      };

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string };
      } | null;

      expect(result).toBeDefined();
      expect(result!.user.id).toBe("e2e-user");
    });

    it("should prefer x-e2e-user-id header over cookie user ID", async () => {
      const mockReq = {
        headers: new Headers({
          cookie: "e2e-session-e2e-user-cookie123-value",
          "x-e2e-bypass": "true",
          "x-e2e-user-id": "header-user-id",
        }),
      };

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string };
      } | null;

      expect(result).toBeDefined();
      expect(result!.user.id).toBe("header-user-id");
    });

    it("should include all required session fields in fake session", async () => {
      const mockReq = {
        headers: new Headers({
          "x-e2e-bypass": "true",
        }),
      };

      const result = (await auth.api.getSession(mockReq)) as {
        user: { id: string; name: string; email: string; emailVerified: boolean; image: null; createdAt: Date; updatedAt: Date };
        session: { id: string; userId: string; token: string; expiresAt: Date; ipAddress: null; userAgent: null; createdAt: Date; updatedAt: Date };
      } | null;

      expect(result).toBeDefined();
      expect(result!.user).toHaveProperty("id");
      expect(result!.user).toHaveProperty("name");
      expect(result!.user).toHaveProperty("email");
      expect(result!.user).toHaveProperty("emailVerified");
      expect(result!.user).toHaveProperty("image");
      expect(result!.user).toHaveProperty("createdAt");
      expect(result!.user).toHaveProperty("updatedAt");
      expect(result!.session).toHaveProperty("id");
      expect(result!.session).toHaveProperty("userId");
      expect(result!.session).toHaveProperty("token");
      expect(result!.session).toHaveProperty("expiresAt");
      expect(result!.session).toHaveProperty("ipAddress");
      expect(result!.session).toHaveProperty("userAgent");
      expect(result!.session).toHaveProperty("createdAt");
      expect(result!.session).toHaveProperty("updatedAt");
    });

    it("should set session expiration in the future", async () => {
      const mockReq = {
        headers: new Headers({
          "x-e2e-bypass": "true",
        }),
      };

      const beforeCall = Date.now();
      const result = (await auth.api.getSession(mockReq)) as {
        session: { expiresAt: Date };
      } | null;
      const afterCall = Date.now();

      expect(result).toBeDefined();
      const expiresAt = new Date(result!.session.expiresAt).getTime();
      // Expiration should be around 100 seconds from now (as defined in auth.ts)
      expect(expiresAt).toBeGreaterThan(beforeCall);
      expect(expiresAt).toBeGreaterThan(afterCall - 1000); // Allow 1 second buffer
    });
  });
});

describe("auth/config/auth - E2E bypass disabled in production", () => {
  it("should contain NODE_ENV production check in source code", async () => {
    // Read the source file to verify the production check exists
    const fs = await import("fs");
    const sourcePath = new URL("./auth.ts", import.meta.url).pathname;
    const sourceContent = fs.readFileSync(sourcePath, "utf-8");

    // Verify the production check is in the source
    expect(sourceContent).toContain('env.NODE_ENV !== "production"');
  });

  it("should have E2E_SESSION_REGEX defined at top level", async () => {
    const fs = await import("fs");
    const sourcePath = new URL("./auth.ts", import.meta.url).pathname;
    const sourceContent = fs.readFileSync(sourcePath, "utf-8");

    expect(sourceContent).toContain("E2E_SESSION_REGEX");
    expect(sourceContent).toContain("e2e-session-");
    expect(sourceContent).toContain("e2e-user-[a-f0-9]+");
  });
});

describe("auth/config/auth - Type exports", () => {
  it("should export Auth type", async () => {
    // Auth is a type export, which is stripped at runtime
    // We verify the module has an export called Auth
    const module = await import("./auth");
    // TypeScript type exports don't exist at runtime, so we check
    // that the module has the expected structure
    expect(module).toHaveProperty("auth");
    expect(typeof module.auth).toBe("object");
    expect(module.auth).toBe(auth);

    // Also verify the auth object structure indicates proper typing
    expect(module.auth).toHaveProperty("api");
    expect(module.auth).toHaveProperty("handler");
  });
});

// Cleanup
afterAll(() => {
  mock.restore();
});
