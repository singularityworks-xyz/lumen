import { describe, expect, it } from "bun:test";

// Set environment variables BEFORE importing env.ts so createEnv doesn't throw
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.DATABASE_URL = "postgres://dummy";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

const {
  ALLOWED_ORIGINS_SCHEMA,
  BETTER_AUTH_TRUSTED_ORIGINS_SCHEMA,
  PORT_SCHEMA,
  NODE_ENV_SCHEMA,
  LOG_LEVEL_SCHEMA,
  BETTER_AUTH_SECRET_SCHEMA,
  AI_ENCRYPTION_KEY_SCHEMA,
} = await import("./env");

// ──────────────────────────────────────────────────────────────
// We test the Zod schemas used in workers/src/env.ts directly.
// ──────────────────────────────────────────────────────────────

// ─── ALLOWED_ORIGINS transform ─────────────────────────────────

describe("ALLOWED_ORIGINS transform", () => {
  it("splits comma-separated origins", () => {
    const result = ALLOWED_ORIGINS_SCHEMA.parse(
      "http://localhost:3000,http://localhost:3001"
    );
    expect(result).toEqual(["http://localhost:3000", "http://localhost:3001"]);
  });

  it("trims whitespace around origins", () => {
    const result = ALLOWED_ORIGINS_SCHEMA.parse(
      "  http://a.com , http://b.com  "
    );
    expect(result).toEqual(["http://a.com", "http://b.com"]);
  });

  it("filters empty segments from trailing commas", () => {
    const result = ALLOWED_ORIGINS_SCHEMA.parse("http://a.com,,http://b.com,");
    expect(result).toEqual(["http://a.com", "http://b.com"]);
  });

  it("handles single origin", () => {
    const result = ALLOWED_ORIGINS_SCHEMA.parse("http://localhost:3000");
    expect(result).toEqual(["http://localhost:3000"]);
  });

  it("returns undefined when not provided", () => {
    const result = ALLOWED_ORIGINS_SCHEMA.parse(undefined);
    expect(result).toBeUndefined();
  });
});

// ─── BETTER_AUTH_TRUSTED_ORIGINS transform ─────────────────────

describe("BETTER_AUTH_TRUSTED_ORIGINS transform", () => {
  it("splits origins without trimming", () => {
    const result = BETTER_AUTH_TRUSTED_ORIGINS_SCHEMA.parse(
      "http://a.com,http://b.com"
    );
    expect(result).toEqual(["http://a.com", "http://b.com"]);
  });

  it("returns undefined when not provided", () => {
    const result = BETTER_AUTH_TRUSTED_ORIGINS_SCHEMA.parse(undefined);
    expect(result).toBeUndefined();
  });
});

// ─── PORT coercion ─────────────────────────────────────────────

describe("PORT coercion", () => {
  it("coerces string to number", () => {
    expect(PORT_SCHEMA.parse("8080")).toBe(8080);
  });

  it("defaults to 3002", () => {
    expect(PORT_SCHEMA.parse(undefined)).toBe(3002);
  });

  it("accepts number directly", () => {
    expect(PORT_SCHEMA.parse(9000)).toBe(9000);
  });
});

// ─── NODE_ENV validation ───────────────────────────────────────

describe("NODE_ENV validation", () => {
  it("accepts development", () => {
    expect(NODE_ENV_SCHEMA.parse("development")).toBe("development");
  });

  it("accepts production", () => {
    expect(NODE_ENV_SCHEMA.parse("production")).toBe("production");
  });

  it("accepts test", () => {
    expect(NODE_ENV_SCHEMA.parse("test")).toBe("test");
  });

  it("defaults to development", () => {
    expect(NODE_ENV_SCHEMA.parse(undefined)).toBe("development");
  });

  it("rejects invalid value", () => {
    expect(() => NODE_ENV_SCHEMA.parse("staging")).toThrow();
  });
});

// ─── LOG_LEVEL validation ──────────────────────────────────────

describe("LOG_LEVEL validation", () => {
  it("accepts debug", () => {
    expect(LOG_LEVEL_SCHEMA.parse("debug")).toBe("debug");
  });

  it("defaults to info", () => {
    expect(LOG_LEVEL_SCHEMA.parse(undefined)).toBe("info");
  });

  it("rejects invalid level", () => {
    expect(() => LOG_LEVEL_SCHEMA.parse("trace")).toThrow();
  });
});

// ─── Secret min-length validation ──────────────────────────────

describe("BETTER_AUTH_SECRET min-length", () => {
  it("accepts 21-char secret", () => {
    const secret = "a".repeat(21);
    expect(BETTER_AUTH_SECRET_SCHEMA.parse(secret)).toBe(secret);
  });

  it("rejects 20-char secret", () => {
    expect(() => BETTER_AUTH_SECRET_SCHEMA.parse("a".repeat(20))).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => BETTER_AUTH_SECRET_SCHEMA.parse("")).toThrow();
  });
});

// ─── AI_ENCRYPTION_KEY validation ──────────────────────────────

describe("AI_ENCRYPTION_KEY validation", () => {
  it("accepts 32-char key", () => {
    const key = "x".repeat(32);
    expect(AI_ENCRYPTION_KEY_SCHEMA.parse(key)).toBe(key);
  });

  it("rejects 31-char key", () => {
    expect(() => AI_ENCRYPTION_KEY_SCHEMA.parse("x".repeat(31))).toThrow();
  });

  it("accepts undefined (optional)", () => {
    expect(AI_ENCRYPTION_KEY_SCHEMA.parse(undefined)).toBeUndefined();
  });
});
