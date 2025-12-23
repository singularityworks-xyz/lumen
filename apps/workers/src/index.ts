import { cors } from "@elysiajs/cors";
import { createLogger } from "@lumen/logger";
import { Elysia } from "elysia";
import { authMacro } from "./auth/middleware/auth-macro";
import { authRoutes } from "./auth/routes";

const logger = createLogger({ name: "workers:main" });

const app = new Elysia()
  .use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:3000",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Set-Cookie"],
    })
  )
  .use(authMacro)
  .use(authRoutes)
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
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:3000",
      ],
    });
  })
  .onError(({ error, set }) => {
    logger.error("Unhandled error", {
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
