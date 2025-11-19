import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import { users } from "./schema";

const client = postgres(env.DATABASE_URL);

const schema = {
  users,
};

export const db = drizzle({ client, schema });
