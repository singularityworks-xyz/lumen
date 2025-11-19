import { createLogger } from "@lumen/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import { users } from "./schema";

const logger = createLogger({ name: "db" });

logger.debug("Initializing database connection");
const client = postgres(env.DATABASE_URL);

const schema = {
  users,
};

export const db = drizzle({ client, schema });
logger.info("Database connection initialized");
