import { createChildLogger, createLogger } from "@lumen/logger";
import { appRouter } from "@lumen/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const logger = createLogger({ name: "trpc:handler" });

const handler = (req: Request) => {
  const requestLogger = createChildLogger(logger, {
    method: req.method,
    url: req.url,
  });

  requestLogger.debug("Handling tRPC request");

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => {
      requestLogger.debug("Creating tRPC context");
      return {};
    },
    onError: ({ error, path, type }) => {
      requestLogger.error({
        error: error.message,
        code: error.code,
        path,
        type,
        stack: error.stack,
      });
    },
  });
};

export { handler as GET, handler as POST };
