import { db } from "@lumen/db";
import { createChildLogger, createLogger } from "@lumen/logger";
import { initTRPC } from "@trpc/server";
import { sql } from "drizzle-orm";

const logger = createLogger({ name: "trpc" });

const t = initTRPC.context<Record<string, never>>().create({
  errorFormatter: ({ shape, error }) => {
    logger.error(
      {
        code: error.code,
        message: error.message,
        cause: error.cause,
        stack: error.stack,
      },
      "tRPC error occurred"
    );
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  checkDb: publicProcedure.query(async () => {
    const procedureLogger = createChildLogger(logger, { procedure: "checkDb" });
    procedureLogger.debug("Checking database connection");

    try {
      const result = await db.execute(sql`SELECT 1 as connected`);
      procedureLogger.info("Database connection check successful");
      return {
        success: true,
        message: "Database connection successful",
        data: result,
      };
    } catch (error) {
      procedureLogger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Database connection check failed"
      );
      return {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});

export type AppRouter = typeof appRouter;
