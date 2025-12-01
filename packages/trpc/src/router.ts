import { createChildLogger, createLogger } from "@lumen/logger";
import { initTRPC } from "@trpc/server";

const logger = createLogger({ name: "[server] trpc" });

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
  health: publicProcedure.query(() => {
    const childLogger = createChildLogger(logger, { name: "health" });
    childLogger.info("Health check requested");
    return { status: "ok" };
  }),
});

export type AppRouter = typeof appRouter;
