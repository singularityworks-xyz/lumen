import { db } from "@lumen/db";
import { initTRPC } from "@trpc/server";
import { sql } from "drizzle-orm";

const t = initTRPC.context<Record<string, never>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  checkDb: publicProcedure.query(async () => {
    try {
      const result = await db.execute(sql`SELECT 1 as connected`);
      return {
        success: true,
        message: "Database connection successful",
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});

export type AppRouter = typeof appRouter;
