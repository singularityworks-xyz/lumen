import { PrismaPg } from "@prisma/adapter-pg";
import { createJwksEncryptionExtension } from "./lib/prisma-middleware";
// biome-ignore lint/style/noExportedImports: We want to re-export PrismaClient
import { PrismaClient } from "./prisma/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const baseClient = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? // commented query logging to reduce noise during development for checking other logs
          [/*"query",*/ "error", "warn"]
        : ["error"],
  });

  return baseClient.$extends(createJwksEncryptionExtension());
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type * from "./prisma/generated/prisma/client";
export type * from "./prisma/generated/prisma/models";
// Re-export PrismaClient and all generated types
export { PrismaClient };
