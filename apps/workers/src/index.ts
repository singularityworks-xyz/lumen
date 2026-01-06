import { cors } from "@elysiajs/cors";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { createLogger } from "@lumen/logger";
import { initOtel, shutdownOtel } from "@lumen/logger/server";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { Elysia } from "elysia";
import { authMacro } from "./auth/middleware/auth-macro";
import { authRoutes } from "./auth/routes";
import { collabRoutes } from "./collab";
import { env } from "./env";
import { otelMetrics } from "./middleware/otel-metrics";

initOtel("lumen-workers", [new PrismaInstrumentation()]);
const logger = createLogger({ name: "workers:main" });

const origins =
  env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.length > 0
    ? env.ALLOWED_ORIGINS
    : ["http://localhost:3000"];

const app = new Elysia()
  .use(opentelemetry())
  .use(otelMetrics)
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
      port: env.PORT,
      env: env.NODE_ENV,
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
        env.NODE_ENV === "production"
          ? "Something went wrong"
          : error instanceof Error
            ? error.message
            : "Unknown error",
    };
  })
  .listen(env.PORT);

logger.info("Server started successfully", {
  hostname: app.server?.hostname,
  port: app.server?.port,
  url: `http://${app.server?.hostname}:${app.server?.port}`,
});

let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  logger.info("Shutting down gracefully...", { signal });

  try {
    // Stop accepting new connections
    if (app.server) {
      logger.debug("Stopping server...");
      app.server.stop();
    }

    // Give in-flight requests a moment to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Flush OpenTelemetry data
    logger.debug("Flushing OpenTelemetry...");
    await shutdownOtel();

    // Close database connections
    logger.debug("Disconnecting from database...");
    const { prisma } = await import("@lumen/db");
    await prisma.$disconnect();

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
