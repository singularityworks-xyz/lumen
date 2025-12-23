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
      query: Object.fromEntries(url.searchParams),
    });
  })
  .onAfterHandle(({ request }) => {
    const url = new URL(request.url);
    logger.info("Auth response sent", {
      method: request.method,
      path: url.pathname,
    });
  })
  .onError(({ error, request }) => {
    const url = new URL(request.url);
    logger.error("Auth route error", {
      method: request.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return error;
  })
  .all("/api/auth/*", ({ request }) => {
    logger.debug("Delegating to Better Auth handler", {
      method: request.method,
      url: request.url,
    });

    return auth.handler(request);
  });
