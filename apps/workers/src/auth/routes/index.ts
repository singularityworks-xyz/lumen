import { createLogger } from "@lumen/logger";
import Elysia from "elysia";
import { auth } from "../config/auth";

const logger = createLogger({ name: "auth:routes" });

export const authRoutes = new Elysia({ name: "auth-routes" })
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    logger.info("Auth request received", {
      method: request.method,
      path: url.pathname,
    });
  })
  .onAfterHandle(({ request }) => {
    const url = new URL(request.url);
    logger.info("Auth response sent", {
      method: request.method,
      path: url.pathname,
    });
  })
  .onError(({ error, request, set }) => {
    const url = new URL(request.url);
    logger.error("Auth route error", {
      method: request.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    const statusCode = (error as { status?: number }).status || 500;
    set.status = statusCode;

    return {
      error: statusCode === 401 ? "Unauthorized" : "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { stack: error.stack }
        : {}),
    };
  })
  .all("/api/auth/*", ({ request }) => {
    logger.debug("Delegating to Better Auth handler", {
      method: request.method,
      url: request.url,
    });

    return auth.handler(request);
  });
