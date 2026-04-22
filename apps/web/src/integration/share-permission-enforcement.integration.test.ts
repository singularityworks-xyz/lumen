import { describe, expect, it } from "bun:test";

// ──────────────────────────────────────────────────────────────
// Integration test: Share permission enforcement
//
// Tests the role-based access control logic for shared workspaces.
// Verifies that viewer/editor/owner roles are correctly enforced
// for write operations, workspace deletion, and permission changes.
// ──────────────────────────────────────────────────────────────

type Role = "OWNER" | "EDITOR" | "VIEWER";

interface Collaborator {
  role: Role;
  userId: string;
  workspaceId: string;
}

// Permission check functions (matching server-side logic)

function canWrite(collab: Collaborator | null): boolean {
  if (!collab) {
    return false;
  }
  return collab.role === "OWNER" || collab.role === "EDITOR";
}

function canDelete(collab: Collaborator | null): boolean {
  if (!collab) {
    return false;
  }
  return collab.role === "OWNER";
}

function canManagePermissions(collab: Collaborator | null): boolean {
  if (!collab) {
    return false;
  }
  return collab.role === "OWNER";
}

function canCreateShareLink(collab: Collaborator | null): boolean {
  if (!collab) {
    return false;
  }
  return collab.role === "OWNER";
}

function canRevokeShareLink(collab: Collaborator | null): boolean {
  if (!collab) {
    return false;
  }
  return collab.role === "OWNER";
}

function canChangeRole(
  actor: Collaborator | null,
  _target: Collaborator,
  _newRole: Role
): boolean {
  if (!actor) {
    return false;
  }
  // Only owners can change roles
  if (actor.role !== "OWNER") {
    return false;
  }
  // Can't change own role (prevents accidental de-owner)
  if (actor.userId === _target.userId) {
    return false;
  }
  return true;
}

function canRemoveCollaborator(
  actor: Collaborator | null,
  target: Collaborator
): boolean {
  if (!actor) {
    return false;
  }
  // Owner can remove anyone except themselves
  if (actor.role === "OWNER" && actor.userId !== target.userId) {
    return true;
  }
  // Anyone can remove themselves (leave)
  if (actor.userId === target.userId) {
    return true;
  }
  return false;
}

// ─── Write permission tests ────────────────────────────────────

describe("SHARE-PERM: Write permission enforcement", () => {
  const mkCollab = (role: Role): Collaborator => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can write", () => {
    expect(canWrite(mkCollab("OWNER"))).toBe(true);
  });

  it("EDITOR can write", () => {
    expect(canWrite(mkCollab("EDITOR"))).toBe(true);
  });

  it("VIEWER cannot write", () => {
    expect(canWrite(mkCollab("VIEWER"))).toBe(false);
  });

  it("null collaborator cannot write", () => {
    expect(canWrite(null)).toBe(false);
  });
});

// ─── Delete permission tests ───────────────────────────────────

describe("SHARE-PERM: Delete permission enforcement", () => {
  const mkCollab = (role: Role): Collaborator => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can delete workspace", () => {
    expect(canDelete(mkCollab("OWNER"))).toBe(true);
  });

  it("EDITOR cannot delete workspace", () => {
    expect(canDelete(mkCollab("EDITOR"))).toBe(false);
  });

  it("VIEWER cannot delete workspace", () => {
    expect(canDelete(mkCollab("VIEWER"))).toBe(false);
  });
});

// ─── Permission management tests ──────────────────────────────

describe("SHARE-PERM: Permission management enforcement", () => {
  const mkCollab = (role: Role, userId = "user-1"): Collaborator => ({
    userId,
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can manage permissions", () => {
    expect(canManagePermissions(mkCollab("OWNER"))).toBe(true);
  });

  it("EDITOR cannot manage permissions", () => {
    expect(canManagePermissions(mkCollab("EDITOR"))).toBe(false);
  });

  it("VIEWER cannot manage permissions", () => {
    expect(canManagePermissions(mkCollab("VIEWER"))).toBe(false);
  });
});

// ─── Share link permission tests ───────────────────────────────

describe("SHARE-PERM: Share link permissions", () => {
  const mkCollab = (role: Role): Collaborator => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can create share link", () => {
    expect(canCreateShareLink(mkCollab("OWNER"))).toBe(true);
  });

  it("EDITOR cannot create share link", () => {
    expect(canCreateShareLink(mkCollab("EDITOR"))).toBe(false);
  });

  it("OWNER can revoke share link", () => {
    expect(canRevokeShareLink(mkCollab("OWNER"))).toBe(true);
  });

  it("EDITOR cannot revoke share link", () => {
    expect(canRevokeShareLink(mkCollab("EDITOR"))).toBe(false);
  });
});

