import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/index";

describe("db integration", () => {
  beforeAll(async () => {
    // Clean up test data if any exists
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@test.local" } },
    });
    await prisma.jwks.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@test.local" } },
    });
    await prisma.jwks.deleteMany({});
    await prisma.$disconnect();
  });

  it("can perform basic CRUD operations", async () => {
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
    // Needs a valid JWKS_ENCRYPTION_KEY env var
    process.env.JWKS_ENCRYPTION_KEY = "test-encryption-key-for-integration";

    // Disable mocked Date.now just for this key gen to be completely safe
    const mockDateNow = Date.now;
    Date.now = () => mockDateNow() + 1;

    const keyData = {
      publicKey: `pub-${Math.random()}`,
      privateKey: "super-secret-private-key-data",
    };

    // 1. Create - Should encrypt under the hood
    const jwks = await prisma.jwks.create({
      data: keyData,
    });

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
    const raw: any[] =
      await prisma.$queryRaw`SELECT "privateKey" FROM "jwks" WHERE "id" = ${jwks.id}`;
    expect(raw[0].privateKey).toBeDefined();
    expect(raw[0].privateKey).not.toBe(keyData.privateKey);
    // Our encryption format is base64 string
    expect(() => Buffer.from(raw[0].privateKey, "base64")).not.toThrow();

    // Cleanup
    await prisma.jwks.delete({
      where: { id: jwks.id },
    });

    Date.now = mockDateNow;
  });

  it("handles relational data creation and querying", async () => {
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
