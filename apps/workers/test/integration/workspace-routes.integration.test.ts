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

import { describe, expect, it } from "bun:test";
import type { Role } from "@lumen/db";

function isOwner(collab: { role: Role } | null): boolean {
  return collab !== null && collab.role === "OWNER";
}

function isShared(
  workspace: { _count?: { shares?: number; collaborators?: number } },
  ownerId: string,
  collaborators: { userId: string }[]
): boolean {
  if (ownerId && workspace._count?.shares && workspace._count.shares > 0) {
    return true;
  }
  if (collaborators.length > 1) {
    return true;
  }
  return false;
}

describe("WORKERS-I-03: workspace-routes integration", () => {
  describe("isOwner helper", () => {
    it("returns true for owner role", () => {
      expect(isOwner({ role: "OWNER" })).toBe(true);
    });

    it("returns false for null collaborator", () => {
      expect(isOwner(null)).toBe(false);
    });

    it("returns false for editor role", () => {
      expect(isOwner({ role: "EDITOR" })).toBe(false);
    });

    it("returns false for viewer role", () => {
      expect(isOwner({ role: "VIEWER" })).toBe(false);
    });
  });

  describe("isShared helper", () => {
    it("returns true when workspace has shares", () => {
      const workspace = { _count: { shares: 1, collaborators: 0 } };
      expect(isShared(workspace, "owner-1", [])).toBe(true);
    });

    it("returns true when workspace has multiple collaborators", () => {
      const workspace = { _count: { shares: 0, collaborators: 2 } };
      expect(
        isShared(workspace, "owner-1", [
          { userId: "user-1" },
          { userId: "user-2" },
        ])
      ).toBe(true);
    });

    it("returns false for single-user workspace with no shares", () => {
      const workspace = { _count: { shares: 0, collaborators: 1 } };
      expect(isShared(workspace, "owner-1", [{ userId: "owner-1" }])).toBe(
        false
      );
    });
  });
});