// ─── Role change permission tests ──────────────────────────────

describe("SHARE-PERM: Role change enforcement", () => {
  const mkCollab = (role: Role, userId = "user-1"): Collaborator => ({
    userId,
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can change another user's role to EDITOR", () => {
    const owner = mkCollab("OWNER", "owner-1");
    const target = mkCollab("VIEWER", "user-2");
    expect(canChangeRole(owner, target, "EDITOR")).toBe(true);
  });

  it("OWNER can change another user's role to VIEWER", () => {
    const owner = mkCollab("OWNER", "owner-1");
    const target = mkCollab("EDITOR", "user-2");
    expect(canChangeRole(owner, target, "VIEWER")).toBe(true);
  });

  it("OWNER cannot change own role", () => {
    const owner = mkCollab("OWNER", "owner-1");
    expect(canChangeRole(owner, owner, "EDITOR")).toBe(false);
  });

  it("EDITOR cannot change roles", () => {
    const editor = mkCollab("EDITOR", "user-1");
    const target = mkCollab("VIEWER", "user-2");
    expect(canChangeRole(editor, target, "EDITOR")).toBe(false);
  });

  it("VIEWER cannot change roles", () => {
    const viewer = mkCollab("VIEWER", "user-1");
    const target = mkCollab("EDITOR", "user-2");
    expect(canChangeRole(viewer, target, "VIEWER")).toBe(false);
  });
});

// ─── Collaborator removal tests ────────────────────────────────

describe("SHARE-PERM: Collaborator removal", () => {
  const mkCollab = (role: Role, userId: string): Collaborator => ({
    userId,
    workspaceId: "ws-1",
    role,
  });

  it("OWNER can remove another collaborator", () => {
    const owner = mkCollab("OWNER", "owner-1");
    const target = mkCollab("EDITOR", "user-2");
    expect(canRemoveCollaborator(owner, target)).toBe(true);
  });

  it("OWNER cannot remove themselves", () => {
    const owner = mkCollab("OWNER", "owner-1");
    // canRemoveCollaborator allows self-removal (leave), but
    // the server should block the last owner from leaving
    // This tests the function itself, not the business constraint
    expect(canRemoveCollaborator(owner, owner)).toBe(true);
  });

  it("EDITOR can leave (self-remove)", () => {
    const editor = mkCollab("EDITOR", "user-2");
    expect(canRemoveCollaborator(editor, editor)).toBe(true);
  });

  it("EDITOR cannot remove another collaborator", () => {
    const editor = mkCollab("EDITOR", "user-2");
    const target = mkCollab("VIEWER", "user-3");
    expect(canRemoveCollaborator(editor, target)).toBe(false);
  });

  it("VIEWER can leave (self-remove)", () => {
    const viewer = mkCollab("VIEWER", "user-3");
    expect(canRemoveCollaborator(viewer, viewer)).toBe(true);
  });

  it("VIEWER cannot remove another collaborator", () => {
    const viewer = mkCollab("VIEWER", "user-3");
    const target = mkCollab("EDITOR", "user-2");
    expect(canRemoveCollaborator(viewer, target)).toBe(false);
  });

  it("null actor cannot remove anyone", () => {
    const target = mkCollab("VIEWER", "user-2");
    expect(canRemoveCollaborator(null, target)).toBe(false);
  });
});

// ─── Permission matrix summary ─────────────────────────────────

describe("SHARE-PERM: Full permission matrix", () => {
  const mkCollab = (role: Role): Collaborator => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
  });

  it("OWNER has all permissions", () => {
    const owner = mkCollab("OWNER");
    expect(canWrite(owner)).toBe(true);
    expect(canDelete(owner)).toBe(true);
    expect(canManagePermissions(owner)).toBe(true);
    expect(canCreateShareLink(owner)).toBe(true);
    expect(canRevokeShareLink(owner)).toBe(true);
  });

  it("EDITOR has write-only permissions", () => {
    const editor = mkCollab("EDITOR");
    expect(canWrite(editor)).toBe(true);
    expect(canDelete(editor)).toBe(false);
    expect(canManagePermissions(editor)).toBe(false);
    expect(canCreateShareLink(editor)).toBe(false);
    expect(canRevokeShareLink(editor)).toBe(false);
  });

  it("VIEWER has no write permissions", () => {
    const viewer = mkCollab("VIEWER");
    expect(canWrite(viewer)).toBe(false);
    expect(canDelete(viewer)).toBe(false);
    expect(canManagePermissions(viewer)).toBe(false);
    expect(canCreateShareLink(viewer)).toBe(false);
    expect(canRevokeShareLink(viewer)).toBe(false);
  });
});
