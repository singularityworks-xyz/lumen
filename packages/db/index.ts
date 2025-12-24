import { PrismaPg } from "@prisma/adapter-pg";
// biome-ignore lint/style/noExportedImports: We want to re-export PrismaClient
import { PrismaClient } from "./prisma/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export PrismaClient and all generated types
export { PrismaClient };
export type * from "./prisma/generated/prisma/client";
export type * from "./prisma/generated/prisma/models";
