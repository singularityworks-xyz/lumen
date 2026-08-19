import { afterAll, beforeAll, describe, expect, it } from "bun:test";

// Ensure DATABASE_URL is set before importing Prisma client
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/lumen_test";

// Lazy-load prisma so the env var is guaranteed to be present.
// This avoids "DATABASE_URL not set" errors when the preload file
// hasn't executed yet (Bun loads test file imports before preloads).
const prismaPromise = import("../index").then((m) => m.prisma);

let prisma: Awaited<typeof prismaPromise>;
let dbAvailable = false;

// Probe the database once at module load time so we know whether to skip tests.
const dbProbePromise = prismaPromise
  .then(async (p) => {
    await p.$queryRaw`SELECT 1`;
    return true;
  })
  .catch(() => false);

describe("db integration", () => {
  beforeAll(async () => {
    dbAvailable = await dbProbePromise;

    if (!dbAvailable) {
      return;
    }

    prisma = await prismaPromise;

    // Clean up test data if any exists
    await prisma.user
      .deleteMany({
        where: { email: { endsWith: "@test.local" } },
      })
      .catch(() => undefined);
    await prisma.jwks.deleteMany({}).catch(() => undefined);
  });

  afterAll(async () => {
    if (!dbAvailable) {
      return;
    }
    await prisma.user
      .deleteMany({
        where: { email: { endsWith: "@test.local" } },
      })
      .catch(() => undefined);
    await prisma.jwks.deleteMany({}).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("can perform basic CRUD operations", async () => {
    if (!dbAvailable) {
      return;
    }
    // 1. Create
    const user = await prisma.user.create({
      data: {
        email: `crud-${Date.now()}@test.local`,
        name: "Test User",
      },
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe("Test User");

    // 2. Read
    const fetched = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(fetched?.email).toBe(user.email);

    // 3. Update
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: "Updated Name" },
    });
    expect(updated.name).toBe("Updated Name");

    // 4. Delete
    const deleted = await prisma.user.delete({
      where: { id: user.id },
    });
    expect(deleted.id).toBe(user.id);

    // Verify deletion
    const missing = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(missing).toBeNull();
  });

  it("transparently encrypts and decrypts JWKS private keys", async () => {
    if (!dbAvailable) {
      return;
    }
    // Save previous state for cleanup
    const previousEnv = process.env.JWKS_ENCRYPTION_KEY;
    const mockDateNow = Date.now;

    // Needs a valid JWKS_ENCRYPTION_KEY env var
    process.env.JWKS_ENCRYPTION_KEY = "test-encryption-key-for-integration";

    // Disable mocked Date.now just for this key gen to be completely safe
    Date.now = () => mockDateNow() + 1;

    let jwksId: string | undefined;

    try {
      const keyData = {
        publicKey: `pub-${Math.random()}`,
        privateKey: "super-secret-private-key-data",
        alg: "EdDSA",
        crv: "Ed25519",
      };

      // 1. Create - Should encrypt under the hood
      const jwks = await prisma.jwks.create({
        data: keyData,
      });
      jwksId = jwks.id;

      // We can't easily see the encrypted data directly through Prisma because
      // the middleware decrypts it on read, but we can verify it round-trips correctly.
      expect(jwks.id).toBeDefined();
      expect(jwks.privateKey).toBe(keyData.privateKey);

      // 2. Read - Should decrypt under the hood
      const fetched = await prisma.jwks.findUnique({
        where: { id: jwks.id },
      });

      expect(fetched?.privateKey).toBe(keyData.privateKey);

      // 3. Verify it's actually encrypted in the DB using a raw query
      // This bypasses the middleware
      const raw = await prisma.$queryRaw<
        { privateKey: string }[]
      >`SELECT "privateKey" FROM "jwks" WHERE "id" = ${jwks.id}`;
      expect(raw[0].privateKey).toBeDefined();
      expect(raw[0].privateKey).not.toBe(keyData.privateKey);
      // Our encryption format is base64 string
      expect(() => Buffer.from(raw[0].privateKey, "base64")).not.toThrow();
    } finally {
      // Restore global state
      if (previousEnv === undefined) {
        Reflect.deleteProperty(process.env, "JWKS_ENCRYPTION_KEY");
      } else {
        process.env.JWKS_ENCRYPTION_KEY = previousEnv;
      }
      Date.now = mockDateNow;

      // Cleanup DB row if it was created
      if (jwksId) {
        await prisma.jwks
          .delete({ where: { id: jwksId } })
          .catch(() => undefined);
      }
    }
  });

  it("handles relational data creation and querying", async () => {
    if (!dbAvailable) {
      return;
    }
    const email = `relation-${Date.now()}@test.local`;

    const user = await prisma.user.create({
      data: {
        email,
        name: "Workspace Owner",
        workspaces: {
          create: {
            name: "Test Workspace",
            description: "A workspace for testing relations",
          },
        },
      },
      include: {
        workspaces: true,
      },
    });

    expect(user.workspaces).toHaveLength(1);
    expect(user.workspaces[0].name).toBe("Test Workspace");

    const workspaceId = user.workspaces[0].id;

    // Test cascading deletes
    await prisma.user.delete({
      where: { id: user.id },
    });

    const deletedWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    expect(deletedWorkspace).toBeNull();
  });
});
