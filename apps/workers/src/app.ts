import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { aiRoutes } from "./ai";
import { authMacro } from "./auth/middleware/auth-macro";
import { authRoutes } from "./auth/routes";
import { collabRoutes } from "./collab";

const WORKERS_VERSION = "1.0.2";

export function createApp(options?: { origins?: string[] }) {
  const origins = options?.origins ?? ["http://localhost:3000"];

  const app = new Elysia()
    .use(
      cors({
        origin: origins,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true,
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "x-assistant-message-id",
        ],
        exposeHeaders: ["Set-Cookie"],
      })
    )
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
    }));

  return app;
}
