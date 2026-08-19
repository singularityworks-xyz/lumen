import path from "node:path";
import { config as loadDotenv } from "dotenv";

// Loads the gitignored root .env (secrets only: OAuth client secrets, API
// keys) into the workers process. Bun already auto-loads the committed
// per-app .env.development defaults; this file OVERRIDES them so real
// secrets win over dev fakes. Missing file = no-op (dev fakes are used).
// Skipped entirely in production (NODE_ENV=production) — orchestrators
// (Dokploy, etc.) set env natively.
const REPO_ROOT = path.resolve(import.meta.dir, "../../..");

export function loadLocalEnvFiles(): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  loadDotenv({
    path: path.join(REPO_ROOT, ".env"),
    override: true,
    quiet: true,
  });
}
