import { cors } from "@elysiajs/cors";
import { createLogger } from "@lumen/logger";
import { initOtel, shutdownOtel } from "@lumen/logger/server";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { Elysia } from "elysia";
import { aiRoutes } from "./ai";
import { authMacro } from "./auth/middleware/auth-macro";
import { authRoutes } from "./auth/routes";
import { collabRoutes } from "./collab";
import { env } from "./env";
import { originGuard } from "./middleware/origin-guard";
import { otelMetrics } from "./middleware/otel-metrics";
import { WORKERS_VERSION } from "./version";

initOtel("lumen-workers", [new PrismaInstrumentation()], {
  serviceVersion: WORKERS_VERSION,
  samplingRatio: 0.2,
});
const logger = createLogger({ name: "workers:main" });

const origins =
  env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.length > 0
    ? env.ALLOWED_ORIGINS
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

const app = new Elysia()
  .use(otelMetrics)
  .use(
    cors({
      origin: origins,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-assistant-message-id",
        "x-e2e-bypass",
        "x-e2e-user-id",
        "x-internal-key",
        "x-guest-token",
        "x-request-id",
        "traceparent",
        "tracestate",
        "baggage",
      ],
      exposeHeaders: ["Set-Cookie"],
    })
  )
  .use(originGuard)
  .use(authMacro)
  .use(authRoutes)
  .use(collabRoutes)
  .use(aiRoutes)
  .get("/", () => ({
    message: "Lumen Workers",
    version: WORKERS_VERSION,
    status: "operational",
  }))
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
  .get("/instance-id", () => ({
    instanceId: `workers-${env.PORT}`,
    port: env.PORT,
  }))
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
    if (app.server) {
      logger.debug("Stopping server...");
      app.server.stop();
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.debug("Flushing OpenTelemetry...");
    await shutdownOtel();
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
