import { cors } from "@elysiajs/cors";
import { createLogger } from "@lumen/logger";
import { Elysia } from "elysia";
import { authMacro } from "./auth/middleware/auth-macro";
import { authRoutes } from "./auth/routes";
import { collabRoutes } from "./collab";

const logger = createLogger({ name: "workers:main" });

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  : [];

const origins =
  allowedOrigins.length > 0 ? allowedOrigins : ["http://localhost:3000"];

const app = new Elysia()
  .use(
    cors({
      origin: origins,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Set-Cookie"],
    })
  )
  .use(authMacro)
  .use(authRoutes)
  .use(collabRoutes)
  .get("/", () => {
    logger.debug("Root endpoint accessed");
    return {
      message: "Lumen Workers",
      version: "1.0.0",
      status: "operational",
    };
  })
  .get("/health", () => {
    logger.debug("Health check endpoint accessed");
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  })
  .onStart(() => {
    logger.info("Server starting", {
      port: 3002,
      env: process.env.NODE_ENV || "development",
      allowedOrigins: origins,
    });
  })
  .onError(({ error, code, set, path }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not Found",
        message: `Route ${path} not found`,
      };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation Error",
        message: error instanceof Error ? error.message : "Invalid request",
      };
    }

    logger.error("Unhandled error", {
      code,
      path,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : error instanceof Error
            ? error.message
            : "Unknown error",
    };
  })
  .listen(3002);

logger.info("Server started successfully", {
  hostname: app.server?.hostname,
  port: app.server?.port,
  url: `http://${app.server?.hostname}:${app.server?.port}`,
});
