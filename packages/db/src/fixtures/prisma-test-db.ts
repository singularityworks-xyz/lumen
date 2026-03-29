import type { Role } from "../../prisma/generated/prisma/enums";
import { prisma } from "../index";

export interface SeedUserInput {
  email?: string;
  emailVerified?: boolean;
  id?: string;
  image?: string;
  name?: string;
}

export interface SeedSessionInput {
  expiresAt?: Date;
  id?: string;
  token?: string;
  userId: string;
}

export interface SeedWorkspaceInput {
  id?: string;
  name?: string;
  ownerId: string;
}

export interface SeedCollaboratorInput {
  role?: Role;
  userId: string;
  workspaceId: string;
}

export function seedUser(input: SeedUserInput = {}) {
  return prisma.user.create({
    data: {
      id: input.id ?? `test-user-${randomHex()}`,
      name: input.name ?? "Test User",
      email: input.email ?? `test-${randomHex()}@test.com`,
      emailVerified: input.emailVerified ?? false,
      image: input.image,
    },
  });
}

export function seedSession(input: SeedSessionInput) {
  return prisma.session.create({
    data: {
      id: input.id ?? `test-session-${randomHex()}`,
      userId: input.userId,
      token: input.token ?? `token-${randomHex()}`,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

export function seedWorkspace(input: SeedWorkspaceInput) {
  return prisma.workspace.create({
    data: {
      id: input.id ?? `test-ws-${randomHex()}`,
      name: input.name ?? "Test Workspace",
      ownerId: input.ownerId,
    },
  });
}

export function seedCollaborator(input: SeedCollaboratorInput) {
  return prisma.workspaceCollaborator.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role ?? "EDITOR",
    },
  });
}

export function seedWorkspaceState(
  workspaceId: string,
  yjsState?: Uint8Array,
  stateVector?: Uint8Array
) {
  return prisma.workspaceState.create({
    data: {
      workspaceId,
      yjsState: yjsState ? Buffer.from(yjsState) : Buffer.from([0]),
      stateVector: stateVector ? Buffer.from(stateVector) : undefined,
    },
  });
}

export function seedShareToken(
  workspaceId: string,
  createdBy: string,
  expiresAt?: Date
) {
  return prisma.workspaceShare.create({
    data: {
      workspaceId,
      token: `share-${randomHex()}`,
      createdBy,
      expiresAt,
    },
  });
}

export interface SeededFixtureUser {
  session: { id: string; token: string };
  user: { email: string; id: string; name: string };
  workspace: { id: string };
}

export async function seedTestWorkspace(
  overrides: {
    userName?: string;
    userEmail?: string;
    workspaceName?: string;
  } = {}
): Promise<SeededFixtureUser> {
  const user = await seedUser({
    name: overrides.userName ?? "Fixture User",
    email: overrides.userEmail ?? `fixture-${randomHex()}@test.com`,
  });

  const session = await seedSession({ userId: user.id });

  const workspace = await seedWorkspace({
    name: overrides.workspaceName ?? "Fixture Workspace",
    ownerId: user.id,
  });

  await seedCollaborator({
    workspaceId: workspace.id,
    userId: user.id,
    role: "OWNER",
  });

  return {
    user: { id: user.id, name: user.name ?? "", email: user.email },
    session: { id: session.id, token: session.token },
    workspace: { id: workspace.id },
  };
}

export async function cleanupTestDb() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tablenames) {
    if (tablename === "_prisma_migrations") {
      continue;
    }
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "public"."${tablename}" CASCADE`
      );
    } catch {
      // ignore truncation failures
    }
  }
}

export async function deleteWorkspaceCascade(workspaceId: string) {
  await prisma.workspaceCollaborator.deleteMany({
    where: { workspaceId },
  });
  await prisma.workspaceState.deleteMany({
    where: { workspaceId },
  });
  await prisma.workspaceShare.deleteMany({
    where: { workspaceId },
  });
  await prisma.workspace.deleteMany({
    where: { id: workspaceId },
  });
}

export async function deleteUserCascade(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.workspaceCollaborator.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

function randomHex(length = 8): string {
  return Array.from({ length }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}
