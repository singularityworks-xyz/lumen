import { createLogger } from "@lumen/logger";
import { Elysia } from "elysia";

const logger = createLogger();
const app = new Elysia().get("/", () => "Hello Elysia").listen(3002);

logger.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
